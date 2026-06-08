from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import main as demo  # noqa: E402


CATALOG = os.getenv("PIPELINE_CATALOG", os.getenv("DATABRICKS_CATALOG", "cme_outcomes_uswest"))
SCHEMA = os.getenv("PIPELINE_SCHEMA", os.getenv("DATABRICKS_SCHEMA", "lakefoundry"))
WAREHOUSE_ID = os.getenv("DATABRICKS_WAREHOUSE_ID", "8d3ba577483125f2")
APP_SERVICE_PRINCIPAL_NAME = os.getenv("APP_SERVICE_PRINCIPAL_NAME", "120c3426-7b9b-4f7a-b72f-d194a356a8ed")


def _market_opportunity_rows() -> list[dict[str, Any]]:
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "short_name": row["short_name"],
            "states_json": json.dumps(row["states"]),
            "reach": row["reach"],
            "spend": row["spend"],
            "ctr": row["ctr"],
            "conversion_lift": row["conversion_lift"],
            "priority": row["priority"],
            "signal": row["signal"],
            "top_audience": row["top_audience"],
            "recommended_action": row["recommended_action"],
        }
        for row in demo.MARKET_REGIONS
    ]


def _market_city_rows() -> list[dict[str, Any]]:
    return [
        {"region_id": region["id"], **city}
        for region in demo.MARKET_REGIONS
        for city in region.get("cities", [])
    ]


def _market_trend_rows() -> list[dict[str, Any]]:
    return [
        {"region_id": region["id"], **point}
        for region in demo.MARKET_REGIONS
        for point in region.get("trend", [])
    ]


def _market_audience_mix_rows() -> list[dict[str, Any]]:
    return [
        {"region_id": region["id"], **item}
        for region in demo.MARKET_REGIONS
        for item in region.get("audience_mix", [])
    ]


TABLES: dict[str, list[dict[str, Any]]] = {
    "gold_creative_quality_scorecard": demo.QUALITY_RADAR,
    "gold_campaign_activity_stream": demo.ACTIVITY,
    "gold_market_opportunity": _market_opportunity_rows(),
    "gold_market_metro_detail": _market_city_rows(),
    "gold_market_reach_trend": _market_trend_rows(),
    "gold_market_audience_mix": _market_audience_mix_rows(),
    "gold_buyside_brand_guideline_profile": demo.BRAND_GUIDELINES,
    "gold_buyside_generation_model_option": demo.GENERATION_MODEL_OPTIONS,
    "gold_buyside_audience_demographic_signal": demo.AUDIENCE_DEMOGRAPHIC_SIGNALS,
    "gold_buyside_purchase_intent_signal": demo.PURCHASE_INTENT_SIGNALS,
    "gold_buyside_synthetic_eval_rubric": demo.EVALUATION_RUBRICS,
    "gold_buyside_evaluation_channel_matrix": demo._evaluation_channel_matrix_rows(
        {
            "variants": demo._demo_variants(),
            "evaluations": demo._demo_evaluations(),
            "evaluation_rubrics": demo.EVALUATION_RUBRICS,
        }
    ),
}


def _sql_identifier(value: str) -> str:
    return "`" + value.replace("`", "``") + "`"


def _full_name(table: str) -> str:
    return ".".join(_sql_identifier(part) for part in [CATALOG, SCHEMA, table])


def _columns(rows: list[dict[str, Any]]) -> list[str]:
    columns: list[str] = []
    for row in rows:
        for key in row:
            if key not in columns:
                columns.append(key)
    return columns


def _column_type(rows: list[dict[str, Any]], column: str) -> str:
    values = [row.get(column) for row in rows if row.get(column) is not None]
    if values and all(isinstance(value, bool) for value in values):
        return "BOOLEAN"
    if values and all(isinstance(value, int) and not isinstance(value, bool) for value in values):
        return "BIGINT"
    if values and all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in values):
        return "DOUBLE"
    return "STRING"


