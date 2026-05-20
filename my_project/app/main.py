from __future__ import annotations

import os
import csv
import time
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
SAMPLE_DATA_DIR = Path(os.getenv("SAMPLE_DATA_DIR", "sample_data"))
if not SAMPLE_DATA_DIR.is_absolute():
    SAMPLE_DATA_DIR = ROOT / SAMPLE_DATA_DIR
DATA_LOAD_SOURCES: dict[str, dict[str, Any]] = {}
DATA_BACKEND_ERRORS: list[str] = []

APP_DATA_SOURCE = os.getenv("APP_DATA_SOURCE", os.getenv("DATA_SOURCE", "csv")).strip().lower()
USE_PIPELINE_DATA = APP_DATA_SOURCE in {"databricks", "pipeline", "warehouse"} or os.getenv(
    "USE_PIPELINE_DATA", ""
).strip().lower() in {"1", "true", "yes", "y"}
PIPELINE_CATALOG = os.getenv("PIPELINE_CATALOG", os.getenv("DATABRICKS_CATALOG", "cme_outcomes_uswest"))
PIPELINE_SCHEMA = os.getenv("PIPELINE_SCHEMA", os.getenv("DATABRICKS_SCHEMA", "lakefoundry"))
SOURCE_CATALOG = os.getenv("SOURCE_CATALOG", os.getenv("PIPELINE_SOURCE_CATALOG", PIPELINE_CATALOG))
SOURCE_SCHEMA = os.getenv("SOURCE_SCHEMA", os.getenv("PIPELINE_SOURCE_SCHEMA", "media_demo"))


def _display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def _read_csv_rows(table_name: str) -> list[dict[str, str]] | None:
    path = SAMPLE_DATA_DIR / f"{table_name}.csv"
    if not path.exists():
        DATA_LOAD_SOURCES[table_name] = {
            "source": "embedded_fallback",
            "path": _display_path(path),
            "rows": 0,
            "loaded": False,
        }
        return None

    with path.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))

    DATA_LOAD_SOURCES[table_name] = {
        "source": "csv_extract",
        "path": _display_path(path),
        "rows": len(rows),
        "loaded": True,
    }
    return rows


def _as_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "y"}


def _as_int(value: str) -> int:
    return int(value.strip())


def _as_float(value: str) -> float:
    return float(value.strip())


def _as_optional(value: str) -> str | None:
    clean = value.strip()
    return clean or None


def _split_semicolon(value: str) -> list[str]:
    return [part.strip() for part in value.split(";") if part.strip()]


def _load_csv_table(
    table_name: str,
    fallback: list[dict[str, Any]],
    parser: Callable[[dict[str, str]], dict[str, Any]],
) -> list[dict[str, Any]]:
    rows = _read_csv_rows(table_name)
    if rows is None:
        DATA_LOAD_SOURCES[table_name]["rows"] = len(fallback)
        return fallback
    return [parser(row) for row in rows]


def _as_int_value(value: Any, default: int = 0) -> int:
    if value is None or value == "":
        return default
    return int(float(str(value)))


