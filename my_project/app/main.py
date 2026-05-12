from __future__ import annotations

import os
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

app = FastAPI(title="Creative Activation Command Center API", version="1.0.0")

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

PERFORMANCE_TREND = [
    {"date": "May 06", "spend": 34000, "conversions": 391, "ctr": 0.83},
    {"date": "May 07", "spend": 36500, "conversions": 430, "ctr": 0.91},
    {"date": "May 08", "spend": 39200, "conversions": 502, "ctr": 1.02},
    {"date": "May 09", "spend": 42100, "conversions": 548, "ctr": 1.11},
    {"date": "May 10", "spend": 43800, "conversions": 566, "ctr": 1.08},
    {"date": "May 11", "spend": 47200, "conversions": 623, "ctr": 1.16},
    {"date": "May 12", "spend": 48900, "conversions": 681, "ctr": 1.28},
]

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