def _literal(value: Any, sql_type: str) -> str:
    if value is None:
        return f"CAST(NULL AS {sql_type})"
    if sql_type == "BOOLEAN":
        return "true" if bool(value) else "false"
    if sql_type in {"BIGINT", "DOUBLE"}:
        return str(value)
    if isinstance(value, (dict, list)):
        value = json.dumps(value, default=str, sort_keys=True)
    return "'" + str(value).replace("'", "''") + "'"


def _execute_sql(statement: str) -> None:
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.service.sql import (
        Disposition,
        ExecuteStatementRequestOnWaitTimeout,
        Format,
        StatementState,
    )

    client = WorkspaceClient()
    response = client.statement_execution.execute_statement(
        statement=statement,
        warehouse_id=WAREHOUSE_ID,
        catalog=CATALOG,
        schema=SCHEMA,
        disposition=Disposition.INLINE,
        format=Format.JSON_ARRAY,
        wait_timeout="30s",
        on_wait_timeout=ExecuteStatementRequestOnWaitTimeout.CONTINUE,
    )
    deadline = time.time() + 180
    while response.status and response.status.state in {StatementState.PENDING, StatementState.RUNNING}:
        if not response.statement_id or time.time() > deadline:
            raise TimeoutError("Databricks SQL statement did not finish in time")
        time.sleep(1)
        response = client.statement_execution.get_statement(response.statement_id)
    if response.status and response.status.state != StatementState.SUCCEEDED:
        error = getattr(response.status, "error", None)
        message = getattr(error, "message", None) or response.status.state.value
        raise RuntimeError(message)


def _refresh_table(table: str, rows: list[dict[str, Any]]) -> None:
    if not rows:
        raise ValueError(f"No seed rows configured for {table}")

    columns = _columns(rows)
    types = {column: _column_type(rows, column) for column in columns}
    definition = ", ".join(f"{_sql_identifier(column)} {types[column]}" for column in columns)
    full_name = _full_name(table)
    _execute_sql(f"CREATE TABLE IF NOT EXISTS {full_name} ({definition}) USING DELTA")
    _execute_sql(f"DELETE FROM {full_name}")

    target_columns = ", ".join(_sql_identifier(column) for column in columns)
    values = []
    for row in rows:
        values.append("(" + ", ".join(_literal(row.get(column), types[column]) for column in columns) + ")")
    _execute_sql(f"INSERT INTO {full_name} ({target_columns}) VALUES " + ", ".join(values))
    print(f"refreshed {CATALOG}.{SCHEMA}.{table}: {len(rows)} rows")


def _grant_app_access(table: str) -> None:
    if not APP_SERVICE_PRINCIPAL_NAME:
        return
    principal = _sql_identifier(APP_SERVICE_PRINCIPAL_NAME)
    _execute_sql(f"GRANT USE CATALOG ON CATALOG {_sql_identifier(CATALOG)} TO {principal}")
    _execute_sql(f"GRANT USE SCHEMA ON SCHEMA {_sql_identifier(CATALOG)}.{_sql_identifier(SCHEMA)} TO {principal}")
    _execute_sql(f"GRANT SELECT ON TABLE {_full_name(table)} TO {principal}")
    print(f"granted SELECT on {CATALOG}.{SCHEMA}.{table} to {APP_SERVICE_PRINCIPAL_NAME}")


def _grant_volume_access() -> None:
    if not APP_SERVICE_PRINCIPAL_NAME:
        return
    principal = _sql_identifier(APP_SERVICE_PRINCIPAL_NAME)
    _execute_sql(f"GRANT READ_VOLUME ON VOLUME {_sql_identifier(CATALOG)}.{_sql_identifier(SCHEMA)}.`artifacts` TO {principal}")
    print(f"granted READ_VOLUME on {CATALOG}.{SCHEMA}.artifacts to {APP_SERVICE_PRINCIPAL_NAME}")


def main() -> None:
    _grant_volume_access()
    for table, rows in TABLES.items():
        _refresh_table(table, rows)
        _grant_app_access(table)


if __name__ == "__main__":
    main()