def _as_float_value(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    return float(value)


def _as_bool_value(value: Any, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def _as_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value)


def _split_tags(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [part.strip() for part in str(value).replace(";", ",").split(",") if part.strip()]


def _sql_identifier(part: str) -> str:
    clean = part.strip()
    if not clean.replace("_", "").isalnum():
        raise ValueError(f"Unsafe SQL identifier: {part}")
    return f"`{clean}`"


def _full_table(catalog: str, schema: str, table: str) -> str:
    return ".".join([_sql_identifier(catalog), _sql_identifier(schema), _sql_identifier(table)])


def _pipeline_table(table: str) -> str:
    return _full_table(PIPELINE_CATALOG, PIPELINE_SCHEMA, table)


def _source_table(table: str) -> str:
    return _full_table(SOURCE_CATALOG, SOURCE_SCHEMA, table)


def _table_source(table_name: str, full_name: str, rows: int) -> None:
    DATA_LOAD_SOURCES[table_name] = {
        "source": "databricks_sql",
        "path": full_name.replace("`", ""),
        "rows": rows,
        "loaded": True,
    }


def _table_error(table_name: str, error: Exception) -> None:
    DATA_BACKEND_ERRORS.append(f"{table_name}: {error}")
    existing = DATA_LOAD_SOURCES.get(table_name, {})
    DATA_LOAD_SOURCES[table_name] = {
        **existing,
        "source": f"{existing.get('source', 'csv_extract')}_fallback",
        "loaded": bool(existing.get("loaded", False)),
        "error": str(error),
    }


def _warehouse_id(client: Any) -> str:
    warehouse_id = (
        os.getenv("DATABRICKS_WAREHOUSE_ID")
        or os.getenv("DATABRICKS_SQL_WAREHOUSE_ID")
        or os.getenv("SQL_WAREHOUSE_ID")
    )
    if warehouse_id:
        return warehouse_id

    warehouses = list(client.warehouses.list())
    if not warehouses:
        raise RuntimeError("No Databricks SQL warehouses are available")

    def state_value(warehouse: Any) -> str:
        state = getattr(warehouse, "state", "")
        return getattr(state, "value", str(state))

    running = next((warehouse for warehouse in warehouses if state_value(warehouse).upper() == "RUNNING"), None)
    selected = running or warehouses[0]
    selected_id = getattr(selected, "id", None)
    if not selected_id:
        raise RuntimeError("Could not determine a Databricks SQL warehouse id")
    return selected_id


@lru_cache(maxsize=1)
def _workspace_client() -> Any:
    from databricks.sdk import WorkspaceClient

    return WorkspaceClient()


def _execute_sql(statement: str, row_limit: int = 100) -> list[dict[str, Any]]:
    from databricks.sdk.service.sql import (
        Disposition,
        ExecuteStatementRequestOnWaitTimeout,
        Format,
        StatementState,
    )

    client = _workspace_client()
    response = client.statement_execution.execute_statement(
        statement=statement,
        warehouse_id=_warehouse_id(client),
        catalog=PIPELINE_CATALOG,
        schema=PIPELINE_SCHEMA,
        disposition=Disposition.INLINE,
        format=Format.JSON_ARRAY,
        row_limit=row_limit,
        wait_timeout="30s",
        on_wait_timeout=ExecuteStatementRequestOnWaitTimeout.CONTINUE,
    )

    deadline = time.time() + 120
    while response.status and response.status.state in {StatementState.PENDING, StatementState.RUNNING}:
        if not response.statement_id or time.time() > deadline:
            raise TimeoutError("Databricks SQL statement did not finish in time")
        time.sleep(1)
        response = client.statement_execution.get_statement(response.statement_id)

    if response.status and response.status.state != StatementState.SUCCEEDED:
        error = getattr(response.status, "error", None)
        message = getattr(error, "message", None) or response.status.state.value
        raise RuntimeError(message)

    columns = [column.name or "" for column in (response.manifest.schema.columns if response.manifest and response.manifest.schema else [])]
    rows = response.result.data_array if response.result and response.result.data_array else []
    return [dict(zip(columns, row)) for row in rows]

app = FastAPI(title="Creative Command Center API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


BRIEFS = [
    {
        "brief_id": "BRIEF-001",
        "brief_name": "Summer Campaign 2026",
        "brand_name": "CME Streaming",
        "campaign_objective": "Lift tune-in intent for premium sports and live-event bundles",
        "target_audience_description": "High-value fans, 25-44, cross-device streamers",
        "status": "Active",
        "created_ts": "2026-05-01",
        "concepts_count": 7,
        "creatives_count": 34,
        "budget": 420000,
        "owner": "Agency Pod A",
    },
    {
        "brief_id": "BRIEF-002",
        "brief_name": "Winback Flight Q2",
        "brand_name": "CME Streaming",
        "campaign_objective": "Recover recently churned subscribers with event-led offers",
        "target_audience_description": "Lapsed subscribers with sports affinity",
        "status": "Approved",
        "created_ts": "2026-04-28",
        "concepts_count": 5,
        "creatives_count": 18,
        "budget": 275000,
        "owner": "Retention Desk",
    },
    {
        "brief_id": "BRIEF-003",
        "brief_name": "Family Movie Nights",
        "brand_name": "CME Streaming",
        "campaign_objective": "Grow household watch time through family content discovery",
        "target_audience_description": "Families, shared accounts, weekend viewing",
        "status": "In Review",
        "created_ts": "2026-04-22",
        "concepts_count": 4,
        "creatives_count": 11,
        "budget": 180000,
        "owner": "Brand Studio",
    },
    {
        "brief_id": "BRIEF-004",
        "brief_name": "Trial-to-Paid Conversion",
        "brand_name": "CME Streaming",
        "campaign_objective": "Move trial users to annual plans before day 21",
        "target_audience_description": "Trial users with 3+ sessions in first week",
        "status": "Draft",
        "created_ts": "2026-04-19",
        "concepts_count": 3,
        "creatives_count": 6,
        "budget": 125000,
        "owner": "Growth Lab",
    },
]

AUDIENCES = [
    {
        "cohort_id": "COH-001",
        "cohort_name": "Live Sports Loyalists",
        "cohort_description": "Heavy live-game viewers with high retention value",
        "definition_type": "ml_model",
        "personalization_granularity": "Micro_Cohort",
        "estimated_reach": 285000,
        "is_region_allowed": True,
        "is_channel_allowed": True,
        "is_frequency_capped": True,
        "status": "Active",
        "last_updated_ts": "2026-05-10",
        "match_rate": 0.91,
        "avg_ltv": 720,
    },
    {
        "cohort_id": "COH-002",
        "cohort_name": "Churn Risk: Sports",
        "cohort_description": "Subscribers with sports affinity and falling engagement",
        "definition_type": "ml_model",
        "personalization_granularity": "One_to_One",
        "estimated_reach": 142000,
        "is_region_allowed": True,
        "is_channel_allowed": True,
        "is_frequency_capped": True,
        "status": "Active",
        "last_updated_ts": "2026-05-09",
        "match_rate": 0.87,
        "avg_ltv": 510,
    },
    {
        "cohort_id": "COH-003",
        "cohort_name": "Family Co-Viewing",
        "cohort_description": "Households with consistent weekend family content sessions",
        "definition_type": "rule_based",
        "personalization_granularity": "Segment",
        "estimated_reach": 198000,
        "is_region_allowed": True,
        "is_channel_allowed": True,
        "is_frequency_capped": False,
        "status": "Active",
        "last_updated_ts": "2026-05-08",
        "match_rate": 0.82,
        "avg_ltv": 440,
    },
    {
        "cohort_id": "COH-004",
        "cohort_name": "Premium Upgrade Lookalikes",
        "cohort_description": "Lookalikes modeled from annual-plan converters",
        "definition_type": "lookalike",
        "personalization_granularity": "Micro_Cohort",
        "estimated_reach": 365000,
        "is_region_allowed": True,
        "is_channel_allowed": False,
        "is_frequency_capped": True,
        "status": "Active",
        "last_updated_ts": "2026-05-07",
        "match_rate": 0.79,
        "avg_ltv": 630,
    },
    {
        "cohort_id": "COH-005",
        "cohort_name": "Suppression: Service Issues",
        "cohort_description": "Open service cases and recent refund requests",
        "definition_type": "manual",
        "personalization_granularity": "One_to_One",
        "estimated_reach": 37000,
        "is_region_allowed": True,
        "is_channel_allowed": True,
        "is_frequency_capped": False,
        "status": "Active",
        "last_updated_ts": "2026-05-10",
        "match_rate": 0.96,
        "avg_ltv": 390,
    },
]

CREATIVES = [
    {
        "creative_asset_id": "CAD-001",
        "asset_name": "Championship Night Hero",
        "asset_type": "Image",
        "format": "JPG",
        "width_px": 1280,
        "height_px": 628,
        "approval_status": "Approved",
        "target_segment": "Live Sports Loyalists",
        "content_tags": ["sports", "hero", "premium"],
        "generation_model": "Ideogram 2.0",
        "created_at": "2026-05-09",
        "quality_score": 94,
        "predicted_ctr": 1.28,
    },
    {
        "creative_asset_id": "CAD-002",
        "asset_name": "Final Whistle Story",
        "asset_type": "Video",
        "format": "MP4",
        "width_px": 1080,
        "height_px": 1920,
        "approval_status": "Approved",
        "target_segment": "Churn Risk: Sports",
        "content_tags": ["story", "winback", "sports"],
        "generation_model": "Runway Gen-3",
        "created_at": "2026-05-08",
        "quality_score": 91,
        "predicted_ctr": 1.04,
    },
    {
        "creative_asset_id": "CAD-003",
        "asset_name": "Family Slate DCO",
        "asset_type": "DCO",
        "format": "HTML",
        "width_px": 1200,
        "height_px": 628,
        "approval_status": "Pending_Review",
        "target_segment": "Family Co-Viewing",
        "content_tags": ["dco", "family", "weekend"],
        "generation_model": "Celtra DCO",
        "created_at": "2026-05-07",
        "quality_score": 88,
        "predicted_ctr": 0.82,
    },
    {
        "creative_asset_id": "CAD-004",
        "asset_name": "Annual Upgrade Leaderboard",
        "asset_type": "Image",
        "format": "PNG",
        "width_px": 728,
        "height_px": 90,
        "approval_status": "Draft",
        "target_segment": "Premium Upgrade Lookalikes",
        "content_tags": ["upgrade", "display"],
        "generation_model": "Ideogram 2.0",
        "created_at": "2026-05-06",
        "quality_score": 79,
        "predicted_ctr": 0.67,
    },
]

ACTIVATIONS = [
    {
        "activation_id": "ACT-001",
        "creative_asset_id": "CAD-001",
        "campaign_id": "CAMP-1001",
        "destination_platform": "The Trade Desk",
        "trafficking_status": "Live",
        "impressions": 380000,
        "clicks": 4864,
        "conversions": 681,
        "cost": 68400,
        "ab_test_id": "AB-100",
        "last_sync_ts": "2026-05-12 09:40",
    },
    {
        "activation_id": "ACT-002",
        "creative_asset_id": "CAD-002",
        "campaign_id": "CAMP-1001",
        "destination_platform": "Meta",
        "trafficking_status": "Live",
        "impressions": 425000,
        "clicks": 4420,
        "conversions": 530,
        "cost": 51200,
        "ab_test_id": "AB-100",
        "last_sync_ts": "2026-05-12 09:35",
    },
    {
        "activation_id": "ACT-003",
        "creative_asset_id": "CAD-003",
        "campaign_id": "CAMP-1002",
        "destination_platform": "DV360",
        "trafficking_status": "Submitted",
        "impressions": 214000,
        "clicks": 1755,
        "conversions": 246,
        "cost": 29750,
        "ab_test_id": None,
        "last_sync_ts": "2026-05-12 08:20",
    },
    {
        "activation_id": "ACT-004",
        "creative_asset_id": "CAD-004",
        "campaign_id": "CAMP-1003",
        "destination_platform": "Google Ads",
        "trafficking_status": "Draft",
        "impressions": 0,
        "clicks": 0,
        "conversions": 0,
        "cost": 0,
        "ab_test_id": "AB-101",
        "last_sync_ts": "2026-05-11 17:05",
    },
]

PERFORMANCE_TREND_LAST_7 = [
    {"date": "May 06", "spend": 34000, "conversions": 391, "ctr": 0.83},
    {"date": "May 07", "spend": 36500, "conversions": 430, "ctr": 0.91},
    {"date": "May 08", "spend": 39200, "conversions": 502, "ctr": 1.02},
    {"date": "May 09", "spend": 42100, "conversions": 548, "ctr": 1.11},
    {"date": "May 10", "spend": 43800, "conversions": 566, "ctr": 1.08},
    {"date": "May 11", "spend": 47200, "conversions": 623, "ctr": 1.16},
    {"date": "May 12", "spend": 48900, "conversions": 681, "ctr": 1.28},
]


def _build_performance_trend() -> list[dict[str, Any]]:
    end_date = date(2026, 5, 12)
    historical_days = 23
    weekly_spend_wave = [0, 1200, 2600, 1800, 3200, 4600, 3900]
    rows: list[dict[str, Any]] = []

    for index in range(historical_days):
        current = end_date - timedelta(days=historical_days + len(PERFORMANCE_TREND_LAST_7) - index - 1)
        wave = weekly_spend_wave[index % len(weekly_spend_wave)]
        spend = 21200 + index * 520 + wave
        conversions = 238 + index * 7 + round(wave / 180)
        ctr = round(0.72 + index * 0.008 + (wave / 46000), 2)
        rows.append(
            {
                "date": current.strftime("%b %d"),
                "spend": spend,
                "conversions": conversions,
                "ctr": ctr,
            }
        )

    return rows + PERFORMANCE_TREND_LAST_7


PERFORMANCE_TREND = _build_performance_trend()

CHANNEL_MIX = [
    {"name": "Programmatic", "value": 42, "spend": 68100},
    {"name": "Paid Social", "value": 31, "spend": 51200},
    {"name": "CTV", "value": 17, "spend": 29750},
    {"name": "Search", "value": 10, "spend": 16400},
]

QUALITY_RADAR = [
    {"axis": "Brand Fit", "score": 92},
    {"axis": "Audience Match", "score": 88},
    {"axis": "Format Fit", "score": 84},
    {"axis": "Compliance", "score": 96},
    {"axis": "Predicted Lift", "score": 79},
]

ACTIVITY = [
    {"event": "The Trade Desk sync completed", "detail": "CAMP-1001 flight live across 42 line items", "time": "3m ago", "type": "sync"},
    {"event": "Creative quality gate passed", "detail": "CAD-001 cleared brand, legal, and format checks", "time": "18m ago", "type": "quality"},
    {"event": "Audience match rate moved +4.1pp", "detail": "Live Sports Loyalists refreshed from C360", "time": "42m ago", "type": "audience"},
    {"event": "Budget pacing alert", "detail": "Meta flight is 11 percent ahead of daily plan", "time": "1h ago", "type": "alert"},
]

MARKET_REGIONS = [
    {
        "id": "west",
        "name": "West Coast",
        "short_name": "West",
        "states": ["CA", "OR", "WA", "NV", "AZ"],
        "reach": 428000,
        "spend": 74400,
        "ctr": 1.34,
        "conversion_lift": 18.2,
        "priority": "Scale",
        "signal": "Sports affinity and annual-plan lookalikes are over-indexing in coastal metros.",
        "top_audience": "Live Sports Loyalists",
        "recommended_action": "Increase CTV and paid-social frequency caps for championship-week creative.",
        "cities": [
            {"name": "Los Angeles", "state": "CA", "x": 96, "y": 151, "reach": 128000, "ctr": 1.42, "lift": 21},
            {"name": "San Francisco", "state": "CA", "x": 82, "y": 105, "reach": 94000, "ctr": 1.37, "lift": 17},
            {"name": "Seattle", "state": "WA", "x": 91, "y": 54, "reach": 76000, "ctr": 1.24, "lift": 14},
            {"name": "Phoenix", "state": "AZ", "x": 141, "y": 169, "reach": 58000, "ctr": 1.16, "lift": 12},
        ],
        "trend": [
            {"week": "W1", "reach": 310000, "conversions": 510},
            {"week": "W2", "reach": 348000, "conversions": 598},
            {"week": "W3", "reach": 391000, "conversions": 670},
            {"week": "W4", "reach": 428000, "conversions": 762},
        ],
        "audience_mix": [
            {"name": "Sports Loyalists", "value": 38},
            {"name": "Premium Upgrade", "value": 29},
            {"name": "Family Co-View", "value": 20},
            {"name": "Winback", "value": 13},
        ],
    },
    {
        "id": "central",
        "name": "Central",
        "short_name": "Central",
        "states": ["TX", "OK", "KS", "CO", "MO", "AR", "LA"],
        "reach": 376000,
        "spend": 52650,
        "ctr": 1.08,
        "conversion_lift": 12.7,
        "priority": "Optimize",
        "signal": "Family co-viewing audiences respond to weekend slate messaging.",
        "top_audience": "Family Co-Viewing",
        "recommended_action": "Shift display and email creative toward household value bundles.",
        "cities": [
            {"name": "Dallas", "state": "TX", "x": 212, "y": 169, "reach": 103000, "ctr": 1.14, "lift": 14},
            {"name": "Houston", "state": "TX", "x": 219, "y": 196, "reach": 91000, "ctr": 1.06, "lift": 12},
            {"name": "Denver", "state": "CO", "x": 187, "y": 119, "reach": 72000, "ctr": 1.01, "lift": 9},
            {"name": "Kansas City", "state": "MO", "x": 246, "y": 129, "reach": 47000, "ctr": 0.95, "lift": 8},
        ],
        "trend": [
            {"week": "W1", "reach": 289000, "conversions": 390},
            {"week": "W2", "reach": 318000, "conversions": 421},
            {"week": "W3", "reach": 349000, "conversions": 486},
            {"week": "W4", "reach": 376000, "conversions": 540},
        ],
        "audience_mix": [
            {"name": "Family Co-View", "value": 34},
            {"name": "Sports Loyalists", "value": 27},
            {"name": "Trial Convert", "value": 22},
            {"name": "Winback", "value": 17},
        ],
    },
    {
        "id": "midwest",
        "name": "Midwest",
        "short_name": "Midwest",
        "states": ["IL", "MI", "WI", "MN", "IA", "IN", "OH"],
        "reach": 312000,
        "spend": 43800,
        "ctr": 0.97,
        "conversion_lift": 9.5,
        "priority": "Test",
        "signal": "Winback cohorts are sizable, but creative fatigue is rising in paid social.",
        "top_audience": "Churn Risk: Sports",
        "recommended_action": "Run offer-led A/B test and suppress high-fatigue households for 72 hours.",
        "cities": [
            {"name": "Chicago", "state": "IL", "x": 293, "y": 111, "reach": 112000, "ctr": 1.02, "lift": 11},
            {"name": "Detroit", "state": "MI", "x": 326, "y": 101, "reach": 64000, "ctr": 0.94, "lift": 8},
            {"name": "Minneapolis", "state": "MN", "x": 273, "y": 76, "reach": 52000, "ctr": 0.91, "lift": 7},
            {"name": "Cleveland", "state": "OH", "x": 333, "y": 119, "reach": 39000, "ctr": 0.88, "lift": 6},
        ],
        "trend": [
            {"week": "W1", "reach": 275000, "conversions": 350},
            {"week": "W2", "reach": 284000, "conversions": 362},
            {"week": "W3", "reach": 301000, "conversions": 391},
            {"week": "W4", "reach": 312000, "conversions": 421},
        ],
        "audience_mix": [
            {"name": "Winback", "value": 32},
            {"name": "Sports Loyalists", "value": 26},
            {"name": "Family Co-View", "value": 24},
            {"name": "Premium Upgrade", "value": 18},
        ],
    },
    {
        "id": "southeast",
        "name": "Southeast",
        "short_name": "SE",
        "states": ["FL", "GA", "NC", "SC", "TN", "AL", "MS"],
        "reach": 354000,
        "spend": 49850,
        "ctr": 1.19,
        "conversion_lift": 15.4,
        "priority": "Scale",
        "signal": "Live sports and family bundles are both beating national CPA targets.",
        "top_audience": "Live Sports Loyalists",
        "recommended_action": "Launch localized story creative around weekend live-event reminders.",
        "cities": [
            {"name": "Atlanta", "state": "GA", "x": 322, "y": 163, "reach": 96000, "ctr": 1.26, "lift": 17},
            {"name": "Miami", "state": "FL", "x": 365, "y": 213, "reach": 85000, "ctr": 1.18, "lift": 14},
            {"name": "Charlotte", "state": "NC", "x": 342, "y": 147, "reach": 61000, "ctr": 1.09, "lift": 12},
            {"name": "Nashville", "state": "TN", "x": 300, "y": 147, "reach": 43000, "ctr": 1.02, "lift": 10},
        ],
        "trend": [
            {"week": "W1", "reach": 271000, "conversions": 410},
            {"week": "W2", "reach": 303000, "conversions": 468},
            {"week": "W3", "reach": 334000, "conversions": 551},
            {"week": "W4", "reach": 354000, "conversions": 612},
        ],
        "audience_mix": [
            {"name": "Sports Loyalists", "value": 36},
            {"name": "Family Co-View", "value": 31},
            {"name": "Trial Convert", "value": 20},
            {"name": "Winback", "value": 13},
        ],
    },
    {
        "id": "northeast",
        "name": "Northeast",
        "short_name": "NE",
        "states": ["NY", "NJ", "PA", "MA", "CT", "MD", "VA"],
        "reach": 401000,
        "spend": 63500,
        "ctr": 1.11,
        "conversion_lift": 13.8,
        "priority": "Optimize",
        "signal": "Premium upgrade lookalikes are dense, with high CTV completion rates.",
        "top_audience": "Premium Upgrade Lookalikes",
        "recommended_action": "Prioritize annual-plan offer in CTV and retarget with display frequency controls.",
        "cities": [
            {"name": "New York", "state": "NY", "x": 371, "y": 104, "reach": 142000, "ctr": 1.17, "lift": 15},
            {"name": "Boston", "state": "MA", "x": 392, "y": 85, "reach": 68000, "ctr": 1.12, "lift": 13},
            {"name": "Philadelphia", "state": "PA", "x": 358, "y": 120, "reach": 59000, "ctr": 1.03, "lift": 10},
            {"name": "Washington", "state": "DC", "x": 352, "y": 134, "reach": 53000, "ctr": 1.08, "lift": 12},
        ],
        "trend": [
            {"week": "W1", "reach": 326000, "conversions": 470},
            {"week": "W2", "reach": 351000, "conversions": 520},
            {"week": "W3", "reach": 382000, "conversions": 601},
            {"week": "W4", "reach": 401000, "conversions": 665},
        ],
        "audience_mix": [
            {"name": "Premium Upgrade", "value": 37},
            {"name": "Sports Loyalists", "value": 28},
            {"name": "Winback", "value": 21},
            {"name": "Family Co-View", "value": 14},
        ],
    },
]

MOCK_RESPONSES = {
    "average ctr": {
        "title": "CTR by audience cohort",
        "rows": [
            {"Cohort": "Live Sports Loyalists", "CTR": "1.28%", "Conv. Rate": "14.0%"},
            {"Cohort": "Churn Risk: Sports", "CTR": "1.04%", "Conv. Rate": "12.0%"},
            {"Cohort": "Family Co-Viewing", "CTR": "0.82%", "Conv. Rate": "14.0%"},
        ],
    },
    "activation status": {
        "title": "Activations by platform",
        "rows": [
            {"Platform": "The Trade Desk", "Status": "Live", "Spend": "$68.4K"},
            {"Platform": "Meta", "Status": "Live", "Spend": "$51.2K"},
            {"Platform": "DV360", "Status": "Submitted", "Spend": "$29.8K"},
        ],
    },
    "quality": {
        "title": "Creative quality leaderboard",
        "rows": [
            {"Creative": "Championship Night Hero", "Score": "94", "Predicted CTR": "1.28%"},
            {"Creative": "Final Whistle Story", "Score": "91", "Predicted CTR": "1.04%"},
            {"Creative": "Family Slate DCO", "Score": "88", "Predicted CTR": "0.82%"},
        ],
    },
    "roi": {
        "title": "Campaign ROI snapshot",
        "rows": [
            {"Campaign": "Summer Campaign 2026", "Spend": "$119.6K", "Conversions": "1,211", "CPA": "$98.76"},
            {"Campaign": "Family Movie Nights", "Spend": "$29.8K", "Conversions": "246", "CPA": "$120.93"},
        ],
    },
}


def _parse_brief(row: dict[str, str]) -> dict[str, Any]:
    return {
        "brief_id": row["brief_id"],
        "brief_name": row["brief_name"],
        "brand_name": row["brand_name"],
        "campaign_objective": row["campaign_objective"],
        "target_audience_description": row["target_audience_description"],
        "status": row["status"],
        "created_ts": row["created_ts"],
        "concepts_count": _as_int(row["concepts_count"]),
        "creatives_count": _as_int(row["creatives_count"]),
        "budget": _as_int(row["budget"]),
        "owner": row["owner"],
    }


def _parse_audience(row: dict[str, str]) -> dict[str, Any]:
    return {
        "cohort_id": row["cohort_id"],
        "cohort_name": row["cohort_name"],
        "cohort_description": row["cohort_description"],
        "definition_type": row["definition_type"],
        "personalization_granularity": row["personalization_granularity"],
        "estimated_reach": _as_int(row["estimated_reach"]),
        "is_region_allowed": _as_bool(row["is_region_allowed"]),
        "is_channel_allowed": _as_bool(row["is_channel_allowed"]),
        "is_frequency_capped": _as_bool(row["is_frequency_capped"]),
        "status": row["status"],
        "last_updated_ts": row["last_updated_ts"],
        "match_rate": _as_float(row["match_rate"]),
        "avg_ltv": _as_int(row["avg_ltv"]),
    }


def _parse_creative(row: dict[str, str]) -> dict[str, Any]:
    return {
        "creative_asset_id": row["creative_asset_id"],
        "asset_name": row["asset_name"],
        "asset_type": row["asset_type"],
        "format": row["format"],
        "width_px": _as_int(row["width_px"]),
        "height_px": _as_int(row["height_px"]),
        "approval_status": row["approval_status"],
        "target_segment": row["target_segment"],
        "content_tags": _split_semicolon(row["content_tags"]),
        "generation_model": row["generation_model"],
        "created_at": row["created_at"],
        "quality_score": _as_int(row["quality_score"]),
        "predicted_ctr": _as_float(row["predicted_ctr"]),
    }


def _parse_activation(row: dict[str, str]) -> dict[str, Any]:
    return {
        "activation_id": row["activation_id"],
        "creative_asset_id": row["creative_asset_id"],
        "campaign_id": row["campaign_id"],
        "destination_platform": row["destination_platform"],
        "trafficking_status": row["trafficking_status"],
        "impressions": _as_int(row["impressions"]),
        "clicks": _as_int(row["clicks"]),
        "conversions": _as_int(row["conversions"]),
        "cost": _as_float(row["cost"]),
        "ab_test_id": _as_optional(row["ab_test_id"]),
        "last_sync_ts": row["last_sync_ts"],
    }


def _parse_performance_row(row: dict[str, str]) -> dict[str, Any]:
    return {
        "date": row["date"],
        "spend": _as_int(row["spend"]),
        "conversions": _as_int(row["conversions"]),
        "ctr": _as_float(row["ctr"]),
    }


def _parse_channel_row(row: dict[str, str]) -> dict[str, Any]:
    return {"name": row["name"], "value": _as_int(row["value"]), "spend": _as_int(row["spend"])}


def _parse_quality_row(row: dict[str, str]) -> dict[str, Any]:
    return {"axis": row["axis"], "score": _as_int(row["score"])}


def _parse_activity_row(row: dict[str, str]) -> dict[str, Any]:
    return {"event": row["event"], "detail": row["detail"], "time": row["time"], "type": row["type"]}


def _load_markets_from_csv(fallback: list[dict[str, Any]]) -> list[dict[str, Any]]:
    market_rows = _read_csv_rows("markets")
    if market_rows is None:
        DATA_LOAD_SOURCES["markets"]["rows"] = len(fallback)
        _read_csv_rows("market_cities")
        _read_csv_rows("market_trend")
        _read_csv_rows("market_audience_mix")
        return fallback

    cities_by_region: dict[str, list[dict[str, Any]]] = {}
    for row in _read_csv_rows("market_cities") or []:
        cities_by_region.setdefault(row["region_id"], []).append(
            {
                "name": row["name"],
                "state": row["state"],
                "reach": _as_int(row["reach"]),
                "ctr": _as_float(row["ctr"]),
                "lift": _as_int(row["lift"]),
            }
        )

    trend_by_region: dict[str, list[dict[str, Any]]] = {}
    for row in _read_csv_rows("market_trend") or []:
        trend_by_region.setdefault(row["region_id"], []).append(
            {
                "week": row["week"],
                "reach": _as_int(row["reach"]),
                "conversions": _as_int(row["conversions"]),
            }
        )

    mix_by_region: dict[str, list[dict[str, Any]]] = {}
    for row in _read_csv_rows("market_audience_mix") or []:
        mix_by_region.setdefault(row["region_id"], []).append({"name": row["name"], "value": _as_int(row["value"])})

    return [
        {
            "id": row["id"],
            "name": row["name"],
            "short_name": row["short_name"],
            "states": _split_semicolon(row["states"]),
            "reach": _as_int(row["reach"]),
            "spend": _as_int(row["spend"]),
            "ctr": _as_float(row["ctr"]),
            "conversion_lift": _as_float(row["conversion_lift"]),
            "priority": row["priority"],
            "signal": row["signal"],
            "top_audience": row["top_audience"],
            "recommended_action": row["recommended_action"],
            "cities": cities_by_region.get(row["id"], []),
            "trend": trend_by_region.get(row["id"], []),
            "audience_mix": mix_by_region.get(row["id"], []),
        }
        for row in market_rows
    ]


BRIEFS = _load_csv_table("briefs", BRIEFS, _parse_brief)
AUDIENCES = _load_csv_table("audiences", AUDIENCES, _parse_audience)
CREATIVES = _load_csv_table("creatives", CREATIVES, _parse_creative)
ACTIVATIONS = _load_csv_table("activations", ACTIVATIONS, _parse_activation)
PERFORMANCE_TREND = _load_csv_table("performance_trend", PERFORMANCE_TREND, _parse_performance_row)
CHANNEL_MIX = _load_csv_table("channel_mix", CHANNEL_MIX, _parse_channel_row)
QUALITY_RADAR = _load_csv_table("quality_radar", QUALITY_RADAR, _parse_quality_row)
ACTIVITY = _load_csv_table("activity", ACTIVITY, _parse_activity_row)
MARKET_REGIONS = _load_markets_from_csv(MARKET_REGIONS)


def _load_databricks_briefs() -> list[dict[str, Any]]:
    table = _source_table("gold_media_creative_briefs")
    rows = _execute_sql(
        f"""
        SELECT
          brief_id,
          brief_name,
          brand_name,
          objective AS campaign_objective,
          audience_description_text AS target_audience_description,
          initcap(replace(brief_status, '_', ' ')) AS status,
          date_format(created_ts, 'yyyy-MM-dd') AS created_ts,
          CAST(0 AS INT) AS concepts_count,
          CAST(0 AS INT) AS creatives_count,
          budget_usd AS budget,
          submitted_by AS owner
        FROM {table}
        ORDER BY created_ts DESC
        LIMIT 100
        """,
        row_limit=100,
    )
    briefs = [
        {
            "brief_id": _as_text(row.get("brief_id")),
            "brief_name": _as_text(row.get("brief_name"), "Untitled brief"),
            "brand_name": _as_text(row.get("brand_name"), "Unknown brand"),
            "campaign_objective": _as_text(row.get("campaign_objective"), "Not specified"),
            "target_audience_description": _as_text(row.get("target_audience_description"), "Not specified"),
            "status": _as_text(row.get("status"), "Draft"),
            "created_ts": _as_text(row.get("created_ts")),
            "concepts_count": _as_int_value(row.get("concepts_count")),
            "creatives_count": _as_int_value(row.get("creatives_count")),
            "budget": _as_float_value(row.get("budget")),
            "owner": _as_text(row.get("owner"), "Not assigned"),
        }
        for row in rows
    ]
    _table_source("briefs", table, len(briefs))
    return briefs


def _load_databricks_audiences() -> list[dict[str, Any]]:
    table = _pipeline_table("gold_buyside_audience_cohort")
    rows = _execute_sql(
        f"""
        SELECT
          cohort_id,
          cohort_name,
          cohort_description,
          definition_type,
          personalization_granularity,
          estimated_reach,
          is_region_allowed,
          is_channel_allowed,
          is_frequency_capped,
          status,
          date_format(last_refreshed_ts, 'yyyy-MM-dd') AS last_updated_ts,
          feature_summary_text
        FROM {table}
        ORDER BY estimated_reach DESC
        LIMIT 100
        """,
        row_limit=100,
    )
    audiences = [
        {
            "cohort_id": _as_text(row.get("cohort_id")),
            "cohort_name": _as_text(row.get("cohort_name"), "Untitled cohort"),
            "cohort_description": _as_text(row.get("cohort_description")),
            "definition_type": _as_text(row.get("definition_type"), "manual"),
            "personalization_granularity": _as_text(row.get("personalization_granularity"), "Segment"),
            "estimated_reach": _as_int_value(row.get("estimated_reach")),
            "is_region_allowed": _as_bool_value(row.get("is_region_allowed")),
            "is_channel_allowed": _as_bool_value(row.get("is_channel_allowed")),
            "is_frequency_capped": _as_bool_value(row.get("is_frequency_capped")),
            "status": _as_text(row.get("status"), "Active"),
            "last_updated_ts": _as_text(row.get("last_updated_ts")),
            "feature_summary_text": _as_text(row.get("feature_summary_text")),
        }
        for row in rows
    ]
    _table_source("audiences", table, len(audiences))
    return audiences


def _load_databricks_creatives() -> list[dict[str, Any]]:
    table = _pipeline_table("gold_buyside_generated_creatives")
    rows = _execute_sql(
        f"""
        SELECT
          creative_asset_id,
          asset_name,
          asset_type,
          upper(format) AS format,
          width_px,
          height_px,
          approval_status,
          target_segment,
          content_tags,
          generation_model,
          date_format(created_ts, 'yyyy-MM-dd') AS created_at
        FROM {table}
        ORDER BY created_ts DESC
        LIMIT 100
        """,
        row_limit=100,
    )
    creatives = [
        {
            "creative_asset_id": _as_text(row.get("creative_asset_id")),
            "asset_name": _as_text(row.get("asset_name"), "Untitled asset"),
            "asset_type": _as_text(row.get("asset_type"), "Image"),
            "format": _as_text(row.get("format"), "N/A"),
            "width_px": _as_int_value(row.get("width_px")),
            "height_px": _as_int_value(row.get("height_px")),
            "approval_status": _as_text(row.get("approval_status"), "Draft"),
            "target_segment": _as_text(row.get("target_segment"), "N/A"),
            "content_tags": _split_tags(row.get("content_tags")),
            "generation_model": _as_text(row.get("generation_model"), "N/A"),
            "created_at": _as_text(row.get("created_at")),
        }
        for row in rows
    ]
    _table_source("creatives", table, len(creatives))
    return creatives


def _load_databricks_activations() -> list[dict[str, Any]]:
    table = _pipeline_table("gold_buyside_campaign_activation")
    rows = _execute_sql(
        f"""
        SELECT
          activation_id,
          creative_asset_id,
          campaign_id,
          destination_platform,
          trafficking_status,
          impressions,
          clicks,
          conversions,
          cost,
          ab_test_id,
          date_format(last_sync_ts, 'yyyy-MM-dd HH:mm') AS last_sync_ts
        FROM {table}
        ORDER BY last_sync_ts DESC
        LIMIT 100
        """,
        row_limit=100,
    )
    activations = [
        {
            "activation_id": _as_text(row.get("activation_id")),
            "creative_asset_id": _as_text(row.get("creative_asset_id")),
            "campaign_id": _as_text(row.get("campaign_id")),
            "destination_platform": _as_text(row.get("destination_platform"), "Unknown"),
            "trafficking_status": _as_text(row.get("trafficking_status"), "Draft"),
            "impressions": _as_int_value(row.get("impressions")),
            "clicks": _as_int_value(row.get("clicks")),
            "conversions": _as_int_value(row.get("conversions")),
            "cost": _as_float_value(row.get("cost")),
            "ab_test_id": row.get("ab_test_id"),
            "last_sync_ts": _as_text(row.get("last_sync_ts")),
        }
        for row in rows
    ]
    _table_source("activations", table, len(activations))
    return activations


def _dashboard_trend_from_databricks() -> list[dict[str, Any]]:
    table = _pipeline_table("gold_buyside_campaign_activation")
    rows = _execute_sql(
        f"""
        SELECT
          to_date(last_sync_ts) AS sort_date,
          date_format(to_date(last_sync_ts), 'MMM dd') AS date,
          sum(cost) AS spend,
          sum(conversions) AS conversions,
          round(100 * sum(clicks) / nullif(sum(impressions), 0), 2) AS ctr
        FROM {table}
        GROUP BY to_date(last_sync_ts)
        ORDER BY sort_date
        LIMIT 30
        """,
        row_limit=30,
    )
    return [
        {
            "date": _as_text(row.get("date")),
            "spend": _as_float_value(row.get("spend")),
            "conversions": _as_int_value(row.get("conversions")),
            "ctr": _as_float_value(row.get("ctr")),
        }
        for row in rows
    ]


def _totals_for(
    briefs: list[dict[str, Any]],
    creatives: list[dict[str, Any]],
    activations: list[dict[str, Any]],
) -> dict[str, Any]:
    impressions = sum(_as_int_value(a.get("impressions")) for a in activations)
    clicks = sum(_as_int_value(a.get("clicks")) for a in activations)
    conversions = sum(_as_int_value(a.get("conversions")) for a in activations)
    spend = sum(_as_float_value(a.get("cost")) for a in activations)
    ctr = (clicks / impressions * 100) if impressions else 0
    cpa = (spend / conversions) if conversions else 0
    return {
        "impressions": impressions,
        "clicks": clicks,
        "conversions": conversions,
        "spend": spend,
        "ctr": round(ctr, 2),
        "cpa": round(cpa, 2),
        "active_briefs": len([b for b in briefs if _as_text(b.get("status")).lower() in {"active", "activated"}]),
        "approved_creatives": len([c for c in creatives if c.get("approval_status") == "Approved"]),
    }


def _channel_mix_from(activations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    spend_by_platform: dict[str, float] = {}
    for activation in activations:
        platform = _as_text(activation.get("destination_platform"), "Unknown")
        spend_by_platform[platform] = spend_by_platform.get(platform, 0.0) + _as_float_value(activation.get("cost"))

    total_spend = sum(spend_by_platform.values()) or 1
    return [
        {
            "name": platform,
            "value": round(spend / total_spend * 100),
            "spend": round(spend, 2),
        }
        for platform, spend in sorted(spend_by_platform.items(), key=lambda item: item[1], reverse=True)[:8]
    ]


def _activity_from(activations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for activation in activations[:6]:
        platform = _as_text(activation.get("destination_platform"), "Platform")
        status = _as_text(activation.get("trafficking_status"), "updated")
        rows.append(
            {
                "event": f"{platform} activation {status.lower()}",
                "detail": f"{activation.get('campaign_id')} / {activation.get('creative_asset_id')} synced from pipeline data",
                "time": _as_text(activation.get("last_sync_ts"), "recently"),
                "type": "sync" if status in {"Live", "Submitted"} else "alert",
            }
        )
    return rows or ACTIVITY


def _csv_runtime_data() -> dict[str, Any]:
    return {
        "briefs": BRIEFS,
        "audiences": AUDIENCES,
        "creatives": CREATIVES,
        "activations": ACTIVATIONS,
        "markets": MARKET_REGIONS,
        "dashboard": {
            "totals": _totals_for(BRIEFS, CREATIVES, ACTIVATIONS),
            "trend": PERFORMANCE_TREND,
            "channel_mix": CHANNEL_MIX,
            "quality_radar": QUALITY_RADAR,
            "activity": ACTIVITY,
        },
    }


@lru_cache(maxsize=1)
def _runtime_data() -> dict[str, Any]:
    data = _csv_runtime_data()
    if not USE_PIPELINE_DATA:
        return data

    loaders: list[tuple[str, Callable[[], list[dict[str, Any]]]]] = [
        ("briefs", _load_databricks_briefs),
        ("audiences", _load_databricks_audiences),
        ("creatives", _load_databricks_creatives),
        ("activations", _load_databricks_activations),
    ]
    for key, loader in loaders:
        try:
            data[key] = loader()
        except Exception as exc:
            _table_error(key, exc)

    try:
        trend = _dashboard_trend_from_databricks()
        DATA_LOAD_SOURCES["performance_trend"] = {
            "source": "databricks_sql",
            "path": f"{PIPELINE_CATALOG}.{PIPELINE_SCHEMA}.gold_buyside_campaign_activation",
            "rows": len(trend),
            "loaded": True,
        }
    except Exception as exc:
        _table_error("performance_trend", exc)
        trend = PERFORMANCE_TREND

    if data["activations"] is ACTIVATIONS:
        channel_mix = CHANNEL_MIX
    else:
        channel_mix = _channel_mix_from(data["activations"])
        DATA_LOAD_SOURCES["channel_mix"] = {
            "source": "databricks_sql",
            "path": f"{PIPELINE_CATALOG}.{PIPELINE_SCHEMA}.gold_buyside_campaign_activation",
            "rows": len(channel_mix),
            "loaded": bool(channel_mix),
        }

    data["dashboard"] = {
        "totals": _totals_for(data["briefs"], data["creatives"], data["activations"]),
        "trend": trend,
        "channel_mix": channel_mix or CHANNEL_MIX,
        "quality_radar": QUALITY_RADAR,
        "activity": _activity_from(data["activations"]),
    }
    return data


BACKEND_TABLES = [
    {
        "name": "briefs",
        "endpoint": "/api/briefs",
        "lakehouse_table": "gold_media_creative_briefs",
        "description": "Campaign brief intake, objectives, budgets, status, and owner context.",
    },
    {
        "name": "audiences",
        "endpoint": "/api/audiences",
        "lakehouse_table": "gold_buyside_audience_cohort",
        "description": "Audience lens cohorts with reach, match rate, value, and governance flags.",
    },
    {
        "name": "creatives",
        "endpoint": "/api/creatives",
        "lakehouse_table": "gold_buyside_generated_creatives",
        "description": "Generated creative assets with approval, quality, and predicted CTR fields.",
    },
    {
        "name": "activations",
        "endpoint": "/api/activations",
        "lakehouse_table": "gold_buyside_campaign_activation",
        "description": "Trafficking status, platform delivery, cost, clicks, and conversion metrics.",
    },
    {
        "name": "performance_trend",
        "endpoint": "/api/dashboard",
        "lakehouse_table": "gold_activation_kpi",
        "description": "Dashboard pacing curve for spend, conversions, and CTR.",
    },
    {
        "name": "channel_mix",
        "endpoint": "/api/dashboard",
        "lakehouse_table": "gold_channel_investment_mix",
        "description": "Channel allocation and spend mix for the overview dashboard.",
    },
    {
        "name": "quality_radar",
        "endpoint": "/api/dashboard",
        "lakehouse_table": "gold_creative_quality_scorecard",
        "description": "Creative quality gate scores used by the overview radar.",
    },
    {
        "name": "activity",
        "endpoint": "/api/dashboard",
        "lakehouse_table": "gold_campaign_activity_stream",
        "description": "Operational activity feed for campaign sync, quality, and alert events.",
    },
    {
        "name": "markets",
        "endpoint": "/api/markets",
        "lakehouse_table": "gold_market_opportunity",
        "description": "Regional opportunity, recommendation, and media signal summary.",
    },
    {
        "name": "market_cities",
        "endpoint": "/api/markets",
        "lakehouse_table": "gold_market_metro_detail",
        "description": "Metro-level reach and performance details embedded in market responses.",
    },
    {
        "name": "market_trend",
        "endpoint": "/api/markets",
        "lakehouse_table": "gold_market_reach_trend",
        "description": "Four-week regional reach and conversion trend embedded in market responses.",
    },
    {
        "name": "market_audience_mix",
        "endpoint": "/api/markets",
        "lakehouse_table": "gold_market_audience_mix",
        "description": "Regional audience mix percentages embedded in market responses.",
    },
]


class AskRequest(BaseModel):
    question: str


def _totals() -> dict[str, Any]:
    return _totals_for(BRIEFS, CREATIVES, ACTIVATIONS)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/backend-tables")
async def backend_tables() -> dict[str, Any]:
    _runtime_data()
    return {
        "data_source": "databricks_sql" if USE_PIPELINE_DATA else "csv_extract",
        "data_dir": _display_path(SAMPLE_DATA_DIR),
        "catalog": PIPELINE_CATALOG,
        "schema": PIPELINE_SCHEMA,
        "source_catalog": SOURCE_CATALOG,
        "source_schema": SOURCE_SCHEMA,
        "bundle_ready": True,
        "errors": DATA_BACKEND_ERRORS,
        "tables": [
            {
                **table,
                **DATA_LOAD_SOURCES.get(
                    table["name"],
                    {
                        "source": "unknown",
                        "path": None,
                        "rows": 0,
                        "loaded": False,
                    },
                ),
            }
            for table in BACKEND_TABLES
        ],
    }


@app.get("/api/model-status")
async def model_status() -> dict[str, Any]:
    endpoint_name = (
        os.getenv("AUDIENCE_MODEL_SERVING_ENDPOINT")
        or os.getenv("DATABRICKS_MODEL_SERVING_ENDPOINT")
        or os.getenv("MODEL_SERVING_ENDPOINT")
    )
    return {
        "audience_lens_uses_model_serving": False,
        "serving_endpoint_configured": bool(endpoint_name),
        "configured_endpoint": endpoint_name,
        "mode": "databricks_sql_pipeline_backend" if USE_PIPELINE_DATA else "csv_sample_backend",
        "checked_path": "/api/audiences",
        "verified": True,
        "evidence": [
            "The Audience lens fetches /api/audiences through the FastAPI backend.",
            (
                "The FastAPI /api/audiences handler reads Databricks pipeline tables through SQL Warehouse."
                if USE_PIPELINE_DATA
                else "The FastAPI /api/audiences handler returns bundled CSV sample rows."
            ),
            "This branch has no server-side call to a Databricks Model Serving endpoint for Audience lens scoring.",
        ],
    }


@app.get("/api/dashboard")
async def dashboard() -> dict[str, Any]:
    return _runtime_data()["dashboard"]


@app.get("/api/briefs")
async def briefs() -> list[dict[str, Any]]:
    return _runtime_data()["briefs"]


@app.get("/api/audiences")
async def audiences() -> list[dict[str, Any]]:
    return _runtime_data()["audiences"]


@app.get("/api/creatives")
async def creatives() -> list[dict[str, Any]]:
    return _runtime_data()["creatives"]


@app.get("/api/activations")
async def activations() -> list[dict[str, Any]]:
    return _runtime_data()["activations"]


@app.get("/api/markets")
async def markets() -> list[dict[str, Any]]:
    return _runtime_data()["markets"]


@app.post("/api/ask")
async def ask(payload: AskRequest) -> dict[str, Any]:
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    lower = question.lower()
    response = next((value for key, value in MOCK_RESPONSES.items() if key in lower), None)
    return {
        "answer": "Here is the agency desk view for that query." if response else "No exact mock match was found. In production this endpoint would query Genie and governed Lakehouse tables.",
        "result": response,
    }


if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/{full_path:path}")
async def serve_app(full_path: str) -> Any:
    index = DIST / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"message": "Frontend has not been built yet. Run npm run build, or use npm run dev for local development."}


if __name__ == "__main__":
    port = int(os.getenv("DATABRICKS_APP_PORT", os.getenv("PORT", "8000")))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
