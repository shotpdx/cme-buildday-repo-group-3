from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"

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


class AskRequest(BaseModel):
    question: str


def _totals() -> dict[str, Any]:
    impressions = sum(a["impressions"] for a in ACTIVATIONS)
    clicks = sum(a["clicks"] for a in ACTIVATIONS)
    conversions = sum(a["conversions"] for a in ACTIVATIONS)
    spend = sum(a["cost"] for a in ACTIVATIONS)
    ctr = (clicks / impressions * 100) if impressions else 0
    cpa = (spend / conversions) if conversions else 0
    return {
        "impressions": impressions,
        "clicks": clicks,
        "conversions": conversions,
        "spend": spend,
        "ctr": round(ctr, 2),
        "cpa": round(cpa, 2),
        "active_briefs": len([b for b in BRIEFS if b["status"] == "Active"]),
        "approved_creatives": len([c for c in CREATIVES if c["approval_status"] == "Approved"]),
    }


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/dashboard")
async def dashboard() -> dict[str, Any]:
    return {
        "totals": _totals(),
        "trend": PERFORMANCE_TREND,
        "channel_mix": CHANNEL_MIX,
        "quality_radar": QUALITY_RADAR,
        "activity": ACTIVITY,
    }


@app.get("/api/briefs")
async def briefs() -> list[dict[str, Any]]:
    return BRIEFS


@app.get("/api/audiences")
async def audiences() -> list[dict[str, Any]]:
    return AUDIENCES


@app.get("/api/creatives")
async def creatives() -> list[dict[str, Any]]:
    return CREATIVES


@app.get("/api/activations")
async def activations() -> list[dict[str, Any]]:
    return ACTIVATIONS


@app.get("/api/markets")
async def markets() -> list[dict[str, Any]]:
    return MARKET_REGIONS


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
