from __future__ import annotations

import os
import base64
import csv
import io
import json
import mimetypes
import time
import uuid
from datetime import date, timedelta
from functools import lru_cache
from html import escape
from pathlib import Path
from typing import Any, Callable, Optional
from urllib.parse import quote

import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
DEMO_VIDEO_ASSET_DIR = Path(os.getenv("DEMO_VIDEO_ASSET_DIR", ROOT / "app" / "video_assets"))
if not DEMO_VIDEO_ASSET_DIR.is_absolute():
    DEMO_VIDEO_ASSET_DIR = ROOT / DEMO_VIDEO_ASSET_DIR
DEMO_VIDEO_ASSET = DEMO_VIDEO_ASSET_DIR / "demo_end_card_preview.mp4"
DEMO_VIDEO_SEED_DIR = Path(os.getenv("DEMO_VIDEO_SEED_DIR", DEMO_VIDEO_ASSET_DIR / "seeds"))
if not DEMO_VIDEO_SEED_DIR.is_absolute():
    DEMO_VIDEO_SEED_DIR = ROOT / DEMO_VIDEO_SEED_DIR
SAMPLE_DATA_DIR = Path(os.getenv("SAMPLE_DATA_DIR", "sample_data"))
if not SAMPLE_DATA_DIR.is_absolute():
    SAMPLE_DATA_DIR = ROOT / SAMPLE_DATA_DIR
DATA_LOAD_SOURCES: dict[str, dict[str, Any]] = {}
DATA_BACKEND_ERRORS: list[str] = []
LIVE_ACTIVATION_SUBMISSIONS: list[dict[str, Any]] = []
LIVE_GENERATION_REQUESTS: list[dict[str, Any]] = []
LIVE_CREATIVE_VARIANTS: list[dict[str, Any]] = []
LIVE_CREATIVE_TRANSFORMATIONS: list[dict[str, Any]] = []
LIVE_SYNTHETIC_EVALUATIONS: list[dict[str, Any]] = []

APP_DATA_SOURCE = os.getenv("APP_DATA_SOURCE", os.getenv("DATA_SOURCE", "csv")).strip().lower()
USE_PIPELINE_DATA = APP_DATA_SOURCE in {"databricks", "pipeline", "warehouse"} or os.getenv(
    "USE_PIPELINE_DATA", ""
).strip().lower() in {"1", "true", "yes", "y"}
PIPELINE_CATALOG = os.getenv("PIPELINE_CATALOG", os.getenv("DATABRICKS_CATALOG", "cme_outcomes_uswest"))
PIPELINE_SCHEMA = os.getenv("PIPELINE_SCHEMA", os.getenv("DATABRICKS_SCHEMA", "lakefoundry"))
SOURCE_CATALOG = os.getenv("SOURCE_CATALOG", os.getenv("PIPELINE_SOURCE_CATALOG", PIPELINE_CATALOG))
SOURCE_SCHEMA = os.getenv("SOURCE_SCHEMA", os.getenv("PIPELINE_SOURCE_SCHEMA", "media_demo"))
CREATIVE_GENERATION_MODE = os.getenv("CREATIVE_GENERATION_MODE", "model_endpoint").strip().lower()
CREATIVE_MODEL_ENDPOINT = (
    os.getenv("CREATIVE_MODEL_ENDPOINT")
    or os.getenv("DATABRICKS_MODEL_SERVING_ENDPOINT")
    or "databricks-gpt-5-mini"
).strip()
CREATIVE_JUDGE_MODEL_ENDPOINT = os.getenv("CREATIVE_JUDGE_MODEL_ENDPOINT", CREATIVE_MODEL_ENDPOINT).strip()
CREATIVE_POLICY_MODEL_ENDPOINT = os.getenv("CREATIVE_POLICY_MODEL_ENDPOINT", CREATIVE_MODEL_ENDPOINT).strip()
CREATIVE_IMAGE_MODEL = os.getenv("CREATIVE_IMAGE_MODEL", "seeded synthetic image assets").strip()
CREATIVE_MODEL_ENDPOINT_TIMEOUT_SECONDS = float(os.getenv("CREATIVE_MODEL_ENDPOINT_TIMEOUT_SECONDS", "6"))
CREATIVE_ASSET_VOLUME = os.getenv("CREATIVE_ASSET_VOLUME", "artifacts")
CREATIVE_ASSET_PREFIX = os.getenv("CREATIVE_ASSET_PREFIX", "creative_assets").strip().strip("/")
CREATIVE_APPROVED_ASSET_PREFIX = os.getenv("CREATIVE_APPROVED_ASSET_PREFIX", "approved").strip().strip("/")
CREATIVE_SEED_IMAGE_PATH = os.getenv("CREATIVE_SEED_IMAGE_PATH", "").strip()
CREATIVE_VIDEO_SEED_PATH = os.getenv("CREATIVE_VIDEO_SEED_PATH", "").strip()
CREATIVE_VECTOR_SEARCH_ENDPOINT = os.getenv("CREATIVE_VECTOR_SEARCH_ENDPOINT", "creative-asset-search-dev")
CREATIVE_VECTOR_SEARCH_INDEX = os.getenv(
    "CREATIVE_VECTOR_SEARCH_INDEX",
    f"{PIPELINE_CATALOG}.{PIPELINE_SCHEMA}.creative_asset_search_index",
)
ACTIVATION_DESTINATION_SYSTEM = os.getenv("ACTIVATION_DESTINATION_SYSTEM", "onsite_personalization")
APP_STATE_BACKEND = os.getenv("APP_STATE_BACKEND", "lakebase").strip().lower()
LAKEBASE_INSTANCE_NAME = os.getenv("LAKEBASE_INSTANCE_NAME", "").strip()
LAKEBASE_DATABASE_NAME = os.getenv("LAKEBASE_DATABASE_NAME", os.getenv("PGDATABASE", "postgres")).strip() or "postgres"
ASK_AI_BACKEND = os.getenv("ASK_AI_BACKEND", "genie").strip().lower()
GENIE_SPACE_ID = os.getenv("GENIE_SPACE_ID", "").strip()
GENIE_TIMEOUT_SECONDS = int(float(os.getenv("GENIE_TIMEOUT_SECONDS", "120")))
UC_EXTERNAL_LINEAGE_ENABLED = os.getenv("UC_EXTERNAL_LINEAGE_ENABLED", "false").strip().lower() in {
    "1",
    "true",
    "yes",
    "y",
}
UC_EXTERNAL_LINEAGE_SYSTEM_TYPE = os.getenv("UC_EXTERNAL_LINEAGE_SYSTEM_TYPE", "DATABRICKS").strip() or "DATABRICKS"
UC_EXTERNAL_LINEAGE_ENTITY_TYPE = os.getenv("UC_EXTERNAL_LINEAGE_ENTITY_TYPE", "CreativeGenerationJob").strip() or "CreativeGenerationJob"
UC_EXTERNAL_LINEAGE_TARGET_TABLE = os.getenv("UC_EXTERNAL_LINEAGE_TARGET_TABLE", "gold_buyside_creative_variant").strip()

GENIE_RECOMMENDED_QUESTIONS_FALLBACK = [
    "Which of these creatives is most likely to resonate with boomers in the Midwest?",
    "How is creative VAR-000011 performing against Live Sports Loyalists?",
    "Which creative performs best for millennials versus boomers?",
    "Which generated variant has the strongest purchase intent signal?",
    "Which generation model produced the strongest approved creative?",
    "Which base creative assets are approved for homepage hero placements for sports audiences?",
    "Which policy checks are blocked, warning, or require review, and what evidence was recorded?",
    "Which pending review variants are missing policy checks or synthetic audience evaluations?",
    "Where did live performance differ most from synthetic audience predictions?",
    "Which briefs have generated variants, approved winners, policy checks, and activation exports?",
    "Which creatives are ready for onsite personalization activation exports?",
    "Which base assets have rights constraints that block social or newsletter usage?",
    "What audience traits should influence creative direction for churn-risk sports cohorts?",
    "Which generation model endpoints produced the current variants, and which variants are approved?",
    "Which approved creative variants rank highest by segment and placement?",
    "Compare synthetic audience scores by placement, cohort, and creative variant.",
    "What transformations were applied to each creative variant, including crop, inpaint, outpaint, and aspect-ratio conversion?",
]

PLACEMENT_SPECS: dict[str, dict[str, Any]] = {
    "homepage_hero": {
        "label": "Homepage hero",
        "aspect_ratio": "16:9",
        "width_px": 1280,
        "height_px": 720,
        "channels": ["web", "onsite_personalization"],
        "safe_area": {"x_pct": 8, "y_pct": 12, "width_pct": 54, "height_pct": 42},
    },
    "app_tile": {
        "label": "App tile",
        "aspect_ratio": "1:1",
        "width_px": 1080,
        "height_px": 1080,
        "channels": ["app", "onsite_personalization"],
        "safe_area": {"x_pct": 10, "y_pct": 12, "width_pct": 76, "height_pct": 48},
    },
    "newsletter_banner": {
        "label": "Newsletter banner",
        "aspect_ratio": "6:1",
        "width_px": 1200,
        "height_px": 200,
        "channels": ["email"],
        "safe_area": {"x_pct": 6, "y_pct": 18, "width_pct": 68, "height_pct": 56},
    },
    "social_square": {
        "label": "Social unit",
        "aspect_ratio": "1:1",
        "width_px": 1080,
        "height_px": 1080,
        "channels": ["social"],
        "safe_area": {"x_pct": 9, "y_pct": 10, "width_pct": 74, "height_pct": 54},
    },
    "story_unit": {
        "label": "Story",
        "aspect_ratio": "9:16",
        "width_px": 1080,
        "height_px": 1920,
        "channels": ["social", "app"],
        "safe_area": {"x_pct": 8, "y_pct": 16, "width_pct": 78, "height_pct": 58},
    },
    "ctv_15s": {
        "label": "CTV 15s end card",
        "aspect_ratio": "16:9",
        "width_px": 1920,
        "height_px": 1080,
        "channels": ["ctv", "video", "programmatic"],
        "safe_area": {"x_pct": 9, "y_pct": 14, "width_pct": 54, "height_pct": 46},
    },
    "youtube_15s": {
        "label": "YouTube 15s end card",
        "aspect_ratio": "16:9",
        "width_px": 1920,
        "height_px": 1080,
        "channels": ["social_video", "video", "programmatic"],
        "safe_area": {"x_pct": 8, "y_pct": 14, "width_pct": 58, "height_pct": 48},
    },
    "social_video_15s": {
        "label": "Social video 15s end card",
        "aspect_ratio": "9:16",
        "width_px": 1080,
        "height_px": 1920,
        "channels": ["social_video", "app"],
        "safe_area": {"x_pct": 8, "y_pct": 18, "width_pct": 78, "height_pct": 52},
    },
}

EDIT_OPERATION_LABELS: dict[str, str] = {
    "resize": "Resize",
    "crop": "Crop",
    "inpaint": "Inpaint",
    "outpaint": "Outpaint",
    "cleanup": "Cleanup",
    "background_extension": "Background extension",
    "text_safe_area_adjustment": "Text-safe-area adjustment",
    "aspect_ratio_conversion": "Aspect-ratio conversion",
    "video_end_card_overlay": "Video end-card overlay",
    "cta_overlay": "CTA overlay",
}

VIDEO_TREATMENTS = [
    {
        "treatment_id": "stadium-glow",
        "name": "Stadium glow",
        "accent": "#0f9f95",
        "secondary": "#256b8f",
        "filter_css": "saturate(1.08) contrast(1.06)",
        "overlay_position": "left",
        "motion": "slow push-in",
        "badge": "live energy",
    },
    {
        "treatment_id": "cinema-warmth",
        "name": "Cinema warmth",
        "accent": "#c7793a",
        "secondary": "#7c4d2d",
        "filter_css": "saturate(1.15) contrast(1.02) sepia(0.14)",
        "overlay_position": "right",
        "motion": "soft reveal",
        "badge": "family night",
    },
    {
        "treatment_id": "premium-focus",
        "name": "Premium focus",
        "accent": "#5b65d8",
        "secondary": "#13212d",
        "filter_css": "saturate(0.94) contrast(1.14) brightness(0.94)",
        "overlay_position": "center",
        "motion": "spotlight hold",
        "badge": "premium",
    },
    {
        "treatment_id": "value-signal",
        "name": "Value signal",
        "accent": "#1f9d72",
        "secondary": "#0f766e",
        "filter_css": "saturate(1.04) contrast(1.08) hue-rotate(8deg)",
        "overlay_position": "left",
        "motion": "CTA lift",
        "badge": "upgrade",
    },
    {
        "treatment_id": "event-return",
        "name": "Event return",
        "accent": "#256b8f",
        "secondary": "#071523",
        "filter_css": "saturate(1.10) contrast(1.10) brightness(0.92)",
        "overlay_position": "right",
        "motion": "countdown pulse",
        "badge": "winback",
    },
]

VIDEO_COPY_VARIATIONS = [
    ("{base}", "{cta}"),
    ("{base} Tonight feels bigger.", "Watch now"),
    ("{base} Built for the big screen.", "See the lineup"),
    ("{base} Don't miss the next moment.", "Stream tonight"),
]

CREATIVE_VISUAL_TREATMENTS = [
    {
        "treatment_id": "live-hero",
        "name": "Live hero",
        "accent": "#0f9f95",
        "secondary": "#256b8f",
        "layout": "left-panel",
        "motif": "hero tune-in",
        "badge": "LIVE",
        "element_primary": "Live event hero",
        "element_secondary": "Subtle tune-in accent",
        "shape": "soft panel",
        "pattern": "cinematic wash",
        "copy_angle": "Tonight's live lineup",
        "headline": "Tonight's live lineup",
        "cta_text": "View lineup",
    },
    {
        "treatment_id": "family-feature",
        "name": "Family feature",
        "accent": "#c7793a",
        "secondary": "#7c4d2d",
        "layout": "bottom-panel",
        "motif": "weekend feature",
        "badge": "WEEKEND",
        "element_primary": "Weekend feature card",
        "element_secondary": "Warm co-viewing cue",
        "shape": "feature card",
        "pattern": "warm vignette",
        "copy_angle": "Weekend watchlist",
        "headline": "Weekend watchlist",
        "cta_text": "Browse picks",
    },
    {
        "treatment_id": "originals-spotlight",
        "name": "Originals spotlight",
        "accent": "#5b65d8",
        "secondary": "#13212d",
        "layout": "center-panel",
        "motif": "premium title",
        "badge": "PREMIERE",
        "element_primary": "Premium title lockup",
        "element_secondary": "Quiet premiere accent",
        "shape": "spotlight panel",
        "pattern": "soft spotlight",
        "copy_angle": "Your next original",
        "headline": "Your next original",
        "cta_text": "Watch trailer",
    },
    {
        "treatment_id": "upgrade-offer",
        "name": "Upgrade offer",
        "accent": "#1f9d72",
        "secondary": "#0f766e",
        "layout": "right-panel",
        "motif": "annual value",
        "badge": "UPGRADE",
        "element_primary": "Clean offer chip",
        "element_secondary": "Plan value cue",
        "shape": "offer chip",
        "pattern": "subtle lift",
        "copy_angle": "More to watch",
        "headline": "More to watch",
        "cta_text": "Compare plans",
    },
    {
        "treatment_id": "winback-event",
        "name": "Winback event",
        "accent": "#256b8f",
        "secondary": "#071523",
        "layout": "right-panel",
        "motif": "return event",
        "badge": "RETURN",
        "element_primary": "Return-to-event card",
        "element_secondary": "Restart cue",
        "shape": "event card",
        "pattern": "deep vignette",
        "copy_angle": "Back for the big event",
        "headline": "Back for the big event",
        "cta_text": "Restart now",
    },
]

BRAND_GUIDELINES = [
    {
        "guideline_id": "GUIDE-CME-STREAMING-001",
        "brand_name": "CME Streaming",
        "profile_name": "CME Streaming Summit Demo",
        "version": "2026.06-demo",
        "status": "active",
        "tone": "premium, direct, energetic, trustworthy",
        "headline_rules_json": json.dumps(
            [
                "Lead with live-event value or household viewing utility.",
                "Keep headlines under 42 characters for end-card readability.",
                "Avoid unsupported exclusivity, unsupported savings, and urgency claims.",
            ]
        ),
        "visual_rules_json": json.dumps(
            [
                "Use deep navy, teal, warm amber, and clean white contrast.",
                "Keep CTA and brand mark in the safe area for every placement.",
                "Use streaming-context imagery, device framing, or live-event atmosphere without depicting real licensed talent.",
            ]
        ),
        "color_tokens_json": json.dumps(
            {
                "navy": "#071523",
                "teal": "#0f9f95",
                "blue": "#256b8f",
                "amber": "#c7793a",
                "white": "#ffffff",
            }
        ),
        "required_elements_json": json.dumps(["CME Streaming", "clear CTA", "safe-area copy", "rights-safe visual treatment"]),
        "blocked_claims_json": json.dumps(["unsupported savings claims", "unverified exclusivity claims", "all-game availability claims"]),
        "created_ts": "2026-06-01",
        "updated_ts": "2026-06-01",
    }
]

GENERATION_MODEL_OPTIONS = [
    {
        "model_id": "gpt-5-mini-balanced",
        "label": "GPT-5 Mini - Balanced",
        "provider": "Databricks Model Serving",
        "endpoint_name": CREATIVE_MODEL_ENDPOINT,
        "modality": "image",
        "default": True,
        "description": "Primary summit-demo option for prompt-to-image variant generation and scoring narration.",
        "latency_profile": "interactive",
        "governance_note": "Uses the configured creative endpoint and writes prompt, reference asset, and guideline lineage.",
    },
    {
        "model_id": "kimi-2-compare",
        "label": "Kimi 2 - Model Compare",
        "provider": "Databricks Model Serving",
        "endpoint_name": os.getenv("CREATIVE_COMPARE_MODEL_ENDPOINT", CREATIVE_MODEL_ENDPOINT or "kimi-2-demo"),
        "modality": "image",
        "default": False,
        "description": "Comparison option for side-by-side image prompt evaluation in the demo.",
        "latency_profile": "interactive",
        "governance_note": "Stored as comparison metadata when selected; falls back to the configured creative endpoint if not separately configured.",
    },
    {
        "model_id": "runway-gen3-video-endcard",
        "label": "Runway Gen-3 - Video End Card",
        "provider": "External video model via governed endpoint",
        "endpoint_name": os.getenv("CREATIVE_VIDEO_MODEL_ENDPOINT", "runway-gen3-video-endcard-demo"),
        "modality": "video",
        "default": False,
        "description": "Demo option for generating a short MP4 with a final end-card CTA.",
        "latency_profile": "async-preview",
        "governance_note": "The app records requested video model, source asset, end-card copy, CTA, and MP4 preview URI.",
    },
]

EVALUATION_RUBRICS = [
    {
        "rubric_id": "RUBRIC-CME-SYNTH-001",
        "name": "Evaluation Criteria",
        "judge_model": CREATIVE_JUDGE_MODEL_ENDPOINT,
        "weights_json": json.dumps(
            {
                "overall_score": 0.58,
                "click_propensity_score": 0.18,
                "brand_fit_score": 0.14,
                "fatigue_inverse": 0.10,
                "placement_channel_fit": "additive adjustment",
            }
        ),
        "criteria_json": json.dumps(
            [
                "Audience relevance and segment fit",
                "Click or tune-in propensity",
                "Brand guideline adherence",
                "Creative clarity",
                "Fatigue and repetition risk",
                "Placement and channel fit",
            ]
        ),
        "created_ts": "2026-06-01",
    }
]

ACTIVATION_CHANNELS = [
    {
        "id": "meta",
        "label": "Meta",
        "base_cpm": 9.2,
        "ctr_lift": 0.22,
        "placement_fit": {"social_square": 8, "story_unit": 9, "social_video_15s": 10, "homepage_hero": -6, "newsletter_banner": -4},
    },
    {
        "id": "google_ads",
        "label": "Google Ads",
        "base_cpm": 8.6,
        "ctr_lift": 0.18,
        "placement_fit": {"homepage_hero": 2, "app_tile": 5, "youtube_15s": 9, "social_video_15s": 6, "newsletter_banner": -2},
    },
    {
        "id": "dv360",
        "label": "DV360",
        "base_cpm": 10.8,
        "ctr_lift": 0.12,
        "placement_fit": {"homepage_hero": 7, "newsletter_banner": 4, "ctv_15s": 9, "youtube_15s": 6, "social_square": 1},
    },
    {
        "id": "ttd",
        "label": "The Trade Desk",
        "base_cpm": 11.4,
        "ctr_lift": 0.15,
        "placement_fit": {"homepage_hero": 5, "newsletter_banner": 3, "ctv_15s": 10, "youtube_15s": 6, "app_tile": 0},
    },
    {
        "id": "adobe_target",
        "label": "Adobe Target",
        "base_cpm": 6.4,
        "ctr_lift": 0.32,
        "placement_fit": {"homepage_hero": 10, "app_tile": 8, "newsletter_banner": 6, "social_square": -1, "ctv_15s": -5},
    },
    {
        "id": "email",
        "label": "Email",
        "base_cpm": 3.2,
        "ctr_lift": 0.08,
        "placement_fit": {"newsletter_banner": 10, "homepage_hero": 1, "app_tile": 0, "social_square": -4, "story_unit": -8},
    },
]

AUDIENCE_DEMOGRAPHIC_SIGNALS = [
    {
        "signal_id": "DEMO-BOOMERS-MIDWEST-001",
        "cohort_id": "COH-001",
        "generation": "Boomers",
        "region": "Midwest",
        "age_range": "59-77",
        "household_profile": "Empty nest and multigenerational co-viewing",
        "content_affinity": "live sports, classics, appointment viewing",
        "device_preference": "CTV first",
        "message_preference": "clear value, low-friction setup, recognizable live-event cue",
        "resonance_weight": 1.12,
        "governance_status": "fallback-governed",
    },
    {
        "signal_id": "DEMO-MILLENNIALS-MIDWEST-001",
        "cohort_id": "COH-004",
        "generation": "Millennials",
        "region": "Midwest",
        "age_range": "29-44",
        "household_profile": "Busy streamers comparing bundles",
        "content_affinity": "premium originals, live events, social clips",
        "device_preference": "mobile and CTV",
        "message_preference": "bundle depth, annual-plan value, mobile-to-TV continuity",
        "resonance_weight": 1.03,
        "governance_status": "fallback-governed",
    },
    {
        "signal_id": "DEMO-BOOMERS-SOUTH-001",
        "cohort_id": "COH-002",
        "generation": "Boomers",
        "region": "South",
        "age_range": "59-77",
        "household_profile": "Lapsed subscribers with sports affinity",
        "content_affinity": "regional sports, tentpole games, news adjacencies",
        "device_preference": "CTV and web",
        "message_preference": "winback clarity, familiar event schedule, no-hassle restart",
        "resonance_weight": 1.01,
        "governance_status": "fallback-governed",
    },
    {
        "signal_id": "DEMO-GENX-WEST-001",
        "cohort_id": "COH-003",
        "generation": "Gen X",
        "region": "West",
        "age_range": "45-58",
        "household_profile": "Family households with shared weekend viewing",
        "content_affinity": "family movies, sports highlights, franchises",
        "device_preference": "CTV and tablet",
        "message_preference": "shared viewing and weekend discovery",
        "resonance_weight": 0.96,
        "governance_status": "fallback-governed",
    },
]

PURCHASE_INTENT_SIGNALS = [
    {
        "signal_id": "PURCHASE-BOOMERS-MIDWEST-001",
        "cohort_id": "COH-001",
        "generation": "Boomers",
        "region": "Midwest",
        "purchase_intent_score": 86,
        "conversion_rate": 0.078,
        "avg_order_value": 129,
        "trigger": "live sports bundle reminder",
        "preferred_offer": "annual plan with live-event calendar",
        "recommended_channel": "The Trade Desk",
    },
    {
        "signal_id": "PURCHASE-MILLENNIALS-MIDWEST-001",
        "cohort_id": "COH-004",
        "generation": "Millennials",
        "region": "Midwest",
        "purchase_intent_score": 79,
        "conversion_rate": 0.064,
        "avg_order_value": 118,
        "trigger": "trial-to-paid upgrade moment",
        "preferred_offer": "annual plan value and mobile continuity",
        "recommended_channel": "Google Ads",
    },
    {
        "signal_id": "PURCHASE-BOOMERS-SOUTH-001",
        "cohort_id": "COH-002",
        "generation": "Boomers",
        "region": "South",
        "purchase_intent_score": 74,
        "conversion_rate": 0.058,
        "avg_order_value": 102,
        "trigger": "winback before tentpole game",
        "preferred_offer": "restart reminder with schedule clarity",
        "recommended_channel": "Email",
    },
    {
        "signal_id": "PURCHASE-GENX-WEST-001",
        "cohort_id": "COH-003",
        "generation": "Gen X",
        "region": "West",
        "purchase_intent_score": 71,
        "conversion_rate": 0.052,
        "avg_order_value": 96,
        "trigger": "weekend family viewing plan",
        "preferred_offer": "family movie-night bundle",
        "recommended_channel": "Adobe Target",
    },
]


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


def _as_optional_float_value(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


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


def _stable_fraction(*parts: Any) -> float:
    seed = "|".join(_as_text(part) for part in parts)
    if not seed:
        return 0.5
    total = sum((index + 1) * ord(char) for index, char in enumerate(seed))
    return (total % 1000) / 1000


def _derived_audience_match_rate(row: dict[str, Any]) -> float:
    explicit = _as_optional_float_value(row.get("match_rate"))
    if explicit is not None:
        return round(explicit if explicit <= 1 else explicit / 100, 2)
    name = _as_text(row.get("cohort_name")).lower()
    definition_type = _as_text(row.get("definition_type")).lower()
    base = 0.7 + (_stable_fraction(row.get("cohort_id"), row.get("cohort_name")) * 0.16)
    if _as_bool_value(row.get("is_region_allowed")):
        base += 0.03
    if _as_bool_value(row.get("is_channel_allowed")):
        base += 0.03
    if _as_bool_value(row.get("is_frequency_capped")):
        base += 0.02
    if "churn" in name or "reactivat" in name:
        base += 0.03
    if "suppression" in name or "service" in name:
        base += 0.04
    if "lookalike" in name or definition_type == "lookalike":
        base -= 0.02
    return round(min(0.97, max(0.62, base)), 2)


def _derived_audience_ltv(row: dict[str, Any]) -> int:
    explicit = _as_optional_float_value(row.get("avg_ltv"))
    if explicit is not None:
        return _as_int_value(explicit)
    reach = _as_int_value(row.get("estimated_reach"))
    name = _as_text(row.get("cohort_name")).lower()
    base = 360 + int(_stable_fraction(row.get("cohort_id"), row.get("cohort_name"), "ltv") * 260)
    if "premium" in name or "high value" in name:
        base += 180
    if "churn" in name or "suppression" in name:
        base -= 80
    if reach > 600_000:
        base += 40
    return max(280, min(920, base))


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


def _sql_literal(value: Any) -> str:
    return "'" + str(value).replace("'", "''") + "'"


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
def _workspace_client(access_token: str | None = None) -> Any:
    from databricks.sdk import WorkspaceClient

    if access_token:
        host = os.getenv("DATABRICKS_HOST", "").strip()
        if host:
            return WorkspaceClient(host=host, token=access_token)
    return WorkspaceClient()


STATE_TABLES: dict[str, tuple[str, str, str]] = {
    "generation_requests": ("app_generation_requests", "request_id", "generation_request"),
    "creative_variants": ("app_creative_variants", "creative_asset_id", "creative_variant"),
    "creative_transformations": ("app_creative_transformations", "transformation_id", "creative_transformation"),
    "policy_checks": ("app_policy_checks", "check_id", "policy_check"),
    "synthetic_evaluations": ("app_synthetic_evaluations", "evaluation_id", "synthetic_evaluation"),
    "activation_exports": ("app_activation_exports", "export_id", "activation_export"),
    "activations": ("app_activations", "activation_id", "activation"),
}


def _lakebase_configured() -> bool:
    if APP_STATE_BACKEND not in {"lakebase", "postgres", "postgresql"}:
        return False
    return bool(
        os.getenv("DB_CONNECTION_STRING")
        or os.getenv("LAKEBASE_PG_URL")
        or os.getenv("PGHOST")
        or LAKEBASE_INSTANCE_NAME
    )


def _lakebase_connect() -> Any:
    import psycopg

    conninfo = os.getenv("DB_CONNECTION_STRING") or os.getenv("LAKEBASE_PG_URL")
    if conninfo:
        if "sslmode=" in conninfo:
            return psycopg.connect(conninfo)
        return psycopg.connect(conninfo, sslmode="require")

    host = os.getenv("PGHOST") or os.getenv("LAKEBASE_HOST")
    user = os.getenv("PGUSER") or os.getenv("LAKEBASE_USERNAME")
    password = os.getenv("PGPASSWORD")
    port = os.getenv("PGPORT", "5432")
    if host and user and password:
        return psycopg.connect(
            host=host,
            dbname=LAKEBASE_DATABASE_NAME,
            user=user,
            password=password,
            port=port,
            sslmode="require",
        )

    if LAKEBASE_INSTANCE_NAME:
        client = _workspace_client()
        instance = client.database.get_database_instance(name=LAKEBASE_INSTANCE_NAME)
        credential = client.database.generate_database_credential(
            request_id=str(uuid.uuid4()),
            instance_names=[LAKEBASE_INSTANCE_NAME],
        )
        return psycopg.connect(
            host=instance.read_write_dns,
            dbname=LAKEBASE_DATABASE_NAME,
            user=os.getenv("LAKEBASE_USERNAME") or client.current_user.me().user_name,
            password=credential.token,
            sslmode="require",
        )

    raise RuntimeError("Lakebase is not configured")


def _state_error(operation: str, error: Exception) -> None:
    message = f"lakebase_state:{operation}: {error}"
    if message not in DATA_BACKEND_ERRORS:
        DATA_BACKEND_ERRORS.append(message)


@lru_cache(maxsize=1)
def _lakebase_init() -> bool:
    if not _lakebase_configured():
        return False
    try:
        with _lakebase_connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS app_state_events (
                      id BIGSERIAL PRIMARY KEY,
                      event_id TEXT UNIQUE NOT NULL,
                      event_type TEXT NOT NULL,
                      entity_type TEXT NOT NULL,
                      entity_id TEXT NOT NULL,
                      payload JSONB NOT NULL,
                      created_ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                for table_name, key_column, _entity_type in STATE_TABLES.values():
                    cur.execute(
                        f"""
                        CREATE TABLE IF NOT EXISTS {table_name} (
                          {key_column} TEXT PRIMARY KEY,
                          payload JSONB NOT NULL,
                          updated_ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        )
                        """
                    )
        DATA_LOAD_SOURCES["app_state"] = {
            "source": "lakebase",
            "path": LAKEBASE_INSTANCE_NAME or os.getenv("PGHOST") or "database-resource",
            "rows": 0,
            "loaded": True,
        }
        return True
    except Exception as exc:
        _state_error("init", exc)
        DATA_LOAD_SOURCES["app_state"] = {
            "source": "lakebase_fallback",
            "path": LAKEBASE_INSTANCE_NAME or os.getenv("PGHOST") or "database-resource",
            "rows": 0,
            "loaded": False,
            "error": str(exc),
        }
        return False


def _json_dumps(value: Any) -> str:
    return json.dumps(value, default=str, sort_keys=True)


def _json_payload(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {"value": parsed}
        except json.JSONDecodeError:
            return {"value": value}
    return {"value": value}


def _lakebase_persist_rows(table_key: str, rows: list[dict[str, Any]], event_type: str) -> bool:
    if not rows or not _lakebase_init():
        return False
    table_name, key_column, entity_type = STATE_TABLES[table_key]
    try:
        with _lakebase_connect() as conn:
            with conn.cursor() as cur:
                for row in rows:
                    entity_id = _as_text(row.get(key_column))
                    if not entity_id:
                        continue
                    payload_json = _json_dumps(row)
                    cur.execute(
                        f"""
                        INSERT INTO {table_name} ({key_column}, payload, updated_ts)
                        VALUES (%s, %s::jsonb, NOW())
                        ON CONFLICT ({key_column})
                        DO UPDATE SET payload = EXCLUDED.payload, updated_ts = NOW()
                        """,
                        (entity_id, payload_json),
                    )
                    cur.execute(
                        """
                        INSERT INTO app_state_events (event_id, event_type, entity_type, entity_id, payload)
                        VALUES (%s, %s, %s, %s, %s::jsonb)
                        ON CONFLICT (event_id) DO NOTHING
                        """,
                        (str(uuid.uuid4()), event_type, entity_type, entity_id, payload_json),
                    )
        return True
    except Exception as exc:
        _state_error(f"persist_{table_key}", exc)
        return False


def _lakebase_rows(table_key: str, limit: int = 250) -> list[dict[str, Any]]:
    if not _lakebase_init():
        return []
    table_name, _key_column, _entity_type = STATE_TABLES[table_key]
    try:
        with _lakebase_connect() as conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT payload FROM {table_name} ORDER BY updated_ts DESC LIMIT %s", (limit,))
                return [_json_payload(row[0]) for row in cur.fetchall()]
    except Exception as exc:
        _state_error(f"read_{table_key}", exc)
        return []


def _lakebase_events(entity_type: str = "", entity_id: str = "", limit: int = 100) -> list[dict[str, Any]]:
    if not _lakebase_init():
        return []
    clauses = []
    params: list[Any] = []
    if entity_type:
        clauses.append("entity_type = %s")
        params.append(entity_type)
    if entity_id:
        clauses.append("entity_id = %s")
        params.append(entity_id)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(max(1, min(limit, 500)))
    try:
        with _lakebase_connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT event_id, event_type, entity_type, entity_id, payload, created_ts
                    FROM app_state_events
                    {where}
                    ORDER BY created_ts DESC
                    LIMIT %s
                    """,
                    params,
                )
                return [
                    {
                        "event_id": row[0],
                        "event_type": row[1],
                        "entity_type": row[2],
                        "entity_id": row[3],
                        "payload": _json_payload(row[4]),
                        "created_ts": row[5].isoformat() if hasattr(row[5], "isoformat") else _as_text(row[5]),
                    }
                    for row in cur.fetchall()
                ]
    except Exception as exc:
        _state_error("read_events", exc)
        return []


def _dedupe_by_key(rows: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for row in rows:
        value = _as_text(row.get(key))
        if not value or value in seen:
            continue
        seen.add(value)
        unique.append(row)
    return unique


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


def _enum_text(value: Any) -> str:
    return getattr(value, "value", str(value))


def _format_result_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, sort_keys=True)
    return str(value)


def _statement_response_rows(statement_response: Any) -> list[dict[str, str]]:
    if not statement_response:
        return []
    manifest = getattr(statement_response, "manifest", None)
    schema = getattr(manifest, "schema", None)
    columns = [column.name or "" for column in (schema.columns if schema else [])]
    result = getattr(statement_response, "result", None)
    rows = getattr(result, "data_array", None) or []
    return [
        {column: _format_result_value(value) for column, value in zip(columns, row)}
        for row in rows
    ]


def _extract_genie_sample_questions(space_payload: dict[str, Any]) -> list[str]:
    serialized = space_payload.get("serialized_space")
    if isinstance(serialized, str):
        try:
            serialized = json.loads(serialized)
        except json.JSONDecodeError:
            serialized = {}
    if not isinstance(serialized, dict):
        serialized = {}

    raw_questions = serialized.get("config", {}).get("sample_questions", [])
    questions: list[str] = []
    for item in raw_questions:
        question = item.get("question") if isinstance(item, dict) else item
        if isinstance(question, list):
            question = " ".join(_as_text(part).strip() for part in question if _as_text(part).strip())
        text = _as_text(question).strip()
        if text and text not in questions:
            questions.append(text)
    return questions


@lru_cache(maxsize=1)
def _genie_recommended_questions() -> list[str]:
    if GENIE_SPACE_ID:
        try:
            payload = _workspace_client().api_client.do(
                "GET",
                f"/api/2.0/genie/spaces/{GENIE_SPACE_ID}",
                query={"include_serialized_space": "true"},
            )
            questions = _extract_genie_sample_questions(payload)
            if questions:
                return questions
        except Exception as exc:
            DATA_BACKEND_ERRORS.append(f"genie_questions: {exc}")
    return GENIE_RECOMMENDED_QUESTIONS_FALLBACK


def _genie_failure_answer(error: str) -> str:
    if "MessageStatus.FAILED" in error or "status: FAILED" in error:
        return (
            "Genie returned FAILED for that phrasing. Select one of the recommended Genie questions; "
            "those prompts are pulled from the configured Genie space."
        )
    return (
        "Genie is configured, but the request did not complete. Select one of the recommended Genie questions "
        "or try a narrower phrasing tied to the configured workflow tables."
    )


def _ask_genie(question: str, access_token: str | None = None) -> dict[str, Any]:
    if not GENIE_SPACE_ID:
        raise RuntimeError("GENIE_SPACE_ID is not configured")

    client = _workspace_client(access_token)
    message = client.genie.start_conversation_and_wait(
        space_id=GENIE_SPACE_ID,
        content=question,
        timeout=timedelta(seconds=GENIE_TIMEOUT_SECONDS),
    )
    status = _enum_text(getattr(message, "status", ""))
    if status not in {"COMPLETED", "EXECUTING_QUERY"}:
        error = getattr(message, "error", None)
        error_message = getattr(error, "message", None) if error else None
        raise RuntimeError(error_message or f"Genie message finished with status {status}")

    text_parts: list[str] = []
    result: dict[str, Any] | None = None

    for attachment in getattr(message, "attachments", None) or []:
        text = getattr(attachment, "text", None)
        if text and getattr(text, "content", None):
            text_parts.append(text.content)

        query = getattr(attachment, "query", None)
        if not query or result is not None:
            continue

        attachment_id = getattr(attachment, "attachment_id", None) or getattr(query, "id", None)
        statement_rows: list[dict[str, str]] = []
        if attachment_id:
            try:
                query_result = client.genie.get_message_attachment_query_result(
                    space_id=GENIE_SPACE_ID,
                    conversation_id=message.conversation_id,
                    message_id=message.message_id,
                    attachment_id=attachment_id,
                )
            except Exception:
                query_result = client.genie.execute_message_attachment_query(
                    space_id=GENIE_SPACE_ID,
                    conversation_id=message.conversation_id,
                    message_id=message.message_id,
                    attachment_id=attachment_id,
                )
            statement_rows = _statement_response_rows(getattr(query_result, "statement_response", None))

        result = {
            "title": getattr(query, "title", None) or "Genie query result",
            "rows": statement_rows,
        }

    answer = "\n\n".join(part.strip() for part in text_parts if part.strip())
    if not answer:
        answer = "Genie queried the Creative Command Center workflow space and returned the result below."

    return {
        "answer": answer,
        "result": result,
    }


QUESTION_STOPWORDS = {
    "a",
    "about",
    "all",
    "and",
    "are",
    "as",
    "by",
    "did",
    "do",
    "does",
    "for",
    "from",
    "have",
    "how",
    "in",
    "is",
    "me",
    "of",
    "or",
    "show",
    "that",
    "the",
    "these",
    "to",
    "was",
    "were",
    "what",
    "when",
    "where",
    "which",
    "with",
}


def _question_tokens(value: str) -> set[str]:
    normalized = "".join(char.lower() if char.isalnum() else " " for char in value)
    return {token for token in normalized.split() if len(token) > 2 and token not in QUESTION_STOPWORDS}


def _closest_genie_question(question: str, questions: list[str] | None = None) -> tuple[str, float]:
    source_tokens = _question_tokens(question)
    if not source_tokens:
        return "", 0.0
    best_question = ""
    best_score = 0.0
    for candidate in questions or _genie_recommended_questions():
        candidate_tokens = _question_tokens(candidate)
        if not candidate_tokens:
            continue
        overlap = len(source_tokens & candidate_tokens)
        score = overlap / max(len(source_tokens), len(candidate_tokens))
        if score > best_score:
            best_question = candidate
            best_score = score
    return best_question, best_score


def _normalized_question(value: str) -> str:
    return " ".join("".join(char.lower() if char.isalnum() else " " for char in value).split())


def _ask_genie_resilient(question: str, access_token: str | None = None) -> dict[str, Any]:
    suggested_question, suggested_score = _closest_genie_question(question)
    question_attempts = [question]
    if (
        suggested_question
        and suggested_score >= 0.18
        and _normalized_question(suggested_question) != _normalized_question(question)
    ):
        question_attempts.append(suggested_question)

    token_attempts: list[tuple[str, str | None]] = []
    if access_token:
        token_attempts.append(("user", access_token))
    token_attempts.append(("app", None))

    errors: list[str] = []
    for auth_label, token in token_attempts:
        for attempt_question in question_attempts:
            try:
                result = _ask_genie(attempt_question, access_token=token)
                if attempt_question != question:
                    result["answer"] = (
                        "Using the closest curated Genie question: "
                        f"{attempt_question}\n\n{result.get('answer', '')}"
                    ).strip()
                return result
            except Exception as exc:
                errors.append(f"{auth_label}:{attempt_question}: {exc}")
    raise RuntimeError("; ".join(errors[-3:]) or "Genie request failed")


def _display_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, float):
        return f"{value:.2f}".rstrip("0").rstrip(".")
    if isinstance(value, (dict, list)):
        return json.dumps(value, default=str)
    return str(value)


def _table_rows(rows: list[dict[str, Any]], columns: list[tuple[str, str]], limit: int = 8) -> list[dict[str, str]]:
    return [
        {label: _display_value(row.get(key)) for key, label in columns}
        for row in rows[:limit]
    ]


def _workflow_rows() -> dict[str, list[dict[str, Any]]]:
    workflow = _creative_workflow_data()
    runtime = _runtime_data()
    return {
        "briefs": runtime["briefs"],
        "audiences": runtime["audiences"],
        "creatives": runtime["creatives"],
        "audience_traits": workflow["audience_traits"],
        "brand_guidelines": _brand_guidelines_data(),
        "generation_models": _generation_model_options_data(),
        "evaluation_rubrics": _evaluation_rubrics_data(),
        "audience_demographics": _audience_demographic_signals_data(),
        "purchase_signals": _purchase_intent_signals_data(),
        "base_assets": _governed_retrieval_assets(),
        "generation_requests": _dedupe_by_key(
            [*_lakebase_rows("generation_requests"), *LIVE_GENERATION_REQUESTS, *workflow["generation_requests"]],
            "request_id",
        ),
        "variants": _dedupe_by_key(
            [*_lakebase_rows("creative_variants"), *LIVE_CREATIVE_VARIANTS, *workflow["variants"]],
            "creative_asset_id",
        ),
        "transformations": _dedupe_by_key(
            [*_lakebase_rows("creative_transformations"), *LIVE_CREATIVE_TRANSFORMATIONS, *workflow["creative_transformations"]],
            "transformation_id",
        ),
        "policy_checks": _dedupe_by_key(
            [*_lakebase_rows("policy_checks"), *workflow["policy_checks"]],
            "check_id",
        ),
        "evaluations": _dedupe_by_key(
            [*_lakebase_rows("synthetic_evaluations"), *workflow["synthetic_evaluations"]],
            "evaluation_id",
        ),
        "activation_exports": _dedupe_by_key(
            [*_lakebase_rows("activation_exports"), *workflow["activation_exports"]],
            "export_id",
        ),
        "activations": _dedupe_by_key(
            [*_lakebase_rows("activations"), *LIVE_ACTIVATION_SUBMISSIONS, *runtime["activations"]],
            "activation_id",
        ),
    }


def _channel_projection_for(evaluation: dict[str, Any], channel: dict[str, Any]) -> dict[str, Any]:
    placement = _as_text(evaluation.get("placement"))
    placement_fit = _as_float_value((channel.get("placement_fit") or {}).get(placement), 0.0)
    score = round(
        min(
            99,
            max(
                0,
                _as_float_value(evaluation.get("overall_score")) * 0.58
                + _as_float_value(evaluation.get("click_propensity_score")) * 0.18
                + _as_float_value(evaluation.get("brand_fit_score")) * 0.14
                + (100 - _as_float_value(evaluation.get("fatigue_risk_score"))) * 0.10
                + placement_fit,
            ),
        )
    )
    projected_ctr = min(
        5.4,
        max(
            0.25,
            (_as_float_value(evaluation.get("click_propensity_score")) / 100) * 2.9
            + _as_float_value(channel.get("ctr_lift"))
            + placement_fit / 55,
        ),
    )
    projected_cpm = max(
        2.5,
        _as_float_value(channel.get("base_cpm"))
        + max(0, 82 - _as_float_value(evaluation.get("relevance_score"))) * 0.025
        + max(0, placement_fit) * 0.03,
    )
    projected_conversions = round(
        (_as_float_value(evaluation.get("subscription_start_propensity_score")) * score) / 10
    )
    return {
        "channel_id": channel["id"],
        "channel_label": channel["label"],
        "score": score,
        "projected_ctr": round(projected_ctr, 2),
        "projected_cpm": round(projected_cpm, 2),
        "projected_conversions": projected_conversions,
        "placement_fit": placement_fit,
    }


def _evaluation_channel_matrix_rows(rows: dict[str, list[dict[str, Any]]] | None = None) -> list[dict[str, Any]]:
    rows = rows or _workflow_rows()
    variant_by_id = {_as_text(item.get("creative_asset_id")): item for item in rows["variants"]}
    rubric = (rows.get("evaluation_rubrics") or _evaluation_rubrics_data() or EVALUATION_RUBRICS)[0]
    matrix_rows = []
    for evaluation in rows["evaluations"]:
        creative_id = _as_text(evaluation.get("creative_asset_id"))
        variant = variant_by_id.get(creative_id, {})
        projections = [_channel_projection_for(evaluation, channel) for channel in ACTIVATION_CHANNELS]
        projections = sorted(projections, key=lambda item: (-_as_int_value(item.get("score")), _as_float_value(item.get("projected_cpm"))))
        recommended = projections[0] if projections else {}
        matrix_rows.append(
            {
                "evaluation_id": evaluation.get("evaluation_id"),
                "creative_asset_id": creative_id,
                "asset_name": variant.get("asset_name"),
                "cohort_id": evaluation.get("cohort_id"),
                "placement": evaluation.get("placement"),
                "overall_score": evaluation.get("overall_score"),
                "rank_within_segment_placement": evaluation.get("rank_within_segment_placement"),
                "recommended_channel_id": recommended.get("channel_id"),
                "recommended_channel_label": recommended.get("channel_label"),
                "channels": projections,
                "explanation_id": f"EXPLAIN-{evaluation.get('evaluation_id')}",
                "rubric_id": rubric["rubric_id"],
            }
        )
    return matrix_rows


def _score_explanation_for_evaluation(evaluation_id: str) -> dict[str, Any]:
    rows = _workflow_rows()
    evaluation = next((item for item in rows["evaluations"] if _as_text(item.get("evaluation_id")) == evaluation_id), None)
    if not evaluation:
        raise HTTPException(status_code=404, detail="Synthetic evaluation not found")
    matrix = next((item for item in _evaluation_channel_matrix_rows(rows) if item.get("evaluation_id") == evaluation_id), None)
    variant = _find_by_id(rows["variants"], "creative_asset_id", _as_text(evaluation.get("creative_asset_id")))
    audience = _find_by_id(rows["audiences"], "cohort_id", _as_text(evaluation.get("cohort_id")))
    request = _find_by_id(rows["generation_requests"], "request_id", _as_text((variant or {}).get("request_id")))
    guideline = _brand_guideline_by_id(_as_text((variant or {}).get("brand_guideline_id") or (request or {}).get("brand_guideline_id")))
    rubric = (rows.get("evaluation_rubrics") or _evaluation_rubrics_data() or EVALUATION_RUBRICS)[0]
    if matrix is None:
        projections = [_channel_projection_for(evaluation, channel) for channel in ACTIVATION_CHANNELS]
        projections = sorted(projections, key=lambda item: (-_as_int_value(item.get("score")), _as_float_value(item.get("projected_cpm"))))
        recommended = projections[0] if projections else {}
        matrix = {
            "evaluation_id": evaluation_id,
            "creative_asset_id": _as_text(evaluation.get("creative_asset_id")),
            "asset_name": (variant or {}).get("asset_name"),
            "cohort_id": evaluation.get("cohort_id"),
            "placement": evaluation.get("placement"),
            "overall_score": evaluation.get("overall_score"),
            "rank_within_segment_placement": evaluation.get("rank_within_segment_placement"),
            "recommended_channel_id": recommended.get("channel_id"),
            "recommended_channel_label": recommended.get("channel_label"),
            "channels": projections,
            "explanation_id": f"EXPLAIN-{evaluation_id}",
            "rubric_id": rubric["rubric_id"],
        }
    return {
        "explanation_id": f"EXPLAIN-{evaluation_id}",
        "evaluation": evaluation,
        "creative_variant": variant,
        "audience": audience,
        "generation_request": request,
        "brand_guideline": guideline,
        "rubric": rubric,
        "channel_matrix": matrix,
        "model_settings": {
            "judge_model": evaluation.get("judge_model") or CREATIVE_JUDGE_MODEL_ENDPOINT,
            "generation_model": (variant or {}).get("generation_model") or (request or {}).get("generation_model_label") or CREATIVE_MODEL_ENDPOINT,
            "generation_model_id": (variant or {}).get("generation_model_id") or (request or {}).get("generation_model_id") or "",
            "rubric_id": rubric["rubric_id"],
            "score_source": "backend_api",
        },
        "reasoning": [
            f"Overall score {_display_value(evaluation.get('overall_score'))} carries the largest weight.",
            f"Click propensity {_display_value(evaluation.get('click_propensity_score'))} and brand fit {_display_value(evaluation.get('brand_fit_score'))} lift the channel score.",
            f"Fatigue risk {_display_value(evaluation.get('fatigue_risk_score'))} is inverted so lower fatigue improves readiness.",
            f"Recommended channel is {(matrix or {}).get('recommended_channel_label', 'N/A')} after placement-fit and CPM tie-breaks.",
        ],
    }


def _demographic_purchase_answer_rows(rows: dict[str, list[dict[str, Any]]], generation: str, region: str) -> list[dict[str, Any]]:
    generation_token = generation.lower()
    region_token = region.lower()
    demographic_rows = [
        item
        for item in rows["audience_demographics"]
        if generation_token in _as_text(item.get("generation")).lower()
        and region_token in _as_text(item.get("region")).lower()
    ]
    purchase_by_cohort = {
        _as_text(item.get("cohort_id")): item
        for item in rows["purchase_signals"]
        if generation_token in _as_text(item.get("generation")).lower()
        and region_token in _as_text(item.get("region")).lower()
    }
    audience_by_id = {_as_text(item.get("cohort_id")): item for item in rows["audiences"]}
    variant_by_id = {_as_text(item.get("creative_asset_id")): item for item in rows["variants"]}
    scored_rows = []
    for demographic in demographic_rows:
        cohort_id = _as_text(demographic.get("cohort_id"))
        purchase = purchase_by_cohort.get(cohort_id, {})
        for evaluation in rows["evaluations"]:
            if _as_text(evaluation.get("cohort_id")) != cohort_id:
                continue
            variant = variant_by_id.get(_as_text(evaluation.get("creative_asset_id")), {})
            resonance_score = round(
                _as_float_value(evaluation.get("overall_score")) * _as_float_value(demographic.get("resonance_weight"), 1.0)
                + _as_float_value(purchase.get("purchase_intent_score")) * 0.12,
                1,
            )
            scored_rows.append(
                {
                    "creative_asset_id": evaluation.get("creative_asset_id"),
                    "asset_name": variant.get("asset_name"),
                    "cohort_name": audience_by_id.get(cohort_id, {}).get("cohort_name"),
                    "generation": demographic.get("generation"),
                    "region": demographic.get("region"),
                    "overall_score": evaluation.get("overall_score"),
                    "purchase_intent_score": purchase.get("purchase_intent_score"),
                    "recommended_channel": purchase.get("recommended_channel"),
                    "resonance_score": resonance_score,
                    "message_preference": demographic.get("message_preference"),
                }
            )
    return sorted(scored_rows, key=lambda item: _as_float_value(item.get("resonance_score")), reverse=True)


def _ask_workflow_fallback(question: str, genie_error: str = "") -> dict[str, Any]:
    closest_question, _score = _closest_genie_question(question)
    intent = _normalized_question(closest_question or question)
    rows = _workflow_rows()
    variants = rows["variants"]
    variant_by_id = {_as_text(item.get("creative_asset_id")): item for item in variants}
    audience_by_id = {_as_text(item.get("cohort_id")): item for item in rows["audiences"]}
    brief_by_id = {_as_text(item.get("brief_id")): item for item in rows["briefs"]}
    prefix = "Here is the governed Creative Command Center view."

    if "boomers" in intent and "midwest" in intent and ("resonate" in intent or "likely" in intent):
        scored_rows = _demographic_purchase_answer_rows(rows, "Boomers", "Midwest")
        top = scored_rows[0] if scored_rows else {}
        return {
            "answer": (
                f"{prefix} The strongest governed fallback match for Boomers in the Midwest is "
                f"{top.get('asset_name', top.get('creative_asset_id', 'N/A'))}, driven by synthetic score, "
                "CTV/live-sports affinity, and purchase-intent lift."
            ),
            "result": {
                "title": "Boomers in the Midwest resonance ranking",
                "rows": _table_rows(
                    scored_rows,
                    [
                        ("creative_asset_id", "Creative ID"),
                        ("asset_name", "Creative"),
                        ("cohort_name", "Audience"),
                        ("overall_score", "Synthetic"),
                        ("purchase_intent_score", "Intent"),
                        ("recommended_channel", "Channel"),
                        ("resonance_score", "Resonance"),
                    ],
                ),
            },
        }

    if ("millennials" in intent and "boomers" in intent) or "generation" in intent and "performs best" in intent:
        comparison = []
        for generation, region in [("Boomers", "Midwest"), ("Millennials", "Midwest")]:
            rows_for_generation = _demographic_purchase_answer_rows(rows, generation, region)
            if rows_for_generation:
                comparison.append(rows_for_generation[0])
        return {
            "answer": f"{prefix} Compared the strongest governed fallback creative for millennials versus boomers.",
            "result": {
                "title": "Generation-level creative comparison",
                "rows": _table_rows(
                    comparison,
                    [
                        ("generation", "Generation"),
                        ("region", "Region"),
                        ("creative_asset_id", "Creative ID"),
                        ("asset_name", "Creative"),
                        ("purchase_intent_score", "Intent"),
                        ("resonance_score", "Resonance"),
                    ],
                ),
            },
        }

    if "purchase intent" in intent or "strongest purchase" in intent:
        purchase_by_cohort = {_as_text(item.get("cohort_id")): item for item in rows["purchase_signals"]}
        scored = []
        for evaluation in rows["evaluations"]:
            purchase = purchase_by_cohort.get(_as_text(evaluation.get("cohort_id")), {})
            variant = variant_by_id.get(_as_text(evaluation.get("creative_asset_id")), {})
            if not purchase:
                continue
            scored.append(
                {
                    "creative_asset_id": evaluation.get("creative_asset_id"),
                    "asset_name": variant.get("asset_name"),
                    "cohort_name": audience_by_id.get(_as_text(evaluation.get("cohort_id")), {}).get("cohort_name"),
                    "overall_score": evaluation.get("overall_score"),
                    "purchase_intent_score": purchase.get("purchase_intent_score"),
                    "recommended_channel": purchase.get("recommended_channel"),
                    "trigger": purchase.get("trigger"),
                }
            )
        scored = sorted(scored, key=lambda item: (_as_float_value(item.get("purchase_intent_score")), _as_float_value(item.get("overall_score"))), reverse=True)
        return {
            "answer": f"{prefix} Ranked variants by purchase-intent signal and synthetic audience score.",
            "result": {
                "title": "Purchase intent leaders",
                "rows": _table_rows(
                    scored,
                    [
                        ("creative_asset_id", "Creative ID"),
                        ("asset_name", "Creative"),
                        ("cohort_name", "Audience"),
                        ("overall_score", "Synthetic"),
                        ("purchase_intent_score", "Intent"),
                        ("recommended_channel", "Channel"),
                    ],
                ),
            },
        }

    if "how is creative" in intent and "performing against" in intent:
        token_parts = _as_text(question).replace("?", "").split()
        creative_token = next((part.strip(",") for part in token_parts if part.upper().startswith(("VAR-", "CR-"))), "")
        normalized_question = _normalized_token(question)
        matching = []
        for evaluation in rows["evaluations"]:
            creative_id = _as_text(evaluation.get("creative_asset_id"))
            audience = audience_by_id.get(_as_text(evaluation.get("cohort_id")), {})
            if creative_token and creative_id != creative_token:
                continue
            if not creative_token and creative_id.lower() not in normalized_question:
                continue
            matching.append(
                {
                    **evaluation,
                    "asset_name": variant_by_id.get(creative_id, {}).get("asset_name"),
                    "cohort_name": audience.get("cohort_name"),
                    "recommended_channel": next(
                        (
                            item.get("recommended_channel_label")
                            for item in _evaluation_channel_matrix_rows(rows)
                            if item.get("evaluation_id") == evaluation.get("evaluation_id")
                        ),
                        "",
                    ),
                }
            )
        if not matching:
            matching = sorted(rows["evaluations"], key=lambda item: _as_float_value(item.get("overall_score")), reverse=True)[:5]
            matching = [
                {
                    **evaluation,
                    "asset_name": variant_by_id.get(_as_text(evaluation.get("creative_asset_id")), {}).get("asset_name"),
                    "cohort_name": audience_by_id.get(_as_text(evaluation.get("cohort_id")), {}).get("cohort_name"),
                }
                for evaluation in matching
            ]
        return {
            "answer": f"{prefix} Returned synthetic performance rows for the requested creative and audience wording.",
            "result": {
                "title": "Creative performance against audience",
                "rows": _table_rows(
                    matching,
                    [
                        ("creative_asset_id", "Creative ID"),
                        ("asset_name", "Creative"),
                        ("cohort_name", "Audience"),
                        ("placement", "Placement"),
                        ("overall_score", "Overall"),
                        ("click_propensity_score", "Click"),
                        ("brand_fit_score", "Brand Fit"),
                        ("recommended_channel", "Channel"),
                    ],
                ),
            },
        }

    if "base creative assets" in intent or "homepage hero placements" in intent:
        assets = [
            asset
            for asset in rows["base_assets"]
            if _as_text(asset.get("placement")) == "homepage_hero"
            and "sports" in _normalized_token(
                " ".join(
                    [
                        _as_text(asset.get("asset_name")),
                        _as_text(asset.get("demo_category")),
                        _as_text(asset.get("content_tags")),
                        _as_text(asset.get("description")),
                    ]
                )
            )
        ]
        return {
            "answer": f"{prefix} Found {len(assets)} homepage hero sports seed assets available for governed generation.",
            "result": {
                "title": "Homepage hero sports assets",
                "rows": _table_rows(
                    assets,
                    [
                        ("asset_id", "Asset ID"),
                        ("asset_name", "Asset"),
                        ("demo_category", "Category"),
                        ("status", "Status"),
                        ("brand_safety_score", "Brand Safety"),
                    ],
                ),
            },
        }

    if "policy checks" in intent and ("blocked" in intent or "warning" in intent or "review" in intent):
        checks = [
            {
                **check,
                "creative_name": _as_text(variant_by_id.get(_as_text(check.get("creative_asset_id")), {}).get("asset_name")),
            }
            for check in rows["policy_checks"]
            if _as_text(check.get("check_status")).lower() in {"block", "blocked", "fail", "failed", "warn", "warning"}
            or _as_bool_value(check.get("review_required"))
        ]
        return {
            "answer": f"{prefix} Found {len(checks)} policy checks that are warnings, blockers, or review-required.",
            "result": {
                "title": "Policy checks requiring attention",
                "rows": _table_rows(
                    checks,
                    [
                        ("check_id", "Check"),
                        ("creative_asset_id", "Creative ID"),
                        ("creative_name", "Creative"),
                        ("check_type", "Check Type"),
                        ("check_status", "Status"),
                        ("score", "Score"),
                        ("blocking_reason", "Evidence"),
                    ],
                ),
            },
        }

    if "pending review variants" in intent or "missing policy checks" in intent:
        checked_ids = {_as_text(check.get("creative_asset_id")) for check in rows["policy_checks"]}
        evaluated_ids = {_as_text(evaluation.get("creative_asset_id")) for evaluation in rows["evaluations"]}
        pending = []
        for variant in variants:
            if _as_text(variant.get("approval_status")).lower() != "pending_review":
                continue
            creative_id = _as_text(variant.get("creative_asset_id"))
            missing = []
            if creative_id not in checked_ids:
                missing.append("policy checks")
            if creative_id not in evaluated_ids:
                missing.append("synthetic evaluation")
            if missing:
                pending.append({**variant, "missing": ", ".join(missing)})
        return {
            "answer": f"{prefix} Found {len(pending)} pending-review variants missing policy checks or synthetic evaluations.",
            "result": {
                "title": "Pending review gaps",
                "rows": _table_rows(
                    pending,
                    [
                        ("creative_asset_id", "Creative ID"),
                        ("asset_name", "Creative"),
                        ("placement", "Placement"),
                        ("target_segment", "Segment"),
                        ("missing", "Missing"),
                    ],
                ),
            },
        }

    if "live performance" in intent or "synthetic audience predictions" in intent:
        evaluations_by_creative = {
            _as_text(evaluation.get("creative_asset_id")): evaluation for evaluation in rows["evaluations"]
        }
        deltas = []
        for activation in rows["activations"]:
            creative_id = _as_text(activation.get("creative_asset_id"))
            evaluation = evaluations_by_creative.get(creative_id)
            if not evaluation:
                continue
            impressions = max(_as_int_value(activation.get("impressions")), 1)
            live_ctr = (_as_int_value(activation.get("clicks")) / impressions) * 100
            predicted = _as_float_value(evaluation.get("click_propensity_score"))
            deltas.append(
                {
                    **activation,
                    "live_ctr": live_ctr,
                    "synthetic_score": predicted,
                    "gap": abs(live_ctr - predicted),
                }
            )
        deltas = sorted(deltas, key=lambda item: _as_float_value(item.get("gap")), reverse=True)
        return {
            "answer": f"{prefix} Ranked live activation rows by the largest gap versus synthetic click-propensity score.",
            "result": {
                "title": "Live vs synthetic gaps",
                "rows": _table_rows(
                    deltas,
                    [
                        ("creative_asset_id", "Creative ID"),
                        ("destination_platform", "Platform"),
                        ("placement", "Placement"),
                        ("live_ctr", "Live CTR"),
                        ("synthetic_score", "Synthetic Score"),
                        ("gap", "Gap"),
                    ],
                ),
            },
        }

    if "briefs have generated variants" in intent:
        policy_ids = {_as_text(check.get("creative_asset_id")) for check in rows["policy_checks"]}
        export_ids = {_as_text(export.get("creative_asset_id")) for export in rows["activation_exports"]}
        summary = []
        for brief in rows["briefs"]:
            brief_variants = [variant for variant in variants if variant.get("brief_id") == brief.get("brief_id")]
            if not brief_variants:
                continue
            summary.append(
                {
                    "brief_name": brief.get("brief_name"),
                    "variants": len(brief_variants),
                    "approved": sum(1 for item in brief_variants if _as_text(item.get("approval_status")).lower() == "approved"),
                    "with_policy": sum(1 for item in brief_variants if _as_text(item.get("creative_asset_id")) in policy_ids),
                    "activation_exports": sum(1 for item in brief_variants if _as_text(item.get("creative_asset_id")) in export_ids),
                }
            )
        return {
            "answer": f"{prefix} Summarized briefs with generated variants, approved winners, policy coverage, and activation exports.",
            "result": {
                "title": "Brief workflow coverage",
                "rows": _table_rows(
                    summary,
                    [
                        ("brief_name", "Brief"),
                        ("variants", "Variants"),
                        ("approved", "Approved"),
                        ("with_policy", "With Policy"),
                        ("activation_exports", "Exports"),
                    ],
                ),
            },
        }

    if "ready for onsite personalization" in intent or "ready for activation" in intent:
        blocked_ids = {
            _as_text(check.get("creative_asset_id"))
            for check in rows["policy_checks"]
            if _as_text(check.get("check_status")).lower() in {"block", "blocked", "fail", "failed"}
        }
        exported_ids = {_as_text(export.get("creative_asset_id")) for export in rows["activation_exports"]}
        ready = [
            {
                **variant,
                "export_status": "exported" if _as_text(variant.get("creative_asset_id")) in exported_ids else "not exported",
            }
            for variant in variants
            if _as_text(variant.get("approval_status")).lower() == "approved"
            and _as_text(variant.get("creative_asset_id")) not in blocked_ids
        ]
        return {
            "answer": f"{prefix} Found {len(ready)} approved creatives without blocking policy checks.",
            "result": {
                "title": "Activation-ready creatives",
                "rows": _table_rows(
                    ready,
                    [
                        ("creative_asset_id", "Creative ID"),
                        ("asset_name", "Creative"),
                        ("placement", "Placement"),
                        ("target_segment", "Segment"),
                        ("export_status", "Export"),
                    ],
                ),
            },
        }

    if "rights constraints" in intent or "social or newsletter" in intent:
        constrained = []
        for asset in rows["base_assets"]:
            contexts = _loads_json(asset.get("approved_usage_contexts_json"), [])
            if not isinstance(contexts, list):
                contexts = []
            missing = [channel for channel in ["social", "email"] if channel not in contexts]
            if missing:
                constrained.append({**asset, "blocked_contexts": ", ".join(missing)})
        return {
            "answer": f"{prefix} Found {len(constrained)} base assets without social and/or newsletter usage rights.",
            "result": {
                "title": "Base asset rights constraints",
                "rows": _table_rows(
                    constrained,
                    [
                        ("asset_id", "Asset ID"),
                        ("asset_name", "Asset"),
                        ("approved_usage_contexts_json", "Allowed Contexts"),
                        ("blocked_contexts", "Blocked Contexts"),
                    ],
                ),
            },
        }

    if "audience traits" in intent or "churn risk sports" in intent:
        churn_cohort_ids = {
            _as_text(audience.get("cohort_id"))
            for audience in rows["audiences"]
            if "churn" in _as_text(audience.get("cohort_name")).lower()
            or "sports" in _as_text(audience.get("cohort_name")).lower()
        }
        traits = [
            {
                **trait,
                "cohort_name": _as_text(audience_by_id.get(_as_text(trait.get("cohort_id")), {}).get("cohort_name")),
            }
            for trait in rows["audience_traits"]
            if _as_text(trait.get("cohort_id")) in churn_cohort_ids
        ]
        return {
            "answer": f"{prefix} Returned audience traits that should shape churn-risk sports creative direction.",
            "result": {
                "title": "Audience creative implications",
                "rows": _table_rows(
                    traits,
                    [
                        ("cohort_name", "Cohort"),
                        ("lifecycle_stage", "Lifecycle"),
                        ("preferred_tone", "Tone"),
                        ("engagement_style", "Engagement"),
                        ("creative_implications_text", "Creative Direction"),
                    ],
                ),
            },
        }

    if "generation model" in intent and ("strongest" in intent or "best" in intent):
        approved_ids = {
            _as_text(variant.get("creative_asset_id"))
            for variant in variants
            if _as_text(variant.get("approval_status")).lower() == "approved"
        }
        scored = [
            {
                **evaluation,
                "asset_name": variant_by_id.get(_as_text(evaluation.get("creative_asset_id")), {}).get("asset_name"),
                "generation_model": variant_by_id.get(_as_text(evaluation.get("creative_asset_id")), {}).get("generation_model"),
                "approval_status": variant_by_id.get(_as_text(evaluation.get("creative_asset_id")), {}).get("approval_status"),
            }
            for evaluation in rows["evaluations"]
            if _as_text(evaluation.get("creative_asset_id")) in approved_ids
        ]
        scored = sorted(scored, key=lambda item: _as_float_value(item.get("overall_score")), reverse=True)
        return {
            "answer": f"{prefix} The strongest approved creative is ranked by backend synthetic score and grouped with its generation model.",
            "result": {
                "title": "Strongest approved creative by generation model",
                "rows": _table_rows(
                    scored,
                    [
                        ("creative_asset_id", "Creative ID"),
                        ("asset_name", "Creative"),
                        ("generation_model", "Model"),
                        ("overall_score", "Overall"),
                        ("rank_within_segment_placement", "Rank"),
                        ("approval_status", "Approval"),
                    ],
                ),
            },
        }

    if "generation model endpoints" in intent or "produced current variants" in intent:
        model_rows = [
            {
                "generation_model": variant.get("generation_model"),
                "creative_asset_id": variant.get("creative_asset_id"),
                "asset_name": variant.get("asset_name"),
                "approval_status": variant.get("approval_status"),
                "placement": variant.get("placement"),
            }
            for variant in variants
        ]
        return {
            "answer": f"{prefix} Listed current variants with their generation endpoint and approval state.",
            "result": {
                "title": "Variant generation endpoints",
                "rows": _table_rows(
                    model_rows,
                    [
                        ("creative_asset_id", "Creative ID"),
                        ("asset_name", "Creative"),
                        ("generation_model", "Model"),
                        ("approval_status", "Approval"),
                        ("placement", "Placement"),
                    ],
                ),
            },
        }

    if "approved creative variants rank highest" in intent or "rank highest by segment" in intent:
        top_evaluations = [
            {
                **evaluation,
                "asset_name": _as_text(variant_by_id.get(_as_text(evaluation.get("creative_asset_id")), {}).get("asset_name")),
                "approval_status": _as_text(variant_by_id.get(_as_text(evaluation.get("creative_asset_id")), {}).get("approval_status")),
                "cohort_name": _as_text(audience_by_id.get(_as_text(evaluation.get("cohort_id")), {}).get("cohort_name")),
            }
            for evaluation in rows["evaluations"]
            if _as_int_value(evaluation.get("rank_within_segment_placement")) == 1
            and _as_text(variant_by_id.get(_as_text(evaluation.get("creative_asset_id")), {}).get("approval_status")).lower() == "approved"
        ]
        return {
            "answer": f"{prefix} Returned rank-1 approved variants by cohort and placement.",
            "result": {
                "title": "Top approved variants",
                "rows": _table_rows(
                    top_evaluations,
                    [
                        ("cohort_name", "Cohort"),
                        ("placement", "Placement"),
                        ("creative_asset_id", "Creative ID"),
                        ("asset_name", "Creative"),
                        ("overall_score", "Overall Score"),
                    ],
                ),
            },
        }

    if "synthetic audience scores" in intent:
        eval_rows = [
            {
                **evaluation,
                "asset_name": _as_text(variant_by_id.get(_as_text(evaluation.get("creative_asset_id")), {}).get("asset_name")),
                "cohort_name": _as_text(audience_by_id.get(_as_text(evaluation.get("cohort_id")), {}).get("cohort_name")),
            }
            for evaluation in sorted(rows["evaluations"], key=lambda item: _as_float_value(item.get("overall_score")), reverse=True)
        ]
        return {
            "answer": f"{prefix} Compared synthetic audience scores by placement, cohort, and variant.",
            "result": {
                "title": "Synthetic audience scores",
                "rows": _table_rows(
                    eval_rows,
                    [
                        ("cohort_name", "Cohort"),
                        ("placement", "Placement"),
                        ("creative_asset_id", "Creative ID"),
                        ("asset_name", "Creative"),
                        ("overall_score", "Overall"),
                        ("rank_within_segment_placement", "Rank"),
                    ],
                ),
            },
        }

    if "transformations were applied" in intent or "crop" in intent or "inpaint" in intent or "outpaint" in intent:
        transform_rows = [
            {
                **transformation,
                "asset_name": _as_text(variant_by_id.get(_as_text(transformation.get("creative_asset_id")), {}).get("asset_name")),
                "generation_model": _as_text(
                    transformation.get("tool_or_model")
                    or variant_by_id.get(_as_text(transformation.get("creative_asset_id")), {}).get("generation_model"),
                    "N/A",
                ),
            }
            for transformation in rows["transformations"]
        ]
        return {
            "answer": f"{prefix} Listed image transformation steps applied to generated variants.",
            "result": {
                "title": "Creative transformation ledger",
                "rows": _table_rows(
                    transform_rows,
                    [
                        ("creative_asset_id", "Creative ID"),
                        ("asset_name", "Creative"),
                        ("generation_model", "Model"),
                        ("transformation_type", "Transformation"),
                        ("edit_sequence", "Step"),
                        ("edit_goal", "Edit Goal"),
                        ("placement", "Placement"),
                    ],
                ),
            },
        }

    response = next((value for key, value in MOCK_RESPONSES.items() if key in question.lower()), None)
    if response:
        return {"answer": f"{prefix} Returned the matching local dashboard result.", "result": response}

    suggested = _genie_recommended_questions()[:8]
    return {
        "answer": (
            f"{prefix} I could not map that wording to a governed workflow answer. "
            "Try one of the curated questions shown below."
        ),
        "result": {
            "title": "Curated Ask AI questions",
            "rows": [{"Question": item} for item in suggested],
        },
    }


def _extract_model_text(response: Any) -> str:
    if isinstance(response, dict):
        choices = response.get("choices")
        if isinstance(choices, list) and choices:
            message = choices[0].get("message") if isinstance(choices[0], dict) else None
            if isinstance(message, dict) and message.get("content"):
                return str(message["content"])
            if isinstance(choices[0], dict) and choices[0].get("text"):
                return str(choices[0]["text"])
        predictions = response.get("predictions")
        if isinstance(predictions, list) and predictions:
            return str(predictions[0])
        if response.get("content"):
            return str(response["content"])
    return ""


def _invoke_model_endpoint(
    endpoint_name: str,
    purpose: str,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 700,
) -> dict[str, Any]:
    invocation: dict[str, Any] = {
        "endpoint": endpoint_name,
        "purpose": purpose,
        "mode": CREATIVE_GENERATION_MODE,
        "status": "configured",
    }
    if not endpoint_name or CREATIVE_GENERATION_MODE not in {"model_endpoint", "databricks", "serving", "external"}:
        return invocation
    if not _has_direct_databricks_auth() and not Path("/databricks").exists():
        invocation["status"] = "metadata_only"
        invocation["error"] = "Databricks auth environment is not present in this local process."
        return invocation

    try:
        body = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.35,
            "max_tokens": max_tokens,
        }
        host = os.getenv("DATABRICKS_HOST", "").rstrip("/")
        token = os.getenv("DATABRICKS_TOKEN")
        if host and token:
            import requests

            response_payload: dict[str, Any] | list[Any] | None = None
            last_error = ""
            for path in (
                f"{host}/serving-endpoints/{endpoint_name}/invocations",
                f"{host}/api/2.0/serving-endpoints/{endpoint_name}/invocations",
            ):
                response = requests.post(
                    path,
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json=body,
                    timeout=CREATIVE_MODEL_ENDPOINT_TIMEOUT_SECONDS,
                )
                if response.ok:
                    response_payload = response.json()
                    break
                last_error = f"HTTP {response.status_code}: {response.text[:260]}"
            if response_payload is None:
                raise RuntimeError(last_error or "Model serving endpoint request failed")
            response = response_payload
        else:
            response = _workspace_client().api_client.do(
                "POST",
                f"/api/2.0/serving-endpoints/{endpoint_name}/invocations",
                body=body,
            )
        invocation["status"] = "invoked"
        invocation["response_text"] = _extract_model_text(response)[:1200]
    except Exception as exc:
        invocation["status"] = "metadata_only"
        invocation["error"] = f"{type(exc).__name__}: {str(exc)[:420]}"
    return invocation


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
        "estimated_reach": _as_int(row.get("estimated_reach") or row.get("reach", "0")),
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
            "match_rate": _derived_audience_match_rate(row),
            "avg_ltv": _derived_audience_ltv(row),
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


def _load_databricks_quality_radar() -> list[dict[str, Any]]:
    table = _pipeline_table("gold_creative_quality_scorecard")
    rows = _execute_sql(f"SELECT axis, score FROM {table} ORDER BY axis LIMIT 25", row_limit=25)
    quality_rows = [{"axis": _as_text(row.get("axis")), "score": _as_int_value(row.get("score"))} for row in rows]
    _table_source("quality_radar", table, len(quality_rows))
    return quality_rows or QUALITY_RADAR


def _load_databricks_activity() -> list[dict[str, Any]]:
    table = _pipeline_table("gold_campaign_activity_stream")
    rows = _execute_sql(f"SELECT event, detail, `time`, type FROM {table} LIMIT 25", row_limit=25)
    activity_rows = [
        {
            "event": _as_text(row.get("event")),
            "detail": _as_text(row.get("detail")),
            "time": _as_text(row.get("time")),
            "type": _as_text(row.get("type")),
        }
        for row in rows
    ]
    _table_source("activity", table, len(activity_rows))
    return activity_rows or ACTIVITY


def _load_databricks_markets() -> list[dict[str, Any]]:
    market_table = _pipeline_table("gold_market_opportunity")
    city_table = _pipeline_table("gold_market_metro_detail")
    trend_table = _pipeline_table("gold_market_reach_trend")
    mix_table = _pipeline_table("gold_market_audience_mix")

    market_rows = _execute_sql(
        f"""
        SELECT
          id,
          name,
          short_name,
          states_json,
          reach,
          spend,
          ctr,
          conversion_lift,
          priority,
          signal,
          top_audience,
          recommended_action
        FROM {market_table}
        ORDER BY reach DESC
        LIMIT 100
        """,
        row_limit=100,
    )
    city_rows = _execute_sql(
        f"SELECT region_id, name, state, CAST(0 AS INT) AS x, CAST(0 AS INT) AS y, reach, ctr, lift FROM {city_table} LIMIT 500",
        row_limit=500,
    )
    trend_rows = _execute_sql(
        f"SELECT region_id, week, reach, conversions FROM {trend_table} LIMIT 500",
        row_limit=500,
    )
    mix_rows = _execute_sql(
        f"SELECT region_id, name, value FROM {mix_table} LIMIT 500",
        row_limit=500,
    )

    cities_by_region: dict[str, list[dict[str, Any]]] = {}
    for row in city_rows:
        cities_by_region.setdefault(_as_text(row.get("region_id")), []).append(
            {
                "name": _as_text(row.get("name")),
                "state": _as_text(row.get("state")),
                "x": _as_int_value(row.get("x")),
                "y": _as_int_value(row.get("y")),
                "reach": _as_int_value(row.get("reach")),
                "ctr": _as_float_value(row.get("ctr")),
                "lift": _as_float_value(row.get("lift")),
            }
        )

    trend_by_region: dict[str, list[dict[str, Any]]] = {}
    for row in trend_rows:
        trend_by_region.setdefault(_as_text(row.get("region_id")), []).append(
            {
                "week": _as_text(row.get("week")),
                "reach": _as_int_value(row.get("reach")),
                "conversions": _as_int_value(row.get("conversions")),
            }
        )

    mix_by_region: dict[str, list[dict[str, Any]]] = {}
    for row in mix_rows:
        mix_by_region.setdefault(_as_text(row.get("region_id")), []).append(
            {"name": _as_text(row.get("name")), "value": _as_int_value(row.get("value"))}
        )

    markets = []
    for row in market_rows:
        region_id = _as_text(row.get("id"))
        states = _loads_json(row.get("states_json"), [])
        markets.append(
            {
                "id": region_id,
                "name": _as_text(row.get("name")),
                "short_name": _as_text(row.get("short_name")),
                "states": states if isinstance(states, list) else _split_tags(row.get("states_json")),
                "reach": _as_int_value(row.get("reach")),
                "spend": _as_int_value(row.get("spend")),
                "ctr": _as_float_value(row.get("ctr")),
                "conversion_lift": _as_float_value(row.get("conversion_lift")),
                "priority": _as_text(row.get("priority")),
                "signal": _as_text(row.get("signal")),
                "top_audience": _as_text(row.get("top_audience")),
                "recommended_action": _as_text(row.get("recommended_action")),
                "cities": cities_by_region.get(region_id, []),
                "trend": trend_by_region.get(region_id, []),
                "audience_mix": mix_by_region.get(region_id, []),
            }
        )

    _table_source("markets", market_table, len(markets))
    _table_source("market_cities", city_table, len(city_rows))
    _table_source("market_trend", trend_table, len(trend_rows))
    _table_source("market_audience_mix", mix_table, len(mix_rows))
    return markets or MARKET_REGIONS


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
        data["markets"] = _load_databricks_markets()
    except Exception as exc:
        _table_error("markets", exc)

    try:
        quality_radar = _load_databricks_quality_radar()
    except Exception as exc:
        _table_error("quality_radar", exc)
        quality_radar = QUALITY_RADAR

    try:
        activity = _load_databricks_activity()
    except Exception as exc:
        _table_error("activity", exc)
        activity = _activity_from(data["activations"])

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
        "quality_radar": quality_radar,
        "activity": activity,
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
    {
        "name": "audience_trait_profiles",
        "endpoint": "/api/audience-traits",
        "lakehouse_table": "gold_buyside_audience_trait_profile",
        "description": "Audience traits that influence creative brief, tone, placement, and generation instructions.",
    },
    {
        "name": "brand_guidelines",
        "endpoint": "/api/brand-guidelines",
        "lakehouse_table": "gold_buyside_brand_guideline_profile",
        "description": "Generated CME Streaming brand guideline profile used for governed creative generation and policy evidence.",
    },
    {
        "name": "generation_models",
        "endpoint": "/api/generation-models",
        "lakehouse_table": "gold_buyside_generation_model_option",
        "description": "Summit demo model dropdown options, modalities, endpoint names, and governance notes.",
    },
    {
        "name": "audience_demographics",
        "endpoint": "/api/audience-demographics",
        "lakehouse_table": "gold_buyside_audience_demographic_signal",
        "description": "Governed demographic signals used by Genie fallback answers for live demo questions.",
    },
    {
        "name": "purchase_signals",
        "endpoint": "/api/purchase-signals",
        "lakehouse_table": "gold_buyside_purchase_intent_signal",
        "description": "Synthetic purchase-intent signals by generation, region, cohort, and recommended activation channel.",
    },
    {
        "name": "evaluation_channel_matrix",
        "endpoint": "/api/evaluation-channel-matrix",
        "lakehouse_table": "gold_buyside_evaluation_channel_matrix",
        "description": "Backend-computed channel projections and explanation IDs for activation decisions.",
    },
    {
        "name": "evaluation_rubrics",
        "endpoint": "/api/evaluation-rubrics",
        "lakehouse_table": "gold_buyside_synthetic_eval_rubric",
        "description": "Scoring weights, criteria, and judge model metadata used to explain synthetic evaluations.",
    },
    {
        "name": "base_creative_assets",
        "endpoint": "/api/creative-assets/search",
        "lakehouse_table": "gold_buyside_base_creative_asset",
        "description": "Governed source creative assets with rights metadata, prior performance, and approved usage contexts.",
    },
    {
        "name": "creative_generation_requests",
        "endpoint": "/api/creative-generation/requests",
        "lakehouse_table": "gold_buyside_creative_generation_request",
        "description": "Creative generation request records tying brief, audience, placement, base assets, prompts, and model mode.",
    },
    {
        "name": "creative_variants",
        "endpoint": "/api/creative-variants",
        "lakehouse_table": "gold_buyside_creative_variant",
        "description": "Generated and adapted image creative variants with storage URIs and prompt lineage.",
    },
    {
        "name": "creative_transformations",
        "endpoint": "/api/creative-transformations",
        "lakehouse_table": "gold_buyside_creative_transformation",
        "description": "Resize, reformat, crop, inpaint, outpaint, cleanup, background extension, text-safe-area, and aspect-ratio edit records.",
    },
    {
        "name": "creative_policy_checks",
        "endpoint": "/api/policy-checks",
        "lakehouse_table": "gold_buyside_creative_policy_check",
        "description": "Brand, rights, regional usage, and safety checks for generated or modified creative variants.",
    },
    {
        "name": "synthetic_audience_evaluations",
        "endpoint": "/api/synthetic-evaluations",
        "lakehouse_table": "gold_buyside_synthetic_audience_eval",
        "description": "Synthetic audience response predictions and rankings for variants by segment and placement.",
    },
    {
        "name": "activation_exports",
        "endpoint": "/api/activation-exports",
        "lakehouse_table": "gold_buyside_activation_export",
        "description": "Onsite personalization export payload records for approved variants.",
    },
]


class AskRequest(BaseModel):
    question: str


class CreativeGenerationRequestIn(BaseModel):
    brief_id: str
    cohort_id: str
    placement: str = "homepage_hero"
    category: str = ""
    content_type: str = "image"
    brand_guideline_id: str = ""
    generation_model_ids: list[str] = []
    generation_model_id: str = ""
    image_model_id: str = ""
    compare_model_ids: list[str] = []
    video_source_asset_id: str = ""
    end_card_text: str = ""
    cta_text: str = ""
    user_instructions: str = ""
    retrieval_query: str = ""
    selected_base_asset_ids: list[str] = []
    requested_variant_count: int = 4


class CreativeAdaptRequest(BaseModel):
    placement: str
    transformation_type: str = "resize"
    edit_types: list[str] = []
    output_format: str = "SVG"


class SyntheticEvaluationRunRequest(BaseModel):
    creative_asset_ids: list[str] = []
    cohort_id: Optional[str] = None
    placement: Optional[str] = None


class ActivationExportRequest(BaseModel):
    creative_asset_id: str
    cohort_id: str
    placement: str
    destination_system: str = ACTIVATION_DESTINATION_SYSTEM
    budget: Optional[float] = None


class CreativeApprovalRequest(BaseModel):
    decision: str = "Approved"
    reviewer: str = "app_user"
    review_notes: str = ""
    evaluation_id: Optional[str] = None
    require_evaluation: bool = True
    variant_snapshot: Optional[dict[str, Any]] = None


def _totals() -> dict[str, Any]:
    return _totals_for(BRIEFS, CREATIVES, ACTIVATIONS)


def _loads_json(value: Any, default: Any) -> Any:
    if value is None:
        return default
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(str(value))
    except Exception:
        return default


def _creative_volume_uri(*parts: str) -> str:
    prefix = f"{CREATIVE_ASSET_PREFIX}/" if CREATIVE_ASSET_PREFIX else ""
    return f"/Volumes/{PIPELINE_CATALOG}/{PIPELINE_SCHEMA}/{CREATIVE_ASSET_VOLUME}/{prefix}" + "/".join(parts)


def _placement_spec(placement: str) -> dict[str, Any]:
    return PLACEMENT_SPECS.get(placement, PLACEMENT_SPECS["homepage_hero"])


def _default_brand_guideline() -> dict[str, Any]:
    rows = _brand_guidelines_data()
    return rows[0] if rows else BRAND_GUIDELINES[0]


def _brand_guideline_by_id(guideline_id: str) -> dict[str, Any]:
    return next((item for item in _brand_guidelines_data() if item["guideline_id"] == guideline_id), _default_brand_guideline())


def _model_option_by_id(model_id: str) -> dict[str, Any]:
    model_options = _generation_model_options_data()
    if model_id:
        match = next((item for item in model_options if item["model_id"] == model_id), None)
        if match:
            return match
    return next((item for item in model_options if item.get("default")), model_options[0])


def _model_options_for_content(content_type: str) -> list[dict[str, Any]]:
    normalized = _as_text(content_type, "image").lower()
    model_options = _generation_model_options_data()
    if normalized in {"video", "video_endcard", "video_end_card", "mp4"}:
        return model_options
    return [item for item in model_options if item.get("modality") != "video"] or model_options


def _resolve_generation_model(payload: CreativeGenerationRequestIn) -> dict[str, Any]:
    requested = payload.generation_model_id or payload.image_model_id
    if not requested and _as_text(payload.content_type).lower() in {"video", "video_endcard", "video_end_card", "mp4"}:
        requested = "runway-gen3-video-endcard"
    return _model_option_by_id(requested)


def _resolve_generation_models(payload: CreativeGenerationRequestIn, is_video: bool) -> list[dict[str, Any]]:
    requested_ids = [
        _as_text(model_id)
        for model_id in [
            *payload.generation_model_ids,
            payload.generation_model_id,
            payload.image_model_id,
            *payload.compare_model_ids,
        ]
        if _as_text(model_id)
    ]
    seen: set[str] = set()
    requested_models = []
    for model_id in requested_ids:
        model = _model_option_by_id(model_id)
        resolved_id = _as_text(model.get("model_id"))
        if not resolved_id or resolved_id in seen:
            continue
        if is_video and _as_text(model.get("modality")) != "video":
            continue
        if not is_video and _as_text(model.get("modality")) == "video":
            continue
        seen.add(resolved_id)
        requested_models.append(model)
    if requested_models:
        return requested_models
    model_options = _generation_model_options_data()
    if is_video:
        return [item for item in model_options if _as_text(item.get("modality")) == "video"] or [_model_option_by_id("runway-gen3-video-endcard")]
    return [item for item in model_options if _as_text(item.get("modality")) != "video"] or [_model_option_by_id("")]


def _is_video_content(content_type: str) -> bool:
    return _as_text(content_type, "image").lower() in {"video", "video_endcard", "video_end_card", "mp4"}


def _video_treatment_for(category: Any = "", placement: Any = "", variant_number: int = 1) -> dict[str, Any]:
    category_token = _normalized_token(category)
    if "family" in category_token:
        base_index = 1
    elif "premium" in category_token or "original" in category_token:
        base_index = 2
    elif "annual" in category_token or "upgrade" in category_token or "value" in category_token:
        base_index = 3
    elif "winback" in category_token or "event" in category_token:
        base_index = 4
    elif "sport" in category_token or "live" in category_token:
        base_index = 0
    else:
        base_index = int(_stable_fraction(category, placement, variant_number) * len(VIDEO_TREATMENTS)) % len(VIDEO_TREATMENTS)
    treatment = dict(VIDEO_TREATMENTS[(base_index + max(0, variant_number - 1)) % len(VIDEO_TREATMENTS)])
    treatment["variant_number"] = variant_number
    treatment["placement"] = _as_text(placement)
    treatment["category"] = _as_text(category)
    return treatment


def _video_copy_for_variant(base_headline: str, base_cta: str, variant_number: int) -> tuple[str, str]:
    headline = base_headline.strip() or "Live games. One streaming home."
    cta = base_cta.strip() or "Start watching"
    template, cta_template = VIDEO_COPY_VARIATIONS[(max(1, variant_number) - 1) % len(VIDEO_COPY_VARIATIONS)]
    return template.format(base=headline, cta=cta), cta_template.format(base=headline, cta=cta)


def _runtime_brief(brief_id: Any) -> dict[str, Any]:
    value = _as_text(brief_id)
    if not value:
        return {}
    try:
        return next((item for item in _runtime_data()["briefs"] if _as_text(item.get("brief_id")) == value), {})
    except Exception:
        return next((item for item in BRIEFS if _as_text(item.get("brief_id")) == value), {})


def _runtime_audience(cohort_id: Any) -> dict[str, Any]:
    value = _as_text(cohort_id)
    if not value:
        return {}
    try:
        return next((item for item in _runtime_data()["audiences"] if _as_text(item.get("cohort_id")) == value), {})
    except Exception:
        return next((item for item in AUDIENCES if _as_text(item.get("cohort_id")) == value), {})


def _creative_visual_treatment_for(
    brief: dict[str, Any] | None,
    audience: dict[str, Any] | None,
    category: Any,
    placement: Any,
    variant_number: int,
) -> dict[str, Any]:
    brief = brief or {}
    audience = audience or {}
    context = _normalized_token(
        " ".join(
            [
                _as_text(brief.get("brief_name")),
                _as_text(brief.get("campaign_objective")),
                _as_text(brief.get("target_audience_description")),
                _as_text(audience.get("cohort_name")),
                _as_text(audience.get("cohort_description")),
                _as_text(category),
                _as_text(placement),
            ]
        )
    )
    if any(token in context for token in ["family", "household", "co_viewing", "movie"]):
        base_index = 1
    elif any(token in context for token in ["premium", "original", "premiere", "upgrade_lookalike"]):
        base_index = 2
    elif any(token in context for token in ["trial", "annual", "upgrade", "conversion", "value"]):
        base_index = 3
    elif any(token in context for token in ["winback", "churn", "lapsed", "recover"]):
        base_index = 4
    elif any(token in context for token in ["sports", "live", "game", "event"]):
        base_index = 0
    else:
        base_index = int(_stable_fraction(context, variant_number) * len(CREATIVE_VISUAL_TREATMENTS)) % len(CREATIVE_VISUAL_TREATMENTS)
    treatment = dict(CREATIVE_VISUAL_TREATMENTS[(base_index + max(0, variant_number - 1)) % len(CREATIVE_VISUAL_TREATMENTS)])
    audience_name = _as_text(audience.get("cohort_name"), "Audience segment")
    audience_signal = _as_text(audience.get("cohort_description") or audience.get("feature_summary_text"), audience_name)
    brief_name = _as_text(brief.get("brief_name"), "Campaign brief")
    objective = _as_text(brief.get("campaign_objective"), "Audience-driven streaming creative")
    placement_label = _placement_spec(_as_text(placement)).get("label", _as_text(placement, "placement"))
    treatment.update(
        {
            "variant_number": variant_number,
            "audience_name": audience_name,
            "audience_signal": audience_signal,
            "brief_name": brief_name,
            "brief_signal": objective,
            "placement": _as_text(placement),
            "placement_label": placement_label,
            "category": _as_text(category),
            "headline": _as_text(treatment.get("headline"), treatment["copy_angle"]),
            "subheadline": f"{brief_name}",
            "supporting_copy": f"Designed for {audience_name}",
            "cta_text": _as_text(treatment.get("cta_text"), "Watch now"),
        }
    )
    return treatment


def _creative_visual_treatment_from_record(record: dict[str, Any]) -> dict[str, Any]:
    params = _loads_json(record.get("generation_params_json"), {})
    if isinstance(params, dict) and isinstance(params.get("visual_treatment"), dict):
        treatment = dict(params["visual_treatment"])
    else:
        treatment = {}
    legacy_treatment_ids = {
        "live-scorebug": "live-hero",
        "watchlist-rail": "family-feature",
        "premium-spotlight": "originals-spotlight",
        "value-badge": "upgrade-offer",
        "return-countdown": "winback-event",
    }
    stored_treatment_id = legacy_treatment_ids.get(_as_text(treatment.get("treatment_id")), _as_text(treatment.get("treatment_id")))
    fallback = _creative_visual_treatment_for(
        _runtime_brief(record.get("brief_id")),
        _runtime_audience(record.get("cohort_id")),
        record.get("reference_demo_category") or record.get("category") or record.get("asset_name"),
        record.get("placement"),
        _as_int_value(record.get("variant_number"), 1),
    )
    canonical = next(
        (dict(item) for item in CREATIVE_VISUAL_TREATMENTS if _as_text(item.get("treatment_id")) == stored_treatment_id),
        None,
    )
    if canonical:
        fallback.update(
            {
                **canonical,
                "headline": _as_text(canonical.get("headline"), canonical.get("copy_angle")),
                "cta_text": _as_text(canonical.get("cta_text"), fallback.get("cta_text")),
                "variant_number": fallback.get("variant_number"),
                "audience_name": fallback.get("audience_name"),
                "audience_signal": fallback.get("audience_signal"),
                "brief_name": fallback.get("brief_name"),
                "brief_signal": fallback.get("brief_signal"),
                "placement": fallback.get("placement"),
                "placement_label": fallback.get("placement_label"),
                "category": fallback.get("category"),
                "subheadline": fallback.get("subheadline"),
                "supporting_copy": fallback.get("supporting_copy"),
            }
        )
    return fallback


def _svg_text_lines(value: Any, max_chars: int, max_lines: int = 2) -> list[str]:
    words = _as_text(value).replace("\n", " ").split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word[:max_chars]
        if len(lines) >= max_lines:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    if not lines:
        lines.append("")
    if len(lines) > max_lines:
        lines = lines[:max_lines]
    if len(lines) == max_lines and words and len(" ".join(words)) > len(" ".join(lines)):
        lines[-1] = lines[-1].rstrip(".") + "..."
    return lines


def _has_direct_databricks_auth() -> bool:
    return bool(os.getenv("DATABRICKS_HOST")) and bool(
        os.getenv("DATABRICKS_TOKEN")
        or (os.getenv("DATABRICKS_CLIENT_ID") and os.getenv("DATABRICKS_CLIENT_SECRET"))
    )


IMAGE_FILE_EXTENSIONS = {".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"}

def _demo_mp4_bytes() -> bytes:
    # Browser-playable 20x20 H.264 MP4 fallback used when no external video renderer has written a file yet.
    payload = (
        "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAtJtZGF0AAACrQYF//+p3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzEwMyA5NDFjYWU2IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyMiAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFp"
        "bmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAAVZYiEABX//vfJ78Cm6/X2tb9gAQD5AAADBm1vb3YAAABsbXZoZAAAAADgYBEw4GARMAAAA+gAAAPoAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAIwdHJhawAAAFx0a2hkAAAAA+BgETDgYBEwAAAAAQAAAAAAAAPoAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAUAAAAFAAAAAAAJGVkdHMAAAAcZWxzdAAAAAAAAAABAAAD6AAAAAAAAQAAAAABqG1kaWEAAAAgbWRoZAAAAADgYBEw4GARMAAAQAAAAEAAVcQAAAAAAC1oZGxyAAAAAAAAAAB2aWRlAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAAVNtaW5mAAAAFHZtaGQAAAABAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAAETc3RibAAAAK9zdHNkAAAAAAAAAAEAAACfYXZjMQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAUABQASAAAAEgAAAAAAAAAARVMYXZjNTkuNTYuMTAwIGxpYngyNjQAAAAAAAAAAAAAABj//wAAADVhdmNDAWQAM//hABhnZAAzrNlJeeeEAAADAAQAAAMACDxgxlgBAAZo6+PLIsD9+PgAAAAAFGJ0cnQAAAAAAAAWUAAAFlAAAAAYc3R0cwAAAAAAAAABAAAAAQAAQAAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAEAAAABAAAAFHN0c3oAAAAAAAACygAAAAEAAAAUc3RjbwAAAAAAAAABAAAAMAAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNTkuMzUuMTAw"
    )
    return base64.b64decode(payload)


def _creative_seed_image_dir() -> Path:
    return Path(CREATIVE_SEED_IMAGE_PATH or _creative_volume_uri("seed_images"))


def _creative_video_seed_dir() -> Path:
    return Path(CREATIVE_VIDEO_SEED_PATH or _creative_volume_uri("video_seeds"))


def _media_type_for_path(path: Path) -> str:
    media_type, _ = mimetypes.guess_type(str(path))
    return media_type or "application/octet-stream"


def _is_uc_volume_path(path: Path) -> bool:
    return str(path).startswith("/Volumes/")


def _download_volume_file(path: Path) -> bytes | None:
    if not _is_uc_volume_path(path):
        return None
    try:
        response = _workspace_client().files.download(str(path))
        return response.contents.read()
    except Exception as exc:
        DATA_BACKEND_ERRORS.append(f"volume_file: {path}: {exc}")
        return None


def _upload_volume_file(path: Path, content: bytes) -> tuple[bool, str]:
    if not _is_uc_volume_path(path):
        return False, f"Not a UC Volume path: {path}"
    try:
        client = _workspace_client()
        client.files.create_directory(str(path.parent))
        client.files.upload(str(path), io.BytesIO(content), overwrite=True)
        return True, ""
    except Exception as exc:
        message = f"volume_upload: {path}: {exc}"
        DATA_BACKEND_ERRORS.append(message)
        return False, str(exc)


def _safe_volume_filename(value: Any, fallback: str) -> str:
    token = _as_text(value, fallback)
    clean = "".join(char if char.isalnum() or char in {"-", "_", "."} else "_" for char in token)
    return clean.strip("._") or fallback


def _media_extension(media_type: str, fallback: str) -> str:
    explicit = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/svg+xml": ".svg",
        "image/webp": ".webp",
        "video/mp4": ".mp4",
    }.get(media_type)
    extension = explicit or mimetypes.guess_extension(media_type) or fallback
    return extension if extension.startswith(".") else f".{extension}"


def _normal_slug(value: Any) -> str:
    token = _as_text(value).lower()
    return "_".join(part for part in "".join(char if char.isalnum() else " " for char in token).split() if part)


def _video_seed_filename_from_uri(uri: Any) -> str | None:
    value = _as_text(uri)
    prefix = "demo-video-seed://"
    if not value.startswith(prefix):
        return None
    return _safe_volume_filename(value.removeprefix(prefix).split("/")[-1], "video_seed.mp4")


def _demo_video_seed_path_from_uri(uri: Any) -> Path | None:
    filename = _video_seed_filename_from_uri(uri)
    if filename is None:
        return None
    path = DEMO_VIDEO_SEED_DIR / filename
    return path if path.exists() else None


def _load_video_seed_content(filename: str) -> bytes | None:
    volume_dir = _creative_video_seed_dir()
    if _is_uc_volume_path(volume_dir):
        volume_path = volume_dir / filename
        content = _download_volume_file(volume_path)
        if content is not None:
            return content
    local_path = DEMO_VIDEO_SEED_DIR / filename
    if local_path.exists():
        return local_path.read_bytes()
    return None


def _demo_video_seed_path_for_variant(variant: dict[str, Any]) -> Path | None:
    direct = _demo_video_seed_path_from_uri(variant.get("mp4_storage_uri") or variant.get("storage_uri"))
    if direct is not None:
        return direct

    source_ids = {
        _as_text(variant.get("video_source_asset_id")),
        _as_text(variant.get("reference_asset_id")),
        _as_text(variant.get("source_asset_id")),
        _as_text(variant.get("parent_creative_asset_id")),
    }
    source_ids = {item for item in source_ids if item}
    placement = _as_text(variant.get("placement"))
    category_slug = _normal_slug(variant.get("reference_demo_category") or variant.get("target_segment") or variant.get("asset_name"))
    candidates = []
    for asset in _approved_video_base_assets():
        asset_path = _demo_video_seed_path_from_uri(asset.get("storage_uri"))
        if asset_path is None:
            continue
        asset_ids = {_as_text(asset.get("asset_id")), *_asset_related_ids(asset)}
        id_match = bool(source_ids.intersection(asset_ids))
        placement_match = not placement or _as_text(asset.get("placement")) == placement
        category_match = category_slug and (
            category_slug in _normal_slug(asset.get("demo_category"))
            or category_slug in _normal_slug(asset.get("category_slug"))
            or _normal_slug(asset.get("category_slug")) in category_slug
        )
        if id_match and placement_match:
            return asset_path
        if placement_match and category_match:
            candidates.append(asset_path)
        elif id_match:
            candidates.append(asset_path)
    if candidates:
        return candidates[0]
    seed_files = sorted(DEMO_VIDEO_SEED_DIR.glob("*.mp4"))
    if not seed_files:
        return None
    index = int(_stable_fraction(variant.get("creative_asset_id"), placement, category_slug) * len(seed_files))
    return seed_files[min(index, len(seed_files) - 1)]


def _video_seed_filename_for_variant(variant: dict[str, Any]) -> str | None:
    uri = variant.get("mp4_storage_uri") or variant.get("storage_uri")
    direct_filename = _video_seed_filename_from_uri(uri)
    if direct_filename:
        return direct_filename
    source_ids = {
        _as_text(variant.get("video_source_asset_id")),
        _as_text(variant.get("reference_asset_id")),
        _as_text(variant.get("source_asset_id")),
        _as_text(variant.get("parent_creative_asset_id")),
    }
    source_ids = {item for item in source_ids if item}
    placement = _as_text(variant.get("placement"))
    category_slug = _normal_slug(variant.get("reference_demo_category") or variant.get("target_segment") or variant.get("asset_name"))
    candidates = []
    for asset in _approved_video_base_assets():
        filename = _video_seed_filename_from_uri(asset.get("storage_uri"))
        if filename is None:
            continue
        asset_ids = {_as_text(asset.get("asset_id")), *_asset_related_ids(asset)}
        id_match = bool(source_ids.intersection(asset_ids))
        placement_match = not placement or _as_text(asset.get("placement")) == placement
        category_match = category_slug and (
            category_slug in _normal_slug(asset.get("demo_category"))
            or category_slug in _normal_slug(asset.get("category_slug"))
            or _normal_slug(asset.get("category_slug")) in category_slug
        )
        if id_match and placement_match:
            return filename
        if placement_match and category_match:
            candidates.append(filename)
        elif id_match:
            candidates.append(filename)
    if candidates:
        return candidates[0]
    return None


def _video_media_content_for_variant(variant: dict[str, Any]) -> tuple[bytes, str, str, str]:
    uri = _as_text(variant.get("mp4_storage_uri") or variant.get("storage_uri"))
    filename = _video_seed_filename_for_variant(variant)
    if filename:
        content = _load_video_seed_content(filename)
        if content is not None:
            return content, "video/mp4", ".mp4", filename
    seed_path = _demo_video_seed_path_for_variant(variant)
    if seed_path is not None:
        if _is_uc_volume_path(seed_path):
            volume_content = _download_volume_file(seed_path)
            if volume_content is not None:
                return volume_content, "video/mp4", ".mp4", str(seed_path)
        elif seed_path.exists():
            return seed_path.read_bytes(), "video/mp4", ".mp4", str(seed_path)
    if uri:
        path = Path(uri)
        if path.exists():
            return path.read_bytes(), "video/mp4", ".mp4", uri
        volume_content = _download_volume_file(path)
        if volume_content is not None:
            return volume_content, "video/mp4", ".mp4", uri
    if DEMO_VIDEO_ASSET.exists():
        return DEMO_VIDEO_ASSET.read_bytes(), "video/mp4", ".mp4", str(DEMO_VIDEO_ASSET)
    return _demo_mp4_bytes(), "video/mp4", ".mp4", "embedded_demo_mp4"


def _image_media_content_for_variant(variant: dict[str, Any]) -> tuple[bytes, str, str, str]:
    if variant.get("creative_asset_id"):
        svg = _polished_variant_svg(variant).encode("utf-8")
        return svg, "image/svg+xml", ".svg", "generated_svg_composition"

    reference_asset_id = _as_text(
        variant.get("reference_asset_id")
        or variant.get("source_asset_id")
        or variant.get("parent_creative_asset_id")
    )
    if reference_asset_id:
        reference_image = _asset_image_content(reference_asset_id)
        if reference_image is not None:
            content, media_type = reference_image
            return content, media_type, _media_extension(media_type, ".png"), reference_asset_id

    for uri_key in ("thumbnail_uri", "storage_uri", "reference_thumbnail_uri"):
        uri = _as_text(variant.get(uri_key))
        image = _read_image_content(uri)
        if image is not None:
            content, media_type = image
            return content, media_type, _media_extension(media_type, ".png"), uri

    svg = _polished_variant_svg(variant).encode("utf-8")
    return svg, "image/svg+xml", ".svg", "generated_svg_fallback"


def _approved_asset_volume_path(variant: dict[str, Any], media_type: str, extension: str) -> Path:
    creative_id = _safe_volume_filename(variant.get("creative_asset_id"), f"asset-{int(time.time())}")
    asset_kind = "videos" if media_type.startswith("video/") else "images"
    return Path(_creative_volume_uri(CREATIVE_APPROVED_ASSET_PREFIX, asset_kind, f"{creative_id}{extension}"))


def _materialize_approved_variant_asset(variant: dict[str, Any], materialized_ts: str) -> tuple[dict[str, Any], dict[str, Any]]:
    is_video = _is_video_content(_as_text(variant.get("content_type"))) or _as_text(variant.get("format")).upper() == "MP4"
    content, media_type, extension, source_uri = (
        _video_media_content_for_variant(variant) if is_video else _image_media_content_for_variant(variant)
    )
    target_path = _approved_asset_volume_path(variant, media_type, extension)
    uploaded, error = _upload_volume_file(target_path, content)
    info = {
        "status": "volume_uploaded" if uploaded else "volume_upload_failed",
        "target_uri": str(target_path),
        "source_uri": source_uri,
        "media_type": media_type,
        "bytes": len(content),
        "error": error,
    }
    params = _loads_json(variant.get("generation_params_json"), {})
    params = params if isinstance(params, dict) else {}
    params.update(
        {
            "approved_asset_uri": str(target_path) if uploaded else "",
            "approved_asset_media_type": media_type,
            "approved_asset_source_uri": source_uri,
            "approved_asset_materialized_ts": materialized_ts,
            "asset_materialization_status": info["status"],
            "asset_materialization_error": error,
        }
    )
    updates = {
        "asset_materialization_status": info["status"],
        "asset_materialization_error": error,
        "approved_asset_uri": str(target_path) if uploaded else "",
        "approved_asset_media_type": media_type,
        "approved_asset_bytes": len(content),
        "generation_params_json": json.dumps(params),
    }
    if not uploaded:
        return updates, info

    updates.update(
        {
            "storage_uri": str(target_path),
            "approved_asset_materialized_ts": materialized_ts,
        }
    )
    if is_video:
        updates.update(
            {
                "mp4_storage_uri": str(target_path),
                "video_preview_uri": f"/api/creative-variants/{variant.get('creative_asset_id')}/video-preview",
                "format": "MP4",
            }
        )
    else:
        updates.update(
            {
                "thumbnail_uri": str(target_path),
                "format": extension.lstrip(".").upper(),
            }
        )
    return updates, info


def _uc_lineage_string_properties(properties: dict[str, Any]) -> dict[str, str]:
    clean: dict[str, str] = {}
    for key, value in properties.items():
        if value is None or value == "":
            continue
        if isinstance(value, (dict, list)):
            clean[key] = json.dumps(value, default=str, sort_keys=True)
        else:
            clean[key] = str(value)
    return clean


def _uc_external_metadata_name(variant: dict[str, Any]) -> str:
    token = _as_text(variant.get("creative_asset_id") or variant.get("request_id"), f"asset_{int(time.time())}")
    clean = "".join(char if char.isalnum() else "_" for char in token).strip("_")
    return f"creative_generation_job_{clean or uuid.uuid4().hex[:12]}"


def _uc_lineage_table_name() -> str:
    target = UC_EXTERNAL_LINEAGE_TARGET_TABLE.strip()
    if target.count(".") == 2:
        return target.replace("`", "")
    return _pipeline_table(target or "gold_buyside_creative_variant").replace("`", "")


def _uc_lineage_error_text(error: Exception) -> str:
    message = str(error)
    return " ".join(message.split())[:1000]


def _is_databricks_not_found(error: Exception) -> bool:
    message = _uc_lineage_error_text(error).lower()
    return "not_found" in message or "resource_does_not_exist" in message or "404" in message


def _is_databricks_already_exists(error: Exception) -> bool:
    message = _uc_lineage_error_text(error).lower()
    return "already_exists" in message or "already exists" in message or "409" in message


def _get_uc_external_metadata(name: str) -> dict[str, Any] | None:
    try:
        return _workspace_client().api_client.do(
            "GET",
            f"/api/2.0/lineage-tracking/external-metadata/{quote(name, safe='')}",
        )
    except Exception as exc:
        if _is_databricks_not_found(exc):
            return None
        raise


def _ensure_uc_external_metadata(name: str, variant: dict[str, Any], base_path: str, final_path: str) -> dict[str, Any]:
    existing = _get_uc_external_metadata(name)
    if existing:
        return {"status": "already_exists", "name": name, "metadata": existing}

    properties = _uc_lineage_string_properties(
        {
            "creative_asset_id": variant.get("creative_asset_id"),
            "request_id": variant.get("request_id"),
            "brief_id": variant.get("brief_id"),
            "cohort_id": variant.get("cohort_id"),
            "placement": variant.get("placement"),
            "source_asset_id": variant.get("source_asset_id") or variant.get("reference_asset_id"),
            "base_image_path": base_path,
            "final_image_path": final_path,
            "generation_model": variant.get("generation_model"),
            "generation_model_id": variant.get("generation_model_id"),
            "brand_guideline_id": variant.get("brand_guideline_id"),
            "target_table": _uc_lineage_table_name(),
        }
    )
    body = {
        "name": name,
        "system_type": UC_EXTERNAL_LINEAGE_SYSTEM_TYPE,
        "entity_type": UC_EXTERNAL_LINEAGE_ENTITY_TYPE,
        "description": "Creative generation workflow node connecting governed base media, generated final asset, and Delta metadata.",
        "columns": [
            "creative_asset_id",
            "request_id",
            "source_asset_id",
            "storage_uri",
            "generation_model",
            "approval_status",
        ],
        "properties": properties,
    }
    try:
        created = _workspace_client().api_client.do(
            "POST",
            "/api/2.0/lineage-tracking/external-metadata",
            body=body,
        )
        return {"status": "created", "name": name, "metadata": created}
    except Exception as exc:
        if _is_databricks_already_exists(exc):
            existing_after_race = _get_uc_external_metadata(name) or {"name": name}
            return {"status": "already_exists", "name": name, "metadata": existing_after_race}
        raise


def _create_uc_external_lineage_relationship(
    source: dict[str, Any],
    target: dict[str, Any],
    relationship_type: str,
    variant: dict[str, Any],
    extra_properties: dict[str, Any] | None = None,
) -> dict[str, Any]:
    properties = _uc_lineage_string_properties(
        {
            "relationship_type": relationship_type,
            "creative_asset_id": variant.get("creative_asset_id"),
            "request_id": variant.get("request_id"),
            "source_asset_id": variant.get("source_asset_id") or variant.get("reference_asset_id"),
            "placement": variant.get("placement"),
            "generation_model": variant.get("generation_model"),
            **(extra_properties or {}),
        }
    )
    body = {
        "source": source,
        "target": target,
        "properties": properties,
        "columns": [],
    }
    try:
        relationship = _workspace_client().api_client.do(
            "POST",
            "/api/2.0/lineage-tracking/external-lineage",
            body=body,
        )
        return {
            "status": "created",
            "relationship_type": relationship_type,
            "relationship_id": relationship.get("id"),
            "source": source,
            "target": target,
        }
    except Exception as exc:
        if _is_databricks_already_exists(exc):
            return {
                "status": "already_exists",
                "relationship_type": relationship_type,
                "relationship_id": "",
                "source": source,
                "target": target,
            }
        return {
            "status": "error",
            "relationship_type": relationship_type,
            "relationship_id": "",
            "source": source,
            "target": target,
            "error": _uc_lineage_error_text(exc),
        }


def _variant_base_volume_path(variant: dict[str, Any]) -> tuple[str, dict[str, Any] | None]:
    workflow = _creative_workflow_data()
    reference_asset_id = _as_text(
        variant.get("reference_asset_id")
        or variant.get("source_asset_id")
        or variant.get("parent_creative_asset_id")
    )
    reference_asset = _find_asset_by_any_id(workflow["base_assets"], reference_asset_id)
    candidates = [
        variant.get("reference_thumbnail_uri"),
        (reference_asset or {}).get("thumbnail_uri"),
        (reference_asset or {}).get("storage_uri"),
    ]
    for candidate in candidates:
        value = _as_text(candidate)
        if value.startswith("/Volumes/"):
            return value, reference_asset
    return "", reference_asset


def _publish_uc_external_lineage_for_variant(
    variant: dict[str, Any],
    asset_materialization: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    if not UC_EXTERNAL_LINEAGE_ENABLED:
        info = {
            "enabled": False,
            "status": "skipped",
            "reason": "UC_EXTERNAL_LINEAGE_ENABLED is not true",
            "metadata_name": "",
            "relationships": [],
        }
        return {}, info

    final_path = _as_text(
        asset_materialization.get("target_uri")
        or variant.get("approved_asset_uri")
        or variant.get("storage_uri")
    )
    if not final_path.startswith("/Volumes/"):
        info = {
            "enabled": True,
            "status": "skipped",
            "reason": "final asset is not a UC Volume path",
            "metadata_name": "",
            "relationships": [],
            "final_path": final_path,
        }
        return {}, info

    base_path, reference_asset = _variant_base_volume_path(variant)
    metadata_name = _uc_external_metadata_name(variant)
    relationships: list[dict[str, Any]] = []
    warnings: list[str] = []
    try:
        metadata_result = _ensure_uc_external_metadata(metadata_name, variant, base_path, final_path)
    except Exception as exc:
        error = _uc_lineage_error_text(exc)
        DATA_BACKEND_ERRORS.append(f"uc_external_lineage_metadata: {metadata_name}: {error}")
        info = {
            "enabled": True,
            "status": "error",
            "reason": error,
            "metadata_name": metadata_name,
            "relationships": [],
            "base_path": base_path,
            "final_path": final_path,
        }
        return _uc_external_lineage_variant_updates(variant, info), info

    job_object = {"external_metadata": {"name": metadata_name}}
    final_path_object = {"path": {"url": final_path}}
    table_object = {"table": {"name": _uc_lineage_table_name()}}
    if base_path:
        relationships.append(
            _create_uc_external_lineage_relationship(
                {"path": {"url": base_path}},
                job_object,
                "base_image_path_to_generation_job",
                variant,
                {"base_asset_name": (reference_asset or {}).get("asset_name"), "base_path": base_path},
            )
        )
    else:
        warnings.append("base_path_missing")

    relationships.append(
        _create_uc_external_lineage_relationship(
            job_object,
            final_path_object,
            "generation_job_to_final_image_path",
            variant,
            {"final_path": final_path},
        )
    )
    relationships.append(
        _create_uc_external_lineage_relationship(
            final_path_object,
            table_object,
            "final_image_path_to_generated_creative_table",
            variant,
            {"target_table": _uc_lineage_table_name()},
        )
    )

    relationship_errors = [item for item in relationships if item.get("status") == "error"]
    if relationship_errors:
        status = "partial" if len(relationship_errors) < len(relationships) else "error"
        DATA_BACKEND_ERRORS.append(
            f"uc_external_lineage_relationships: {metadata_name}: "
            + "; ".join(_as_text(item.get("error")) for item in relationship_errors)
        )
    else:
        status = "published"

    info = {
        "enabled": True,
        "status": status,
        "metadata_name": metadata_name,
        "metadata_status": metadata_result.get("status"),
        "relationships": relationships,
        "relationship_ids": [item.get("relationship_id") for item in relationships if item.get("relationship_id")],
        "warnings": warnings,
        "base_path": base_path,
        "final_path": final_path,
        "target_table": _uc_lineage_table_name(),
    }
    return _uc_external_lineage_variant_updates(variant, info), info


def _uc_external_lineage_variant_updates(variant: dict[str, Any], info: dict[str, Any]) -> dict[str, Any]:
    params = _loads_json(variant.get("generation_params_json"), {})
    params = params if isinstance(params, dict) else {}
    params["uc_external_lineage"] = info
    return {
        "uc_external_lineage_status": info.get("status", ""),
        "uc_external_lineage_metadata_name": info.get("metadata_name", ""),
        "uc_external_lineage_error": info.get("reason", ""),
        "generation_params_json": json.dumps(params),
    }


def _read_image_content(uri: str) -> tuple[bytes, str] | None:
    if not uri:
        return None
    image_path = Path(uri)
    if image_path.exists():
        return image_path.read_bytes(), _media_type_for_path(image_path)
    volume_content = _download_volume_file(image_path)
    if volume_content is not None:
        return volume_content, _media_type_for_path(image_path)
    return None


def _read_volume_text(path: Path) -> str | None:
    if path.exists():
        return path.read_text(encoding="utf-8")
    content = _download_volume_file(path)
    if content is None:
        return None
    return content.decode("utf-8")


def _list_seed_image_paths(seed_dir: Path) -> list[Path]:
    if seed_dir.exists():
        return sorted(path for path in seed_dir.iterdir() if path.suffix.lower() in IMAGE_FILE_EXTENSIONS)
    if not _is_uc_volume_path(seed_dir):
        return []
    if not _has_direct_databricks_auth() and not Path("/databricks").exists():
        DATA_LOAD_SOURCES["creative_seed_images"] = {
            "source": "embedded_fallback",
            "path": str(seed_dir),
            "rows": 0,
            "loaded": False,
        }
        return []
    try:
        entries = _workspace_client().files.list_directory_contents(str(seed_dir))
        image_paths = []
        for entry in entries:
            if getattr(entry, "is_directory", False):
                continue
            name = _as_text(getattr(entry, "name", ""))
            path = Path(_as_text(getattr(entry, "path", "")) or str(seed_dir / name))
            if path.suffix.lower() in IMAGE_FILE_EXTENSIONS:
                image_paths.append(path)
        return sorted(image_paths)
    except Exception as exc:
        DATA_BACKEND_ERRORS.append(f"seed_image_directory: {seed_dir}: {exc}")
        return []


def _titleize_token(value: Any) -> str:
    token = _as_text(value).strip().replace("-", "_")
    words = [part for part in token.split("_") if part and not part.isdigit()]
    return " ".join(word.capitalize() for word in words)


def _infer_seed_placement(filename: str) -> str:
    normalized = filename.lower()
    return next((placement for placement in PLACEMENT_SPECS if placement in normalized), "homepage_hero")


def _seed_asset_from_manifest_entry(entry: dict[str, Any], index: int, seed_dir: Path) -> dict[str, Any]:
    placement = _as_text(entry.get("placement"), _infer_seed_placement(_as_text(entry.get("volume_png_uri"))))
    spec = _placement_spec(placement)
    source_uri = _as_text(entry.get("volume_png_uri"))
    if not source_uri:
        filename = Path(_as_text(entry.get("local_png"))).name or f"seed-image-{index + 1:02d}.png"
        source_uri = str(seed_dir / filename)
    filename = Path(source_uri).name
    base_asset_ids = _loads_json(entry.get("app_base_asset_ids"), [])
    related_asset_ids = [str(item).strip() for item in base_asset_ids if str(item).strip()]
    asset_id = _as_text(base_asset_ids[0]) if base_asset_ids else f"SEED-{index + 1:04d}"
    demo_category = _as_text(entry.get("demo_category")) or _titleize_token(entry.get("slug") or Path(filename).stem)
    category_slug = _as_text(entry.get("slug")) or Path(filename).stem
    width = _as_int_value(entry.get("width"), spec["width_px"])
    height = _as_int_value(entry.get("height"), spec["height_px"])
    description = _as_text(
        entry.get("recommended_usage"),
        f"Governed seed image for {demo_category} {spec['label']} creative generation.",
    )
    tags = ["seed_image", "governed", "brand_safe", placement, category_slug, demo_category]
    return {
        "asset_id": asset_id,
        "asset_name": f"{demo_category} {spec['label']}",
        "asset_type": "image",
        "storage_uri": source_uri,
        "thumbnail_uri": source_uri,
        "format": Path(filename).suffix.lstrip(".").lower() or "png",
        "width_px": width,
        "height_px": height,
        "duration_sec": 0,
        "aspect_ratio": _as_text(entry.get("aspect_ratio"), spec["aspect_ratio"]),
        "placement": placement,
        "demo_category": demo_category,
        "category_slug": category_slug,
        "related_asset_ids": related_asset_ids or [asset_id],
        "content_tags": ",".join(tags),
        "description": description,
        "recommended_usage": description,
        "source_system": "uc_volume_seed_images",
        "source_asset_external_id": filename,
        "rights_profile_id": "RIGHTS-001",
        "approved_usage_contexts_json": json.dumps(spec["channels"]),
        "historical_performance_json": json.dumps(
            {
                "ctr": round(0.82 + _stable_fraction(asset_id, category_slug, "ctr") * 0.45, 2),
                "conversion_rate": round(0.035 + _stable_fraction(asset_id, category_slug, "conversion") * 0.025, 3),
            }
        ),
        "brand_safety_score": 93 + int(_stable_fraction(asset_id, category_slug, "safety") * 5),
        "status": "active",
        "created_ts": "2026-05-31",
        "updated_ts": "2026-05-31",
    }


def _seed_asset_from_image_file(path: Path, index: int) -> dict[str, Any]:
    placement = _infer_seed_placement(path.name)
    spec = _placement_spec(placement)
    stem = path.stem
    category_token = stem
    for placement_key in PLACEMENT_SPECS:
        category_token = category_token.replace(placement_key, "")
    category_token = category_token.strip("_-")
    demo_category = _titleize_token(category_token)
    entry = {
        "slug": stem,
        "demo_category": demo_category or f"Seed Image {index + 1}",
        "placement": placement,
        "aspect_ratio": spec["aspect_ratio"],
        "width": spec["width_px"],
        "height": spec["height_px"],
        "volume_png_uri": str(path),
        "app_base_asset_ids": [f"SEED-{index + 1:04d}"],
        "recommended_usage": f"Governed seed image for {spec['label']} creative generation.",
    }
    return _seed_asset_from_manifest_entry(entry, index, path.parent)


@lru_cache(maxsize=1)
def _seed_image_assets() -> list[dict[str, Any]]:
    seed_dir = _creative_seed_image_dir()
    manifest_path = seed_dir / "manifest.json"
    try:
        manifest_text = _read_volume_text(manifest_path)
        if manifest_text:
            manifest = json.loads(manifest_text)
            categories = manifest.get("categories", []) if isinstance(manifest, dict) else []
            assets = [
                _seed_asset_from_manifest_entry(entry, index, seed_dir)
                for index, entry in enumerate(categories)
                if isinstance(entry, dict)
            ]
            DATA_LOAD_SOURCES["seed_image_assets"] = {
                "source": "uc_volume_manifest",
                "path": str(manifest_path),
                "rows": len(assets),
                "loaded": True,
            }
            return assets

        image_paths = _list_seed_image_paths(seed_dir)
        if image_paths:
            assets = [_seed_asset_from_image_file(path, index) for index, path in enumerate(image_paths)]
            DATA_LOAD_SOURCES["seed_image_assets"] = {
                "source": "uc_volume_directory",
                "path": str(seed_dir),
                "rows": len(assets),
                "loaded": True,
            }
            return assets
    except Exception as exc:
        DATA_BACKEND_ERRORS.append(f"seed_image_assets: {exc}")
        DATA_LOAD_SOURCES["seed_image_assets"] = {
            "source": "uc_volume_fallback",
            "path": str(seed_dir),
            "rows": 0,
            "loaded": False,
            "error": str(exc),
        }
    return []


VIDEO_BASE_ASSET_CATEGORIES = [
    {
        "slug": "live_sports",
        "demo_category": "Live Sports",
        "description": "Approved live sports MP4 preview seed for end-card generation.",
        "tags": ["sports", "live_events", "appointment_viewing"],
    },
    {
        "slug": "family_movie_night",
        "demo_category": "Family Movie Night",
        "description": "Approved family co-viewing MP4 preview seed for weekend streaming campaigns.",
        "tags": ["family", "movies", "weekend"],
    },
    {
        "slug": "premium_originals",
        "demo_category": "Premium Originals",
        "description": "Approved premium originals MP4 preview seed for series discovery and upgrade messaging.",
        "tags": ["premium", "originals", "series"],
    },
    {
        "slug": "annual_upgrade",
        "demo_category": "Annual Upgrade",
        "description": "Approved subscription upgrade MP4 preview seed for annual-plan conversion.",
        "tags": ["upgrade", "annual_plan", "value"],
    },
    {
        "slug": "winback_live_events",
        "demo_category": "Winback Live Events",
        "description": "Approved winback MP4 preview seed for lapsed subscribers and tentpole live events.",
        "tags": ["winback", "live_events", "reactivation"],
    },
]
VIDEO_SEED_SAMPLE_DURATION_SECONDS = 6


def _approved_video_base_assets() -> list[dict[str, Any]]:
    video_placements = ["ctv_15s", "youtube_15s", "social_video_15s"]
    rows = []
    for category_index, category in enumerate(VIDEO_BASE_ASSET_CATEGORIES):
        for placement in video_placements:
            spec = _placement_spec(placement)
            asset_id = f"VID-BASE-{len(rows) + 1:04d}"
            filename = f"{category['slug']}_{placement}.mp4"
            poster_name = f"{category['slug']}_{placement}_poster.svg"
            treatment = _video_treatment_for(category["demo_category"], placement, category_index + 1)
            tags = [
                "video_seed",
                "approved",
                "governed",
                "brand_safe",
                placement,
                category["slug"],
                *category["tags"],
            ]
            rows.append(
                {
                    "asset_id": asset_id,
                    "asset_name": f"{category['demo_category']} {spec['label']} Video Seed",
                    "asset_type": "video",
                    "storage_uri": f"demo-video-seed://{filename}",
                    "thumbnail_uri": _creative_volume_uri("video_seed_posters", poster_name),
                    "video_preview_uri": f"/api/creative-assets/{asset_id}/video-preview",
                    "video_treatment_json": json.dumps(treatment),
                    "format": "mp4",
                    "width_px": spec["width_px"],
                    "height_px": spec["height_px"],
                    "duration_sec": VIDEO_SEED_SAMPLE_DURATION_SECONDS,
                    "aspect_ratio": spec["aspect_ratio"],
                    "placement": placement,
                    "demo_category": category["demo_category"],
                    "category_slug": category["slug"],
                    "related_asset_ids": [asset_id],
                    "content_tags": ",".join(tags),
                    "description": category["description"],
                    "recommended_usage": f"Use as a governed video seed for {category['demo_category']} {spec['label']} variants.",
                    "source_system": "approved_demo_video_seed_library",
                    "source_asset_external_id": filename,
                    "rights_profile_id": "RIGHTS-VIDEO-001",
                    "approved_usage_contexts_json": json.dumps(spec["channels"]),
                    "historical_performance_json": json.dumps(
                        {
                            "video_completion_rate": round(0.61 + category_index * 0.025 + _stable_fraction(asset_id, "vcr") * 0.08, 3),
                            "ctr": round(0.84 + _stable_fraction(asset_id, "ctr") * 0.36, 2),
                        }
                    ),
                    "brand_safety_score": 92 + int(_stable_fraction(asset_id, "safety") * 5),
                    "status": "active",
                    "created_ts": "2026-06-03",
                    "updated_ts": "2026-06-03",
                }
            )
    return rows


def _governed_retrieval_assets() -> list[dict[str, Any]]:
    seed_assets = _seed_image_assets()
    video_assets = _approved_video_base_assets()
    if seed_assets:
        return _dedupe_assets([*seed_assets, *video_assets])
    return _dedupe_assets([*_creative_workflow_data()["base_assets"], *video_assets])


def _asset_related_ids(asset: dict[str, Any]) -> set[str]:
    related = _loads_json(asset.get("related_asset_ids"), [])
    if not isinstance(related, list):
        related = []
    ids = {_as_text(asset.get("asset_id"))}
    ids.update(_as_text(item) for item in related)
    return {item for item in ids if item}


def _seed_asset_by_any_id() -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    seed_assets = _seed_image_assets()
    for asset in [*seed_assets, *_approved_video_base_assets()]:
        for asset_id in _asset_related_ids(asset):
            lookup[asset_id] = asset
    if seed_assets:
        by_placement: dict[str, list[dict[str, Any]]] = {}
        for asset in seed_assets:
            by_placement.setdefault(_normalized_token(asset.get("placement")), []).append(asset)
        for base_asset in _creative_workflow_data()["base_assets"]:
            asset_id = _as_text(base_asset.get("asset_id"))
            if not asset_id or asset_id in lookup:
                continue
            placement = _normalized_token(base_asset.get("placement"))
            if not placement:
                tags = _normalized_token(base_asset.get("content_tags"))
                placement = next((key for key in PLACEMENT_SPECS if key in tags), "")
            matches = by_placement.get(placement, [])
            if matches:
                offset = max(0, _as_int_value(asset_id.replace("BASE-", ""), 1) - 1)
                lookup[asset_id] = matches[offset % len(matches)]
    return lookup


def _asset_image_record(asset_id: str) -> dict[str, Any] | None:
    resolved_asset_id = _as_text(asset_id)
    if not resolved_asset_id:
        return None

    record = _seed_asset_by_any_id().get(resolved_asset_id)
    if record is not None:
        return record

    record = next(
        (
            asset
            for asset in _governed_retrieval_assets()
            if resolved_asset_id in _asset_related_ids(asset)
        ),
        None,
    )
    if record is not None:
        return record

    return next(
        (
            asset
            for asset in _creative_workflow_data()["base_assets"]
            if resolved_asset_id in _asset_related_ids(asset)
        ),
        None,
    )


def _asset_image_content(asset_id: str) -> tuple[bytes, str] | None:
    record = _asset_image_record(asset_id)
    if record is None:
        return None
    return _read_image_content(_as_text(record.get("thumbnail_uri") or record.get("storage_uri")))


@lru_cache(maxsize=128)
def _asset_image_data_uri(asset_id: str) -> str:
    image = _asset_image_content(asset_id)
    if image is None:
        return ""
    content, media_type = image
    return f"data:{media_type};base64,{base64.b64encode(content).decode('ascii')}"


def _normalized_token(value: Any) -> str:
    return _as_text(value).strip().lower().replace("-", "_").replace(" ", "_")


def _asset_matches_generation_context(asset: dict[str, Any], placement: str, category: str = "") -> bool:
    placement_token = _normalized_token(placement)
    category_token = _normalized_token(category)
    asset_placement = _normalized_token(asset.get("placement"))
    if placement_token and asset_placement and asset_placement != placement_token:
        return False
    if category_token and category_token != "all":
        text = _normalized_token(
            " ".join(
                [
                    _as_text(asset.get("asset_name")),
                    _as_text(asset.get("demo_category")),
                    _as_text(asset.get("category_slug")),
                    _as_text(asset.get("content_tags")),
                    _as_text(asset.get("description")),
                ]
            )
        )
        if category_token not in text:
            return False
    return True


def _vector_search_rows(response: Any) -> list[dict[str, Any]]:
    payload = response.as_dict() if hasattr(response, "as_dict") else response
    columns = [column.get("name", "") for column in payload.get("manifest", {}).get("columns", [])]
    rows = payload.get("result", {}).get("data_array", [])
    return [dict(zip(columns, row)) for row in rows]


def _dedupe_assets(assets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for asset in assets:
        key = _as_text(asset.get("asset_id"))
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(asset)
    return unique


def _fallback_reference_assets(
    placement: str,
    category: str,
    selected_asset_ids: list[str],
    limit: int,
    content_type: str = "image",
) -> list[dict[str, Any]]:
    assets = _governed_retrieval_assets()
    preferred_asset_type = "video" if _is_video_content(content_type) else "image"
    preferred_assets = [
        asset for asset in assets if _as_text(asset.get("asset_type")).lower() == preferred_asset_type
    ] or assets
    lookup = _seed_asset_by_any_id()
    selected = [lookup[asset_id] for asset_id in selected_asset_ids if asset_id in lookup]
    contextual_selected = [
        asset for asset in selected if _asset_matches_generation_context(asset, placement, category)
    ]
    category_matches = [
        asset for asset in preferred_assets if _asset_matches_generation_context(asset, placement, category)
    ]
    placement_matches = [
        asset for asset in preferred_assets if _asset_matches_generation_context(asset, placement)
    ]
    category_token = _normalized_token(category)
    if category_token and category_token != "all" and (contextual_selected or category_matches):
        return _dedupe_assets(contextual_selected + category_matches)[:limit]
    if placement_matches:
        return _dedupe_assets(selected + placement_matches)[:limit]
    return _dedupe_assets(selected + preferred_assets)[:limit]


def _retrieve_generation_reference_assets(
    payload: "CreativeGenerationRequestIn",
    cohort_name: str,
    limit: int = 4,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    category = payload.category.strip()
    is_video = _is_video_content(payload.content_type)
    query = " ".join(
        item
        for item in [
            category,
            payload.placement.replace("_", " "),
            cohort_name,
            payload.retrieval_query,
            payload.user_instructions,
            "governed video seed reference creative asset" if is_video else "governed seed image reference creative asset",
        ]
        if item
    )
    retrieval: dict[str, Any] = {
        "source": "seed_image_fallback",
        "query": query,
        "index": CREATIVE_VECTOR_SEARCH_INDEX,
        "endpoint": CREATIVE_VECTOR_SEARCH_ENDPOINT,
        "rows": [],
        "error": "",
    }
    candidates: list[dict[str, Any]] = []
    lookup = _seed_asset_by_any_id()

    if CREATIVE_VECTOR_SEARCH_INDEX and (_has_direct_databricks_auth() or Path("/databricks").exists()):
        try:
            response = _workspace_client().vector_search_indexes.query_index(
                index_name=CREATIVE_VECTOR_SEARCH_INDEX,
                columns=[
                    "asset_id",
                    "asset_name",
                    "description",
                    "content_tags",
                    "placement_contexts",
                    "storage_uri",
                    "thumbnail_uri",
                ],
                query_text=query,
                query_type="HYBRID",
                num_results=max(limit * 3, 8),
            )
            rows = _vector_search_rows(response)
            retrieval["source"] = "databricks_vector_search"
            retrieval["rows"] = rows[:8]
            for row in rows:
                vector_asset_id = _as_text(row.get("asset_id"))
                asset = lookup.get(vector_asset_id)
                asset_type_matches = bool(asset) and (
                    not is_video or _as_text(asset.get("asset_type")).lower() == "video"
                )
                if asset and asset_type_matches and _asset_matches_generation_context(asset, payload.placement, category):
                    candidates.append(
                        {
                            **asset,
                            "vector_asset_id": vector_asset_id,
                            "vector_score": row.get("score"),
                            "vector_search_text": row.get("description") or row.get("content_tags") or "",
                        }
                    )
        except Exception as exc:
            retrieval["error"] = str(exc)
            DATA_BACKEND_ERRORS.append(f"creative_vector_search: {exc}")
    elif CREATIVE_VECTOR_SEARCH_INDEX:
        retrieval["error"] = "Databricks auth environment is not present; using governed fallback seed assets."

    fallback = _fallback_reference_assets(payload.placement, category, payload.selected_base_asset_ids, limit, payload.content_type)
    reference_assets = _dedupe_assets(candidates + fallback)[:limit]
    return reference_assets, retrieval


def _reference_variant_svg(record: dict[str, Any]) -> str:
    ratio = _as_text(record.get("aspect_ratio"), "16:9")
    width, height = {
        "1:1": (1080, 1080),
        "9:16": (1080, 1920),
        "6:1": (1200, 200),
        "4:5": (1080, 1350),
    }.get(ratio, (1280, 720))
    variant_number = _as_int_value(record.get("variant_number"), 1)
    source_id = _as_text(record.get("reference_asset_id") or record.get("source_asset_id"), "BASE-0001")
    reference_name = escape(_as_text(record.get("reference_asset_name"), "Seed image reference")[:72])
    visual = _creative_visual_treatment_from_record(record)
    accent = _as_text(visual.get("accent"), ["#0f9f95", "#256b8f", "#c7793a", "#5b65d8", "#1f9d72"][variant_number % 5])
    secondary = _as_text(visual.get("secondary"), "#13212d")
    treatment_id = _as_text(visual.get("treatment_id"))
    layout = _as_text(visual.get("layout"), "left-stack")
    badge = escape(_as_text(visual.get("badge"), f"V{variant_number}")[:18])
    element_primary = escape(_as_text(visual.get("element_primary"), "generated overlay")[:44])
    element_secondary = escape(_as_text(visual.get("element_secondary"), "audience cue")[:44])
    title_lines = _svg_text_lines(visual.get("headline") or record.get("asset_name"), 34 if width >= height else 22, 2)
    subtitle_lines = _svg_text_lines(visual.get("audience_signal") or record.get("target_segment"), 42 if width >= height else 28, 2)
    objective_lines = _svg_text_lines(visual.get("brief_signal") or record.get("generation_prompt"), 48 if width >= height else 30, 2)
    image_href = _asset_image_data_uri(source_id)
    if image_href:
        image_markup = f'  <image href="{escape(image_href, quote=True)}" x="0" y="0" width="{width}" height="{height}" preserveAspectRatio="xMidYMid slice"/>'
    else:
        image_markup = f'  <rect width="{width}" height="{height}" fill="#d7dde1"/>'
    margin_x = int(width * 0.065)
    margin_y = int(height * 0.075)
    card_width = int(width * (0.54 if width >= height else 0.78))
    card_height = int(height * (0.42 if width >= height else 0.34))
    if layout in {"right-offer", "split-countdown"} and width >= height:
        card_x = width - margin_x - card_width
    elif layout == "center-lockup":
        card_x = int((width - card_width) / 2)
    else:
        card_x = margin_x
    card_y = int(height * (0.46 if layout == "bottom-rail" else 0.13))
    text_x = card_x + int(width * 0.028)
    text_y = card_y + int(height * 0.095)
    headline_size = max(26, int(width * (0.035 if width >= height else 0.052)))
    body_size = max(15, int(width * (0.014 if width >= height else 0.025)))
    small_size = max(12, int(width * (0.011 if width >= height else 0.020)))

    def text_lines_markup(lines: list[str], x: int, y: int, size: int, color: str, weight: int = 800, gap: float = 1.18) -> str:
        return "\n".join(
            f'  <text x="{x}" y="{int(y + index * size * gap)}" fill="{color}" font-family="Inter, Arial, sans-serif" font-size="{size}" font-weight="{weight}">{escape(line)}</text>'
            for index, line in enumerate(lines)
            if line
        )

    if treatment_id == "watchlist-rail":
        visual_elements = f"""
  <g opacity="0.96">
    <rect x="{int(width * 0.10)}" y="{int(height * 0.70)}" width="{int(width * 0.22)}" height="{int(height * 0.18)}" rx="18" fill="#ffffff" opacity="0.88"/>
    <rect x="{int(width * 0.35)}" y="{int(height * 0.66)}" width="{int(width * 0.22)}" height="{int(height * 0.22)}" rx="18" fill="{accent}" opacity="0.92"/>
    <rect x="{int(width * 0.60)}" y="{int(height * 0.70)}" width="{int(width * 0.22)}" height="{int(height * 0.18)}" rx="18" fill="#ffffff" opacity="0.88"/>
    <text x="{int(width * 0.13)}" y="{int(height * 0.80)}" fill="{secondary}" font-family="Inter, Arial, sans-serif" font-size="{small_size}" font-weight="800">PROFILE 1</text>
    <text x="{int(width * 0.39)}" y="{int(height * 0.79)}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="{small_size}" font-weight="800">WATCHLIST</text>
    <text x="{int(width * 0.63)}" y="{int(height * 0.80)}" fill="{secondary}" font-family="Inter, Arial, sans-serif" font-size="{small_size}" font-weight="800">PROFILE 2</text>
  </g>"""
    elif treatment_id == "premium-spotlight":
        visual_elements = f"""
  <g opacity="0.92">
    <ellipse cx="{int(width * 0.68)}" cy="{int(height * 0.50)}" rx="{int(width * 0.16)}" ry="{int(height * 0.27)}" fill="{accent}" opacity="0.24"/>
    <path d="M {int(width * 0.54)} {int(height * 0.08)} L {int(width * 0.82)} {int(height * 0.08)} L {int(width * 0.76)} {int(height * 0.88)} L {int(width * 0.46)} {int(height * 0.88)} Z" fill="#ffffff" opacity="0.16"/>
    <rect x="{int(width * 0.60)}" y="{int(height * 0.40)}" width="{int(width * 0.28)}" height="{int(height * 0.14)}" rx="18" fill="{secondary}" opacity="0.88"/>
    <text x="{int(width * 0.63)}" y="{int(height * 0.49)}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="{body_size}" font-weight="900">NEW ORIGINAL</text>
  </g>"""
    elif treatment_id == "value-badge":
        visual_elements = f"""
  <g opacity="0.96">
    <circle cx="{int(width * 0.78)}" cy="{int(height * 0.30)}" r="{int(min(width, height) * 0.15)}" fill="{accent}" opacity="0.92"/>
    <circle cx="{int(width * 0.78)}" cy="{int(height * 0.30)}" r="{int(min(width, height) * 0.11)}" fill="#ffffff" opacity="0.18"/>
    <text x="{int(width * 0.72)}" y="{int(height * 0.29)}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="{body_size}" font-weight="900">ANNUAL</text>
    <text x="{int(width * 0.72)}" y="{int(height * 0.35)}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="{small_size}" font-weight="800">VALUE</text>
    <rect x="{int(width * 0.66)}" y="{int(height * 0.52)}" width="{int(width * 0.25)}" height="{int(height * 0.18)}" rx="16" fill="#ffffff" opacity="0.86"/>
    <text x="{int(width * 0.69)}" y="{int(height * 0.60)}" fill="{secondary}" font-family="Inter, Arial, sans-serif" font-size="{small_size}" font-weight="800">+ Live sports</text>
    <text x="{int(width * 0.69)}" y="{int(height * 0.66)}" fill="{secondary}" font-family="Inter, Arial, sans-serif" font-size="{small_size}" font-weight="800">+ Premium originals</text>
  </g>"""
    elif treatment_id == "return-countdown":
        visual_elements = f"""
  <g opacity="0.96">
    <rect x="{int(width * 0.63)}" y="{int(height * 0.16)}" width="{int(width * 0.09)}" height="{int(height * 0.14)}" rx="12" fill="{secondary}" opacity="0.90"/>
    <rect x="{int(width * 0.74)}" y="{int(height * 0.16)}" width="{int(width * 0.09)}" height="{int(height * 0.14)}" rx="12" fill="{accent}" opacity="0.94"/>
    <rect x="{int(width * 0.85)}" y="{int(height * 0.16)}" width="{int(width * 0.09)}" height="{int(height * 0.14)}" rx="12" fill="{secondary}" opacity="0.90"/>
    <text x="{int(width * 0.655)}" y="{int(height * 0.25)}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="{body_size}" font-weight="900">03</text>
    <text x="{int(width * 0.765)}" y="{int(height * 0.25)}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="{body_size}" font-weight="900">12</text>
    <text x="{int(width * 0.875)}" y="{int(height * 0.25)}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="{body_size}" font-weight="900">45</text>
  </g>"""
    else:
        visual_elements = f"""
  <g opacity="0.96">
    <rect x="{int(width * 0.58)}" y="{int(height * 0.12)}" width="{int(width * 0.34)}" height="{int(height * 0.12)}" rx="14" fill="{secondary}" opacity="0.90"/>
    <rect x="{int(width * 0.58)}" y="{int(height * 0.24)}" width="{int(width * 0.34)}" height="{int(height * 0.055)}" fill="{accent}" opacity="0.94"/>
    <text x="{int(width * 0.61)}" y="{int(height * 0.20)}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="{body_size}" font-weight="900">LIVE  Q4  02:18</text>
    <text x="{int(width * 0.61)}" y="{int(height * 0.28)}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="{small_size}" font-weight="800">STREAMING NOW</text>
  </g>"""

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <defs>
    <linearGradient id="overlay" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#071523" stop-opacity="0.18"/>
      <stop offset="0.58" stop-color="#071523" stop-opacity="0.32"/>
      <stop offset="1" stop-color="{accent}" stop-opacity="0.62"/>
    </linearGradient>
    <pattern id="variantPattern" width="72" height="72" patternUnits="userSpaceOnUse">
      <path d="M 72 0 L 0 0 0 72" fill="none" stroke="{accent}" stroke-opacity="0.22" stroke-width="3"/>
      <circle cx="58" cy="16" r="4" fill="#ffffff" opacity="0.26"/>
    </pattern>
  </defs>
{image_markup}
  <rect width="{width}" height="{height}" fill="url(#overlay)"/>
  <rect width="{width}" height="{height}" fill="url(#variantPattern)" opacity="0.42"/>
{visual_elements}
  <rect x="{card_x}" y="{card_y}" width="{card_width}" height="{card_height}" rx="24" fill="#ffffff" opacity="0.92"/>
  <rect x="{card_x}" y="{card_y}" width="{max(8, int(width * 0.010))}" height="{card_height}" rx="8" fill="{accent}"/>
  <rect x="{text_x}" y="{int(card_y + height * 0.035)}" width="{int(width * 0.15)}" height="{max(30, int(height * 0.048))}" rx="12" fill="{secondary}" opacity="0.94"/>
  <text x="{int(text_x + width * 0.018)}" y="{int(card_y + height * 0.068)}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="{small_size}" font-weight="900">{badge} V{variant_number}</text>
{text_lines_markup(title_lines, text_x, text_y, headline_size, "#13212d", 900)}
{text_lines_markup(subtitle_lines, text_x, int(text_y + headline_size * 2.55), body_size, "#4d5560", 740)}
  <rect x="{text_x}" y="{int(card_y + card_height - height * 0.108)}" width="{int(card_width * 0.72)}" height="{max(40, int(height * 0.070))}" rx="14" fill="{accent}" opacity="0.12"/>
  <text x="{int(text_x + width * 0.016)}" y="{int(card_y + card_height - height * 0.063)}" fill="{secondary}" font-family="Inter, Arial, sans-serif" font-size="{small_size}" font-weight="850">{element_primary}</text>
  <text x="{int(text_x + width * 0.016)}" y="{int(card_y + card_height - height * 0.028)}" fill="#5f6470" font-family="Inter, Arial, sans-serif" font-size="{max(10, int(small_size * 0.82))}" font-weight="720">{element_secondary}</text>
  <rect x="{margin_x}" y="{int(height * 0.905)}" width="{int(width * 0.52)}" height="{max(34, int(height * 0.052))}" rx="12" fill="#071523" opacity="0.72"/>
  <text x="{int(margin_x + width * 0.018)}" y="{int(height * 0.938)}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="{small_size}" font-weight="760">Brief: {escape(objective_lines[0])}</text>
  <text x="{int(width * 0.70)}" y="{int(height * 0.938)}" fill="#ffffff" opacity="0.76" font-family="Inter, Arial, sans-serif" font-size="{max(10, int(small_size * 0.82))}" font-weight="720">Seed: {reference_name}</text>
</svg>"""


def _polished_variant_svg(record: dict[str, Any]) -> str:
    ratio = _as_text(record.get("aspect_ratio"), "16:9")
    width, height = {
        "1:1": (1080, 1080),
        "9:16": (1080, 1920),
        "6:1": (1200, 200),
        "4:5": (1080, 1350),
    }.get(ratio, (1280, 720))
    variant_number = _as_int_value(record.get("variant_number"), 1)
    source_id = _as_text(record.get("reference_asset_id") or record.get("source_asset_id"), "BASE-0001")
    visual = _creative_visual_treatment_from_record(record)
    accent = _as_text(visual.get("accent"), "#0f9f95")
    secondary = _as_text(visual.get("secondary"), "#13212d")
    layout = _as_text(visual.get("layout"), "left-panel")
    badge = escape(_as_text(visual.get("badge"), f"V{variant_number}")[:14])
    treatment_name = escape(_as_text(visual.get("name"), "Variant")[:26])
    cta_text = escape(_as_text(visual.get("cta_text"), "Watch now")[:18])
    headline_lines = _svg_text_lines(visual.get("headline") or record.get("asset_name"), 24 if width >= height else 17, 2)
    support_lines = _svg_text_lines(visual.get("supporting_copy") or visual.get("audience_name"), 38 if width >= height else 24, 1)
    brief_lines = _svg_text_lines(visual.get("brief_name") or record.get("generation_prompt"), 34 if width >= height else 22, 1)
    image_href = _asset_image_data_uri(source_id)
    if image_href:
        image_markup = f'  <image href="{escape(image_href, quote=True)}" x="0" y="0" width="{width}" height="{height}" preserveAspectRatio="xMidYMid slice"/>'
    else:
        image_markup = f'  <rect width="{width}" height="{height}" fill="#d7dde1"/>'

    is_banner = height <= 240
    is_portrait = height > width
    margin_x = int(width * (0.052 if not is_portrait else 0.070))
    margin_y = int(height * (0.080 if not is_banner else 0.120))
    panel_width = int(width * (0.43 if width >= height else 0.80))
    panel_height = int(height * (0.54 if width >= height else 0.34))
    if is_banner:
        panel_width = int(width * 0.46)
        panel_height = int(height * 0.74)
    if layout in {"right-panel", "right-offer", "split-countdown"} and not is_portrait:
        panel_x = width - margin_x - panel_width
    elif layout in {"center-panel", "center-lockup"} and not is_banner:
        panel_x = int((width - panel_width) / 2)
    else:
        panel_x = margin_x
    if layout in {"bottom-panel", "bottom-rail"} and not is_banner:
        panel_y = height - margin_y - panel_height
    elif layout in {"center-panel", "center-lockup"} and not is_banner:
        panel_y = int((height - panel_height) / 2)
    else:
        panel_y = margin_y

    panel_rx = max(18, int(min(width, height) * 0.030))
    inner_x = panel_x + int(panel_width * 0.080)
    headline_y = panel_y + int(panel_height * (0.38 if not is_banner else 0.48))
    headline_size = max(22, int(width * (0.037 if width >= height else 0.062)))
    body_size = max(14, int(width * (0.014 if width >= height else 0.026)))
    small_size = max(11, int(width * (0.010 if width >= height else 0.020)))
    if is_banner:
        headline_size = max(20, int(height * 0.180))
        body_size = max(12, int(height * 0.080))
        small_size = max(10, int(height * 0.062))
    cta_height = max(34, int(panel_height * 0.125))
    cta_width = max(118, int(panel_width * 0.34))
    cta_y = panel_y + panel_height - int(panel_height * 0.190)
    accent_x = width - margin_x - int(width * 0.19) if panel_x < width / 2 else margin_x
    accent_y = height - margin_y - int(height * 0.23)
    accent_w = int(width * (0.18 if width >= height else 0.34))
    accent_h = int(height * (0.18 if width >= height else 0.11))
    if is_banner:
        accent_w = int(width * 0.15)
        accent_h = int(height * 0.50)
        accent_y = int(height * 0.26)

    def text_lines_markup(lines: list[str], x: int, y: int, size: int, color: str, weight: int = 800, gap: float = 1.18) -> str:
        return "\n".join(
            f'  <text x="{x}" y="{int(y + index * size * gap)}" fill="{color}" font-family="Inter, Arial, sans-serif" font-size="{size}" font-weight="{weight}">{escape(line)}</text>'
            for index, line in enumerate(lines)
            if line
        )

    visual_mark = f"""
  <g opacity="0.90">
    <rect x="{accent_x}" y="{accent_y}" width="{accent_w}" height="{accent_h}" rx="{max(14, int(min(width, height) * 0.025))}" fill="{secondary}" opacity="0.66"/>
    <rect x="{int(accent_x + accent_w * 0.09)}" y="{int(accent_y + accent_h * 0.15)}" width="{int(accent_w * 0.82)}" height="{max(5, int(accent_h * 0.10))}" rx="5" fill="{accent}"/>
    <circle cx="{int(accent_x + accent_w * 0.22)}" cy="{int(accent_y + accent_h * 0.62)}" r="{max(5, int(min(accent_w, accent_h) * 0.12))}" fill="#ffffff" opacity="0.72"/>
    <circle cx="{int(accent_x + accent_w * 0.48)}" cy="{int(accent_y + accent_h * 0.62)}" r="{max(5, int(min(accent_w, accent_h) * 0.12))}" fill="#ffffff" opacity="0.40"/>
    <circle cx="{int(accent_x + accent_w * 0.74)}" cy="{int(accent_y + accent_h * 0.62)}" r="{max(5, int(min(accent_w, accent_h) * 0.12))}" fill="#ffffff" opacity="0.28"/>
  </g>"""

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#071523" stop-opacity="0.10"/>
      <stop offset="0.62" stop-color="#071523" stop-opacity="0.24"/>
      <stop offset="1" stop-color="{secondary}" stop-opacity="0.50"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#071523" stop-opacity="0.88"/>
      <stop offset="1" stop-color="#13212d" stop-opacity="0.76"/>
    </linearGradient>
  </defs>
{image_markup}
  <rect width="{width}" height="{height}" fill="url(#shade)"/>
{visual_mark}
  <rect x="{panel_x}" y="{panel_y}" width="{panel_width}" height="{panel_height}" rx="{panel_rx}" fill="url(#panel)"/>
  <rect x="{panel_x}" y="{panel_y}" width="{max(6, int(width * 0.006))}" height="{panel_height}" rx="{max(6, int(width * 0.006))}" fill="{accent}"/>
  <text x="{inner_x}" y="{int(panel_y + panel_height * 0.18)}" fill="#ffffff" opacity="0.86" font-family="Inter, Arial, sans-serif" font-size="{small_size}" font-weight="800">CME STREAMING</text>
  <rect x="{inner_x}" y="{int(panel_y + panel_height * 0.225)}" width="{max(80, int(panel_width * 0.24))}" height="{max(28, int(panel_height * 0.105))}" rx="{max(12, int(panel_height * 0.045))}" fill="{accent}" opacity="0.96"/>
  <text x="{int(inner_x + panel_width * 0.045)}" y="{int(panel_y + panel_height * 0.295)}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="{small_size}" font-weight="900">{badge} V{variant_number}</text>
{text_lines_markup(headline_lines, inner_x, headline_y, headline_size, "#ffffff", 900)}
{text_lines_markup(support_lines, inner_x, int(headline_y + headline_size * 2.55), body_size, "rgba(255,255,255,0.78)", 720)}
{text_lines_markup(brief_lines, inner_x, int(headline_y + headline_size * 3.45), small_size, "rgba(255,255,255,0.58)", 700, 1.0)}
  <rect x="{inner_x}" y="{cta_y}" width="{cta_width}" height="{cta_height}" rx="{max(14, int(panel_height * 0.052))}" fill="{accent}"/>
  <text x="{int(inner_x + panel_width * 0.050)}" y="{int(cta_y + cta_height * 0.64)}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="{small_size}" font-weight="900">{cta_text}</text>
  <text x="{int(panel_x + panel_width - panel_width * 0.30)}" y="{int(panel_y + panel_height - panel_height * 0.090)}" fill="rgba(255,255,255,0.52)" font-family="Inter, Arial, sans-serif" font-size="{max(9, int(small_size * 0.82))}" font-weight="700">{treatment_name}</text>
</svg>"""


def _edit_steps_for_placement(
    placement: str,
    variant_number: int = 1,
    edit_types: Optional[list[str]] = None,
    source_width: int = 1280,
    source_height: int = 720,
    source_aspect_ratio: str = "16:9",
) -> list[dict[str, Any]]:
    spec = _placement_spec(placement)
    ordered_types = [
        "resize",
        "aspect_ratio_conversion",
        "text_safe_area_adjustment",
        "cleanup",
    ]
    if placement in {"homepage_hero", "newsletter_banner", "story_unit"}:
        ordered_types.extend(["outpaint", "background_extension"])
    if placement in {"app_tile", "social_square", "story_unit"}:
        ordered_types.append("crop")
    if variant_number % 2 == 1:
        ordered_types.append("inpaint")

    if edit_types:
        allowed = {item for item in edit_types if item in EDIT_OPERATION_LABELS}
        ordered_types = [item for item in ordered_types if item in allowed] or ["resize"]

    steps = []
    for sequence, edit_type in enumerate(dict.fromkeys(ordered_types), start=1):
        steps.append(
            {
                "edit_sequence": sequence,
                "transformation_type": edit_type,
                "edit_label": EDIT_OPERATION_LABELS[edit_type],
                "edit_goal": {
                    "resize": "Scale output to placement pixel dimensions.",
                    "crop": "Reframe focal region for the target placement.",
                    "inpaint": "Clean or replace localized artifacts in image-safe regions.",
                    "outpaint": "Extend the canvas beyond the source frame.",
                    "cleanup": "Remove minor visual defects and compression artifacts.",
                    "background_extension": "Extend background texture behind copy and CTA zones.",
                    "text_safe_area_adjustment": "Reserve readable copy space for the channel.",
                    "aspect_ratio_conversion": "Convert source framing to the target aspect ratio.",
                }[edit_type],
                "parameters": {
                    "placement": placement,
                    "source_width_px": source_width,
                    "source_height_px": source_height,
                    "source_aspect_ratio": source_aspect_ratio,
                    "output_width_px": spec["width_px"],
                    "output_height_px": spec["height_px"],
                    "output_aspect_ratio": spec["aspect_ratio"],
                    "safe_area": spec["safe_area"],
                    "channels": spec["channels"],
                },
            }
        )
    return steps


def _adaptation_summary(steps: list[dict[str, Any]], placement: str) -> str:
    labels = [step["edit_label"] for step in steps[:4]]
    remaining = len(steps) - len(labels)
    suffix = f" + {remaining} more" if remaining > 0 else ""
    return f"{_placement_spec(placement)['label']} adaptation: {', '.join(labels)}{suffix}."


def _demo_audience_traits() -> list[dict[str, Any]]:
    tones = ["premium", "urgent", "warm", "direct"]
    return [
        {
            "cohort_id": audience["cohort_id"],
            "trait_profile_id": f"TRAIT-{index + 1:04d}",
            "topic_affinity_json": json.dumps(["sports", "live events"] if "Sports" in audience["cohort_name"] else ["family", "premium video"]),
            "subscription_propensity_score": round(0.56 + index * 0.07, 2),
            "churn_risk_score": round(0.72 if "Churn" in audience["cohort_name"] else 0.18 + index * 0.04, 2),
            "device_usage_json": json.dumps({"ctv": 0.38, "mobile": 0.42, "web": 0.2}),
            "engagement_style": "short-form browsing" if index % 2 else "appointment viewing",
            "lifecycle_stage": "winback" if "Churn" in audience["cohort_name"] else "growth",
            "preferred_tone": tones[index % len(tones)],
            "creative_implications_text": f"Creative should reflect {audience['cohort_name']} interests, lifecycle stage, and device behavior.",
            "excluded_claims_json": json.dumps(["unsupported savings claims", "unverified content rights"]),
            "region_constraints_json": json.dumps({"allowed": ["US", "CA"], "blocked": []}),
            "channel_constraints_json": json.dumps({"allowed": ["web", "app", "email", "social", "onsite_personalization"]}),
            "created_ts": "2026-05-27",
            "updated_ts": "2026-05-27",
        }
        for index, audience in enumerate(AUDIENCES[:4])
    ]


def _demo_base_assets() -> list[dict[str, Any]]:
    placements = list(PLACEMENT_SPECS.items())
    rows = []
    for index in range(12):
        placement, spec = placements[index % len(placements)]
        asset_id = f"BASE-{index + 1:04d}"
        rows.append(
            {
                "asset_id": asset_id,
                "asset_name": f"{placement.replace('_', ' ').title()} Base {index + 1}",
                "asset_type": "image",
                "storage_uri": _creative_volume_uri("base", f"{asset_id}.svg"),
                "thumbnail_uri": _creative_volume_uri("base", f"{asset_id}.svg"),
                "format": "svg",
                "width_px": spec["width_px"],
                "height_px": spec["height_px"],
                "duration_sec": 0,
                "aspect_ratio": spec["aspect_ratio"],
                "content_tags": f"synthetic,governed,{placement},brand_safe",
                "description": f"Governed synthetic source asset for {placement.replace('_', ' ')} creative generation.",
                "source_system": "csv_fallback_model_endpoint_demo",
                "source_asset_external_id": f"SYNTH-{index + 1:04d}",
                "rights_profile_id": "RIGHTS-001",
                "approved_usage_contexts_json": json.dumps(spec["channels"]),
                "historical_performance_json": json.dumps({"ctr": round(0.7 + index * 0.06, 2), "conversion_rate": round(0.04 + index * 0.003, 3)}),
                "brand_safety_score": 90 + (index % 7),
                "status": "active",
                "created_ts": "2026-05-27",
                "updated_ts": "2026-05-27",
            }
        )
    return rows


def _demo_generation_requests() -> list[dict[str, Any]]:
    rows = []
    placements = list(PLACEMENT_SPECS)
    for audience_index, audience in enumerate(AUDIENCES[:4]):
        brief = BRIEFS[audience_index % len(BRIEFS)]
        for placement_index, placement in enumerate(placements):
            request_number = len(rows) + 1
            rows.append(
                {
                    "request_id": f"REQ-{request_number:05d}",
                    "brief_id": brief["brief_id"],
                    "cohort_id": audience["cohort_id"],
                    "placement": placement,
                    "campaign_objective": brief["campaign_objective"],
                    "content_type": "image",
                    "brand_guideline_id": _default_brand_guideline()["guideline_id"],
                    "brand_guideline_version": _default_brand_guideline()["version"],
                    "generation_model_id": "gpt-5-mini-balanced",
                    "generation_model_label": "GPT-5 Mini - Balanced",
                    "image_model_id": "gpt-5-mini-balanced",
                    "compare_model_ids_json": json.dumps(["kimi-2-compare"]),
                    "end_card_text": "",
                    "cta_text": "",
                    "source_mode": "search_and_generate",
                    "selected_base_asset_ids_json": json.dumps([f"BASE-{((audience_index * len(placements) + placement_index) % 12) + 1:04d}"]),
                    "user_instructions": f"Create placement-ready variants for {audience['cohort_name']} in {PLACEMENT_SPECS[placement]['label']}.",
                    "system_prompt": "Databricks model endpoint generates polished, brand-safe creative variants from governed assets with one clear visual idea per output.",
                    "negative_prompt": "No real people, copyrighted characters, false claims, or restricted regional references.",
                    "requested_variant_count": 4,
                    "requested_by": "local.demo@databricks",
                    "request_status": "completed",
                    "created_ts": "2026-05-27",
                    "completed_ts": "2026-05-27",
                }
            )
    rows.append(
        {
            "request_id": f"REQ-{len(rows) + 1:05d}",
            "brief_id": "BRIEF-001",
            "cohort_id": "COH-001",
            "placement": "ctv_15s",
            "campaign_objective": BRIEFS[0]["campaign_objective"],
            "content_type": "video_endcard",
            "brand_guideline_id": _default_brand_guideline()["guideline_id"],
            "brand_guideline_version": _default_brand_guideline()["version"],
            "generation_model_id": "runway-gen3-video-endcard",
            "generation_model_label": "Runway Gen-3 - Video End Card",
            "image_model_id": "gpt-5-mini-balanced",
            "compare_model_ids_json": json.dumps([]),
            "end_card_text": "Live games. One streaming home.",
            "cta_text": "Start watching",
            "source_mode": "search_and_generate_video_end_card",
            "selected_base_asset_ids_json": json.dumps(["BASE-0001"]),
            "user_instructions": "Create a 15-second CTV video end card for Boomers in the Midwest with a clear live-sports CTA.",
            "system_prompt": "Video endpoint generates a polished short MP4 final frame from governed seed imagery with clean copy, restrained overlays, and CME Streaming guidelines.",
            "negative_prompt": "No real people, copyrighted characters, false claims, or restricted regional references.",
            "requested_variant_count": 4,
            "requested_by": "local.demo@databricks",
            "request_status": "completed",
            "created_ts": "2026-06-01",
            "completed_ts": "2026-06-01",
        }
    )
    return rows


def _demo_variants() -> list[dict[str, Any]]:
    requests = _demo_generation_requests()
    rows = []
    for request_index, request in enumerate(requests):
        audience = next((item for item in AUDIENCES if item["cohort_id"] == request["cohort_id"]), AUDIENCES[0])
        brief = next((item for item in BRIEFS if item["brief_id"] == request["brief_id"]), BRIEFS[0])
        is_video = _is_video_content(_as_text(request.get("content_type")))
        variant_count = max(1, min(_as_int_value(request.get("requested_variant_count"), 4), 4 if is_video else 4))
        for variant in range(variant_count):
            creative_asset_id = f"VAR-{request_index * 4 + variant + 1:06d}"
            spec = _placement_spec(request["placement"])
            source_asset_id = _loads_json(request["selected_base_asset_ids_json"], ["BASE-0001"])[0]
            source_asset = next((item for item in _demo_base_assets() if item["asset_id"] == source_asset_id), None)
            edit_steps = _edit_steps_for_placement(
                request["placement"],
                variant + 1,
                source_width=int(source_asset.get("width_px", 1280)) if source_asset else 1280,
                source_height=int(source_asset.get("height_px", 720)) if source_asset else 720,
                source_aspect_ratio=str(source_asset.get("aspect_ratio", "16:9")) if source_asset else "16:9",
            )
            if is_video:
                edit_steps.extend(
                    [
                        {
                            "edit_sequence": len(edit_steps) + 1,
                            "transformation_type": "video_end_card_overlay",
                            "edit_label": EDIT_OPERATION_LABELS["video_end_card_overlay"],
                            "edit_goal": "Generate a final MP4 end card with readable headline and brand-safe image treatment.",
                        },
                        {
                            "edit_sequence": len(edit_steps) + 2,
                            "transformation_type": "cta_overlay",
                            "edit_label": EDIT_OPERATION_LABELS["cta_overlay"],
                            "edit_goal": "Place the CTA inside the final-frame safe area.",
                        },
                    ]
                )
            video_headline, video_cta = _video_copy_for_variant(
                _as_text(request.get("end_card_text"), "Live games. One streaming home."),
                _as_text(request.get("cta_text"), "Start watching"),
                variant + 1,
            )
            video_treatment = _video_treatment_for(
                request.get("campaign_objective") or audience.get("cohort_name"),
                request["placement"],
                variant + 1,
            )
            visual_treatment = _creative_visual_treatment_for(
                brief,
                audience,
                request.get("campaign_objective"),
                request["placement"],
                variant + 1,
            )
            quality = 78 + request_index * 3 + variant * 4
            rows.append(
                {
                    "creative_asset_id": creative_asset_id,
                    "request_id": request["request_id"],
                    "brief_id": request["brief_id"],
                    "cohort_id": request["cohort_id"],
                    "source_asset_id": source_asset_id,
                    "parent_creative_asset_id": source_asset_id,
                    "variant_number": variant + 1,
                    "asset_name": f"{audience['cohort_name']} {visual_treatment['name']} Variant {variant + 1}",
                    "asset_type": "Video" if is_video else "Image",
                    "content_type": "video_endcard" if is_video else request["content_type"],
                    "placement": request["placement"],
                    "format": "MP4" if is_video else "SVG",
                    "width_px": spec["width_px"],
                    "height_px": spec["height_px"],
                    "duration_sec": VIDEO_SEED_SAMPLE_DURATION_SECONDS if is_video else 0,
                    "aspect_ratio": spec["aspect_ratio"],
                    "storage_uri": f"demo-mp4://{creative_asset_id}.mp4" if is_video else _creative_volume_uri("generated", f"{creative_asset_id}.svg"),
                    "thumbnail_uri": _creative_volume_uri("generated", f"{creative_asset_id}.svg"),
                    "video_preview_uri": f"/api/creative-variants/{creative_asset_id}/video-preview" if is_video else "",
                    "mp4_storage_uri": f"demo-mp4://{creative_asset_id}.mp4" if is_video else "",
                    "video_source_asset_id": source_asset_id if is_video else "",
                    "end_card_text": video_headline if is_video else request.get("end_card_text", ""),
                    "cta_text": video_cta if is_video else request.get("cta_text", ""),
                    "generation_prompt": request["user_instructions"],
                    "generation_model": request.get("generation_model_label") or "GPT-5 Mini - Balanced",
                    "generation_model_id": request.get("generation_model_id", "gpt-5-mini-balanced"),
                    "brand_guideline_id": request.get("brand_guideline_id", _default_brand_guideline()["guideline_id"]),
                    "generation_params_json": json.dumps(
                        {
                            "mode": CREATIVE_GENERATION_MODE,
                            "model_endpoint": _model_option_by_id(request.get("generation_model_id", "")).get("endpoint_name"),
                            "model_id": request.get("generation_model_id", "gpt-5-mini-balanced"),
                            "model_label": request.get("generation_model_label") or "GPT-5 Mini - Balanced",
                            "brand_guideline_id": request.get("brand_guideline_id", _default_brand_guideline()["guideline_id"]),
                            "brand_guideline_version": request.get("brand_guideline_version", _default_brand_guideline()["version"]),
                            "variant": variant + 1,
                            "applied_edit_types": [step["transformation_type"] for step in edit_steps],
                            "video_preview_uri": f"/api/creative-variants/{creative_asset_id}/video-preview" if is_video else "",
                            "end_card_text": video_headline if is_video else request.get("end_card_text", ""),
                            "cta_text": video_cta if is_video else request.get("cta_text", ""),
                            "video_treatment": video_treatment if is_video else {},
                            "visual_treatment": visual_treatment,
                        }
                    ),
                    "adaptation_summary": (
                        f"Generated 15s MP4 end card with {video_treatment['name']} treatment from governed seed image and CME Streaming brand guideline."
                        if is_video
                        else f"Generated {visual_treatment['element_primary']} for {visual_treatment['audience_name']} from governed seed image. {_adaptation_summary(edit_steps, request['placement'])}"
                    ),
                    "approval_status": "Approved" if variant >= 2 else "Pending_Review",
                    "approved_by": "local.reviewer@databricks" if variant >= 2 else "",
                    "approved_ts": "2026-05-27" if variant >= 2 else None,
                    "created_ts": "2026-05-27",
                    "updated_ts": "2026-05-27",
                    "quality_score": quality,
                    "predicted_ctr": round(0.76 + quality / 100.0, 2),
                    "target_segment": audience["cohort_name"],
                    "content_tags": f"synthetic,{request['placement']},variant,{visual_treatment['treatment_id']},{video_treatment['treatment_id'] if is_video else 'image'}",
                }
            )
    return rows


def _demo_policy_checks() -> list[dict[str, Any]]:
    rows = []
    for variant in _demo_variants():
        for check_type, status, score in [
            ("brand_fit", "pass", 92),
            ("rights", "pass", 98),
            ("regional_usage", "pass", 96),
            ("safety", "warn" if variant["variant_number"] == 1 else "pass", 86 if variant["variant_number"] == 1 else 94),
        ]:
            rows.append(
                {
                    "check_id": f"CHECK-{len(rows) + 1:07d}",
                    "creative_asset_id": variant["creative_asset_id"],
                    "check_type": check_type,
                    "check_status": status,
                    "score": score,
                    "blocking_reason": "Review headline intensity" if status == "warn" else "",
                    "evidence_json": json.dumps(
                        {
                            "source": "databricks_model_endpoint",
                            "placement": variant["placement"],
                            "brand_guideline_id": variant.get("brand_guideline_id", _default_brand_guideline()["guideline_id"]),
                            "brand_guideline_version": _default_brand_guideline()["version"],
                        }
                    ),
                    "policy_version": "2026.05-demo",
                    "model_or_rule": CREATIVE_POLICY_MODEL_ENDPOINT,
                    "review_required": status != "pass",
                    "created_ts": "2026-05-27",
                }
            )
    return rows


def _demo_transformations() -> list[dict[str, Any]]:
    rows = []
    base_assets = {item["asset_id"]: item for item in _demo_base_assets()}
    for variant in _demo_variants():
        source = base_assets.get(str(variant.get("source_asset_id")), {})
        steps = _edit_steps_for_placement(
            str(variant["placement"]),
            int(variant["variant_number"]),
            source_width=int(source.get("width_px", 1280)),
            source_height=int(source.get("height_px", 720)),
            source_aspect_ratio=str(source.get("aspect_ratio", "16:9")),
        )
        if _is_video_content(_as_text(variant.get("content_type"))):
            spec = _placement_spec(_as_text(variant.get("placement")))
            for edit_type, goal in [
                ("video_end_card_overlay", "Generate a final MP4 end card with readable headline and brand-safe image treatment."),
                ("cta_overlay", "Place the CTA inside the final-frame safe area."),
            ]:
                steps.append(
                    {
                        "edit_sequence": len(steps) + 1,
                        "transformation_type": edit_type,
                        "edit_label": EDIT_OPERATION_LABELS[edit_type],
                        "edit_goal": goal,
                        "parameters": {
                            "placement": variant["placement"],
                            "source_width_px": int(source.get("width_px", 1280)),
                            "source_height_px": int(source.get("height_px", 720)),
                            "source_aspect_ratio": str(source.get("aspect_ratio", "16:9")),
                            "output_width_px": spec["width_px"],
                            "output_height_px": spec["height_px"],
                            "output_aspect_ratio": spec["aspect_ratio"],
                            "safe_area": spec["safe_area"],
                            "channels": spec["channels"],
                            "end_card_text": variant.get("end_card_text", ""),
                            "cta_text": variant.get("cta_text", ""),
                        },
                    }
                )
        for step in steps:
            parameters = step["parameters"]
            rows.append(
                {
                    "transformation_id": f"XFORM-{len(rows) + 1:07d}",
                    "creative_asset_id": variant["creative_asset_id"],
                    "input_asset_id": variant["source_asset_id"],
                    "output_asset_id": variant["creative_asset_id"],
                    "transformation_type": step["transformation_type"],
                    "edit_sequence": step["edit_sequence"],
                    "edit_label": step["edit_label"],
                    "edit_goal": step["edit_goal"],
                    "placement": variant["placement"],
                    "source_width_px": parameters["source_width_px"],
                    "source_height_px": parameters["source_height_px"],
                    "source_aspect_ratio": parameters["source_aspect_ratio"],
                    "output_width_px": parameters["output_width_px"],
                    "output_height_px": parameters["output_height_px"],
                    "output_aspect_ratio": parameters["output_aspect_ratio"],
                    "tool_or_model": variant.get("generation_model") or CREATIVE_MODEL_ENDPOINT,
                    "parameters_json": json.dumps(parameters),
                    "edit_status": "completed",
                    "performed_by": "local.demo@databricks",
                    "created_ts": "2026-05-27",
                }
            )
    return rows


def _demo_evaluations() -> list[dict[str, Any]]:
    rows = []
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for variant in _demo_variants():
        score = 76 + int(variant["variant_number"]) * 5
        row = {
            "evaluation_id": f"EVAL-{len(rows) + 1:07d}",
            "creative_asset_id": variant["creative_asset_id"],
            "cohort_id": variant["cohort_id"],
            "placement": variant["placement"],
            "panel_size": 125,
            "click_propensity_score": score,
            "expected_dwell_time_score": score + 3,
            "subscription_start_propensity_score": score - 2,
            "relevance_score": score + 5,
            "clarity_score": score + 2,
            "fatigue_risk_score": 30 - int(variant["variant_number"]) * 4,
            "brand_fit_score": score + 4,
            "overall_score": score + 3,
            "rank_within_segment_placement": 0,
            "judge_model": CREATIVE_JUDGE_MODEL_ENDPOINT,
            "judge_prompt_version": "2026.05-demo",
            "evidence_json": json.dumps({"top_signal": "message clarity", "mode": CREATIVE_GENERATION_MODE}),
            "created_ts": "2026-05-27",
        }
        rows.append(row)
        grouped.setdefault((row["cohort_id"], row["placement"]), []).append(row)
    for values in grouped.values():
        for rank, row in enumerate(sorted(values, key=lambda item: item["overall_score"], reverse=True), start=1):
            row["rank_within_segment_placement"] = rank
    return rows


def _bounded_score(value: float, floor: int = 0, ceiling: int = 99) -> int:
    return int(max(floor, min(ceiling, round(value))))


def _approval_gate_evaluation_for_variant(
    variant: dict[str, Any],
    existing_evaluations: list[dict[str, Any]],
    approved_ts: str,
) -> dict[str, Any]:
    creative_asset_id = _as_text(variant.get("creative_asset_id"), "creative")
    variant_number = max(1, _as_int_value(variant.get("variant_number"), 1))
    quality_score = _as_float_value(variant.get("quality_score"), 82 + variant_number * 3)
    predicted_ctr = _as_float_value(variant.get("predicted_ctr"), 1.15 + variant_number * 0.2)
    freshness = _stable_fraction(creative_asset_id, variant.get("cohort_id"), variant.get("placement"))
    visual_signal = _stable_fraction(variant.get("asset_name"), variant.get("generation_model"), variant.get("reference_asset_id"))
    params = _loads_json(variant.get("generation_params_json"), {})
    if not isinstance(params, dict):
        params = {}

    base_score = quality_score * 0.62 + min(predicted_ctr, 4.8) * 5.4 + 12 + variant_number * 0.6 + freshness * 4
    click_score = _bounded_score(base_score + visual_signal * 5 - 3, 62, 97)
    dwell_score = _bounded_score(base_score + 4 + freshness * 3, 64, 98)
    subscription_score = _bounded_score(base_score - 2 + variant_number, 60, 96)
    relevance_score = _bounded_score(quality_score + 4 + freshness * 3, 66, 99)
    clarity_score = _bounded_score(quality_score + 2 + visual_signal * 4, 66, 99)
    fatigue_score = _bounded_score(34 - variant_number * 3 - freshness * 5, 8, 42)
    brand_fit_score = _bounded_score(quality_score + 5 + visual_signal * 2, 68, 99)
    overall_score = _bounded_score(
        relevance_score * 0.28
        + clarity_score * 0.18
        + brand_fit_score * 0.20
        + click_score * 0.16
        + subscription_score * 0.14
        + (100 - fatigue_score) * 0.04,
        68,
        98,
    )
    evaluation = {
        "evaluation_id": f"EVAL-APP-{_safe_volume_filename(creative_asset_id, 'creative')}",
        "creative_asset_id": creative_asset_id,
        "cohort_id": variant.get("cohort_id"),
        "placement": variant.get("placement"),
        "panel_size": 125,
        "click_propensity_score": click_score,
        "expected_dwell_time_score": dwell_score,
        "subscription_start_propensity_score": subscription_score,
        "relevance_score": relevance_score,
        "clarity_score": clarity_score,
        "fatigue_risk_score": fatigue_score,
        "brand_fit_score": brand_fit_score,
        "overall_score": overall_score,
        "rank_within_segment_placement": 1,
        "judge_model": CREATIVE_JUDGE_MODEL_ENDPOINT,
        "judge_prompt_version": "2026.06-approval-gate",
        "evidence_json": json.dumps(
            {
                "top_signal": "approved creative persisted into evaluation gate",
                "source": "creative_studio_approval",
                "mode": CREATIVE_GENERATION_MODE,
                "quality_score": round(quality_score, 2),
                "predicted_ctr": round(predicted_ctr, 2),
                "generation_model": variant.get("generation_model") or CREATIVE_MODEL_ENDPOINT,
                "brand_guideline_id": variant.get("brand_guideline_id"),
                "content_type": variant.get("content_type") or variant.get("asset_type"),
                "visual_treatment_id": params.get("visual_treatment_id") or params.get("treatment_id"),
            }
        ),
        "created_ts": approved_ts,
    }
    segment_rows = [
        item
        for item in existing_evaluations
        if item.get("creative_asset_id") != creative_asset_id
        and item.get("cohort_id") == evaluation["cohort_id"]
        and item.get("placement") == evaluation["placement"]
    ] + [evaluation]
    for rank, item in enumerate(
        sorted(segment_rows, key=lambda row: _as_float_value(row.get("overall_score"), 0.0), reverse=True),
        start=1,
    ):
        if item is evaluation:
            evaluation["rank_within_segment_placement"] = rank
            break
    return evaluation


def _demo_lineage_edges() -> list[dict[str, Any]]:
    rows = []
    for variant in _demo_variants():
        for source_type, source_id, relationship in [
            ("brief", variant["brief_id"], "brief_to_request"),
            ("audience", variant["cohort_id"], "audience_to_request"),
            ("base_asset", variant["source_asset_id"], "base_asset_to_variant"),
            ("generation_request", variant["request_id"], "request_to_variant"),
        ]:
            rows.append(
                {
                    "lineage_edge_id": f"LINE-{len(rows) + 1:07d}",
                    "source_entity_type": source_type,
                    "source_entity_id": source_id,
                    "target_entity_type": "generation_request" if relationship in {"brief_to_request", "audience_to_request"} else "creative_variant",
                    "target_entity_id": variant["request_id"] if relationship in {"brief_to_request", "audience_to_request"} else variant["creative_asset_id"],
                    "relationship_type": relationship,
                    "metadata_json": json.dumps({"placement": variant["placement"], "request_id": variant["request_id"]}),
                    "created_ts": "2026-05-27",
                }
            )
    for transformation in _demo_transformations():
        rows.append(
            {
                "lineage_edge_id": f"LINE-{len(rows) + 1:07d}",
                "source_entity_type": "creative_transformation",
                "source_entity_id": transformation["transformation_id"],
                "target_entity_type": "creative_variant",
                "target_entity_id": transformation["output_asset_id"],
                "relationship_type": "transformation_to_variant",
                "metadata_json": json.dumps(
                    {
                        "placement": transformation["placement"],
                        "transformation_type": transformation["transformation_type"],
                        "edit_sequence": transformation["edit_sequence"],
                    }
                ),
                "created_ts": "2026-05-27",
            }
        )
    return rows


def _demo_activation_exports() -> list[dict[str, Any]]:
    rows = []
    for evaluation in _demo_evaluations():
        if evaluation["rank_within_segment_placement"] == 1:
            rows.append(
                {
                    "export_id": f"EXPORT-{len(rows) + 1:06d}",
                    "creative_asset_id": evaluation["creative_asset_id"],
                    "cohort_id": evaluation["cohort_id"],
                    "placement": evaluation["placement"],
                    "destination_system": ACTIVATION_DESTINATION_SYSTEM,
                    "destination_asset_id": f"ONSITE-{len(rows) + 1:06d}",
                    "payload_uri": _creative_volume_uri("exports", f"EXPORT-{len(rows) + 1:06d}.json"),
                    "export_status": "ready",
                    "exported_by": "local.demo@databricks",
                    "exported_ts": "2026-05-27",
                    "error_message": "",
                }
            )
    return rows


def _query_workflow_table(logical_name: str, table: str, fallback: list[dict[str, Any]], row_limit: int = 500) -> list[dict[str, Any]]:
    if not USE_PIPELINE_DATA:
        DATA_LOAD_SOURCES[logical_name] = {
            "source": "model_endpoint_demo_fallback",
            "path": "in_memory",
            "rows": len(fallback),
            "loaded": True,
        }
        return fallback

    full_name = _pipeline_table(table)
    try:
        rows = _execute_sql(f"SELECT * FROM {full_name} LIMIT {row_limit}", row_limit=row_limit)
        _table_source(logical_name, full_name, len(rows))
        return rows
    except Exception as exc:
        _table_error(logical_name, exc)
        return fallback


def _query_enhancement_table(logical_name: str, table: str, fallback: list[dict[str, Any]], row_limit: int = 100) -> list[dict[str, Any]]:
    if not USE_PIPELINE_DATA:
        DATA_LOAD_SOURCES[logical_name] = {
            "source": "model_endpoint_demo_fallback",
            "path": "in_memory",
            "rows": len(fallback),
            "loaded": True,
        }
        return fallback

    full_name = _pipeline_table(table)
    try:
        rows = _execute_sql(f"SELECT * FROM {full_name} LIMIT {row_limit}", row_limit=row_limit)
        _table_source(logical_name, full_name, len(rows))
        return rows or fallback
    except Exception as exc:
        _table_error(logical_name, exc)
        return fallback


@lru_cache(maxsize=1)
def _brand_guidelines_data() -> list[dict[str, Any]]:
    return _query_enhancement_table("brand_guidelines", "gold_buyside_brand_guideline_profile", BRAND_GUIDELINES)


@lru_cache(maxsize=1)
def _generation_model_options_data() -> list[dict[str, Any]]:
    rows = _query_enhancement_table("generation_models", "gold_buyside_generation_model_option", GENERATION_MODEL_OPTIONS)
    return [{**row, "default": _as_bool_value(row.get("default"))} for row in rows]


@lru_cache(maxsize=1)
def _audience_demographic_signals_data() -> list[dict[str, Any]]:
    return _query_enhancement_table(
        "audience_demographics",
        "gold_buyside_audience_demographic_signal",
        AUDIENCE_DEMOGRAPHIC_SIGNALS,
    )


@lru_cache(maxsize=1)
def _purchase_intent_signals_data() -> list[dict[str, Any]]:
    return _query_enhancement_table("purchase_signals", "gold_buyside_purchase_intent_signal", PURCHASE_INTENT_SIGNALS)


@lru_cache(maxsize=1)
def _evaluation_rubrics_data() -> list[dict[str, Any]]:
    return _query_enhancement_table("evaluation_rubrics", "gold_buyside_synthetic_eval_rubric", EVALUATION_RUBRICS)


@lru_cache(maxsize=1)
def _creative_workflow_data() -> dict[str, list[dict[str, Any]]]:
    return {
        "audience_traits": _query_workflow_table("audience_trait_profiles", "gold_buyside_audience_trait_profile", _demo_audience_traits()),
        "base_assets": _query_workflow_table("base_creative_assets", "gold_buyside_base_creative_asset", _demo_base_assets()),
        "generation_requests": _query_workflow_table(
            "creative_generation_requests",
            "gold_buyside_creative_generation_request",
            _demo_generation_requests(),
        ),
        "variants": _query_workflow_table("creative_variants", "gold_buyside_creative_variant", _demo_variants()),
        "creative_transformations": _query_workflow_table(
            "creative_transformations",
            "gold_buyside_creative_transformation",
            _demo_transformations(),
            row_limit=1000,
        ),
        "policy_checks": _query_workflow_table("creative_policy_checks", "gold_buyside_creative_policy_check", _demo_policy_checks()),
        "synthetic_evaluations": _query_workflow_table(
            "synthetic_audience_evaluations",
            "gold_buyside_synthetic_audience_eval",
            _demo_evaluations(),
        ),
        "lineage_edges": _query_workflow_table("creative_lineage_edges", "gold_buyside_creative_lineage_edge", _demo_lineage_edges()),
        "activation_exports": _query_workflow_table("activation_exports", "gold_buyside_activation_export", _demo_activation_exports()),
    }


def _register_static_demo_tables() -> None:
    matrix_rows = _evaluation_channel_matrix_rows(_workflow_rows())
    for name, rows in [
        ("brand_guidelines", _brand_guidelines_data()),
        ("generation_models", _generation_model_options_data()),
        ("audience_demographics", _audience_demographic_signals_data()),
        ("purchase_signals", _purchase_intent_signals_data()),
        ("evaluation_rubrics", _evaluation_rubrics_data()),
        ("evaluation_channel_matrix", matrix_rows),
    ]:
        if _as_text(DATA_LOAD_SOURCES.get(name, {}).get("source")).startswith("databricks_sql"):
            continue
        if name == "evaluation_channel_matrix" and USE_PIPELINE_DATA:
            DATA_LOAD_SOURCES[name] = {
                "source": "databricks_sql_derived",
                "path": (
                    f"{PIPELINE_CATALOG}.{PIPELINE_SCHEMA}.gold_buyside_synthetic_audience_eval + "
                    f"{PIPELINE_CATALOG}.{PIPELINE_SCHEMA}.gold_buyside_creative_variant"
                ),
                "rows": len(rows),
                "loaded": True,
            }
            continue
        DATA_LOAD_SOURCES[name] = {
            "source": "model_endpoint_demo_fallback",
            "path": "in_memory",
            "rows": len(rows),
            "loaded": True,
        }


def _synthetic_svg(title: str, subtitle: str, ratio: str = "16:9") -> str:
    width, height = {
        "1:1": (1080, 1080),
        "9:16": (1080, 1920),
        "6:1": (1200, 200),
        "4:5": (1080, 1350),
    }.get(ratio, (1280, 720))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f9f95"/>
      <stop offset="1" stop-color="#256b8f"/>
    </linearGradient>
    <pattern id="grid" width="54" height="54" patternUnits="userSpaceOnUse">
      <path d="M 54 0 L 0 0 0 54" fill="none" stroke="rgba(255,255,255,0.20)" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="{width}" height="{height}" fill="url(#g)"/>
  <rect width="{width}" height="{height}" fill="url(#grid)" opacity="0.5"/>
  <circle cx="{int(width * 0.82)}" cy="{int(height * 0.24)}" r="{int(min(width, height) * 0.18)}" fill="rgba(255,255,255,0.20)"/>
  <text x="{int(width * 0.08)}" y="{int(height * 0.50)}" fill="white" font-family="Inter, Arial, sans-serif" font-size="{max(30, int(width * 0.044))}" font-weight="800">{title[:42]}</text>
  <text x="{int(width * 0.08)}" y="{int(height * 0.62)}" fill="rgba(255,255,255,0.84)" font-family="Inter, Arial, sans-serif" font-size="{max(18, int(width * 0.023))}" font-weight="600">{subtitle[:58]}</text>
</svg>"""


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/backend-tables")
async def backend_tables() -> dict[str, Any]:
    _runtime_data()
    _creative_workflow_data()
    _register_static_demo_tables()
    state_rows = len(_lakebase_events(limit=1)) if _lakebase_configured() else 0
    return {
        "data_source": "databricks_sql" if USE_PIPELINE_DATA else "csv_extract",
        "app_state_backend": "lakebase" if _lakebase_init() else "memory_fallback",
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
        "state": {
            **DATA_LOAD_SOURCES.get("app_state", {}),
            "recent_event_rows": state_rows,
        },
    }


@app.get("/api/model-status")
async def model_status() -> dict[str, Any]:
    audience_endpoint_name = (
        os.getenv("AUDIENCE_MODEL_SERVING_ENDPOINT")
        or os.getenv("DATABRICKS_MODEL_SERVING_ENDPOINT")
        or os.getenv("MODEL_SERVING_ENDPOINT")
    )
    return {
        "audience_lens_uses_model_serving": False,
        "serving_endpoint_configured": bool(CREATIVE_MODEL_ENDPOINT or audience_endpoint_name),
        "configured_endpoint": CREATIVE_MODEL_ENDPOINT or audience_endpoint_name,
        "creative_generation_mode": CREATIVE_GENERATION_MODE,
        "creative_model_endpoint": CREATIVE_MODEL_ENDPOINT,
        "creative_image_model": CREATIVE_IMAGE_MODEL,
        "generation_model_options": GENERATION_MODEL_OPTIONS,
        "brand_guideline_profile": _default_brand_guideline(),
        "policy_model_endpoint": CREATIVE_POLICY_MODEL_ENDPOINT,
        "judge_model_endpoint": CREATIVE_JUDGE_MODEL_ENDPOINT,
        "app_state_backend": "lakebase" if _lakebase_init() else "memory_fallback",
        "lakebase_instance_name": LAKEBASE_INSTANCE_NAME,
        "lakebase_database_name": LAKEBASE_DATABASE_NAME,
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
            f"Creative generation mode is {CREATIVE_GENERATION_MODE}; creative generation uses {CREATIVE_MODEL_ENDPOINT}.",
            f"Creative image assets are labeled as {CREATIVE_IMAGE_MODEL}.",
            f"Policy checks use {CREATIVE_POLICY_MODEL_ENDPOINT}; synthetic audience judging uses {CREATIVE_JUDGE_MODEL_ENDPOINT}.",
        ],
    }


@app.get("/api/dashboard")
async def dashboard() -> dict[str, Any]:
    return _runtime_data()["dashboard"]


@app.get("/api/briefs")
async def briefs() -> list[dict[str, Any]]:
    return _runtime_data()["briefs"]


@app.get("/api/briefs/{brief_id}")
async def brief_detail(brief_id: str) -> dict[str, Any]:
    brief = next((item for item in _runtime_data()["briefs"] if item.get("brief_id") == brief_id), None)
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
    return brief


@app.get("/api/audiences")
async def audiences() -> list[dict[str, Any]]:
    return _runtime_data()["audiences"]


@app.get("/api/brand-guidelines")
async def brand_guidelines() -> list[dict[str, Any]]:
    return _brand_guidelines_data()


@app.get("/api/generation-models")
async def generation_models(content_type: str = "") -> list[dict[str, Any]]:
    return _model_options_for_content(content_type) if content_type else _generation_model_options_data()


@app.get("/api/audience-demographics")
async def audience_demographics() -> list[dict[str, Any]]:
    return _audience_demographic_signals_data()


@app.get("/api/purchase-signals")
async def purchase_signals() -> list[dict[str, Any]]:
    return _purchase_intent_signals_data()


@app.get("/api/evaluation-rubrics")
async def evaluation_rubrics() -> list[dict[str, Any]]:
    return _evaluation_rubrics_data()


@app.get("/api/evaluation-channel-matrix")
async def evaluation_channel_matrix() -> list[dict[str, Any]]:
    rows = _evaluation_channel_matrix_rows()
    source = "databricks_sql_derived" if USE_PIPELINE_DATA else "model_endpoint_demo_fallback"
    path = (
        f"{PIPELINE_CATALOG}.{PIPELINE_SCHEMA}.gold_buyside_synthetic_audience_eval + "
        f"{PIPELINE_CATALOG}.{PIPELINE_SCHEMA}.gold_buyside_creative_variant"
        if USE_PIPELINE_DATA
        else "in_memory"
    )
    DATA_LOAD_SOURCES["evaluation_channel_matrix"] = {
        "source": source,
        "path": path,
        "rows": len(rows),
        "loaded": True,
    }
    return rows


@app.get("/api/creatives")
async def creatives() -> list[dict[str, Any]]:
    return _runtime_data()["creatives"]


@app.get("/api/activations")
async def activations() -> list[dict[str, Any]]:
    persisted = _lakebase_rows("activations")
    return _dedupe_by_key([*persisted, *LIVE_ACTIVATION_SUBMISSIONS, *_runtime_data()["activations"]], "activation_id")


def _find_by_id(rows: list[dict[str, Any]], key: str, value: str) -> dict[str, Any] | None:
    if not value:
        return None
    return next((item for item in rows if _as_text(item.get(key)) == value), None)


def _find_asset_by_any_id(rows: list[dict[str, Any]], value: str) -> dict[str, Any] | None:
    if not value:
        return None
    return next((item for item in rows if value in _asset_related_ids(item)), None)


def _lineage_metadata(items: list[tuple[str, Any]]) -> dict[str, str]:
    return {label: _display_value(value) for label, value in items if _display_value(value)}


def _lineage_step(
    step_id: str,
    entity_type: str,
    entity_id: str,
    title: str,
    subtitle: str,
    status: str = "",
    metadata: dict[str, str] | None = None,
) -> dict[str, Any]:
    return {
        "id": step_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "title": title,
        "subtitle": subtitle,
        "status": status,
        "metadata": metadata or {},
    }


def _legacy_brief_for_creative(
    creative: dict[str, Any] | None,
    activation: dict[str, Any] | None,
    briefs: list[dict[str, Any]],
) -> dict[str, Any] | None:
    text = _normalized_token(
        " ".join(
            [
                _as_text((creative or {}).get("asset_name")),
                _as_text((creative or {}).get("target_segment")),
                _as_text((creative or {}).get("content_tags")),
                _as_text((activation or {}).get("campaign_id")),
            ]
        )
    )
    priorities = [
        ("family", "family"),
        ("churn", "winback"),
        ("lapsed", "winback"),
        ("sports", "sports"),
        ("loyal", "sports"),
        ("premium", "trial"),
        ("upgrade", "trial"),
    ]
    for token, brief_token in priorities:
        if token not in text:
            continue
        match = next(
            (
                brief
                for brief in briefs
                if brief_token
                in _normalized_token(
                    " ".join(
                        [
                            _as_text(brief.get("brief_name")),
                            _as_text(brief.get("campaign_objective")),
                            _as_text(brief.get("target_audience_description")),
                        ]
                    )
                )
            ),
            None,
        )
        if match:
            return match
    return briefs[0] if briefs else None


def _activation_lineage_payload(activation_id: str) -> dict[str, Any]:
    rows = _workflow_rows()
    activation = next(
        (
            item
            for item in rows["activations"]
            if activation_id
            in {
                _as_text(item.get("activation_id")),
                _as_text(item.get("export_id")),
                _as_text(item.get("destination_asset_id")),
            }
        ),
        None,
    )
    export = None
    if activation:
        export = _find_by_id(rows["activation_exports"], "export_id", _as_text(activation.get("export_id")))
    if export is None:
        export = _find_by_id(rows["activation_exports"], "export_id", activation_id)
    if activation is None and export:
        activation = next(
            (
                item
                for item in rows["activations"]
                if _as_text(item.get("export_id")) == _as_text(export.get("export_id"))
                or _as_text(item.get("creative_asset_id")) == _as_text(export.get("creative_asset_id"))
            ),
            None,
        )
    if activation is None and export is None:
        raise HTTPException(status_code=404, detail="Activation lineage not found")

    creative_id = _as_text((activation or {}).get("creative_asset_id") or (export or {}).get("creative_asset_id"))
    variant = _find_by_id(rows["variants"], "creative_asset_id", creative_id)
    creative = None if variant else _find_by_id(rows["creatives"], "creative_asset_id", creative_id)
    request_id = _as_text((variant or {}).get("request_id"))
    generation_request = _find_by_id(rows["generation_requests"], "request_id", request_id)
    brief_id = _as_text((generation_request or {}).get("brief_id") or (variant or {}).get("brief_id"))
    cohort_id = _as_text(
        (activation or {}).get("cohort_id")
        or (export or {}).get("cohort_id")
        or (generation_request or {}).get("cohort_id")
        or (variant or {}).get("cohort_id")
    )
    brief = _find_by_id(rows["briefs"], "brief_id", brief_id)
    if brief is None and creative:
        brief = _legacy_brief_for_creative(creative, activation, rows["briefs"])
        brief_id = _as_text((brief or {}).get("brief_id"))
    audience = _find_by_id(rows["audiences"], "cohort_id", cohort_id)
    if audience is None and creative:
        target_segment = _normalized_token(creative.get("target_segment"))
        audience = next(
            (
                item
                for item in rows["audiences"]
                if target_segment and target_segment in _normalized_token(item.get("cohort_name"))
            ),
            None,
        )
        cohort_id = _as_text((audience or {}).get("cohort_id"))

    request_asset_ids = _loads_json((generation_request or {}).get("selected_base_asset_ids_json"), [])
    if not isinstance(request_asset_ids, list):
        request_asset_ids = []
    reference_asset_id = _as_text(
        (variant or {}).get("reference_asset_id")
        or (variant or {}).get("source_asset_id")
        or (request_asset_ids[0] if request_asset_ids else "")
    )
    reference_asset = _find_asset_by_any_id(rows["base_assets"], reference_asset_id)
    brand_guideline = _brand_guideline_by_id(
        _as_text((variant or {}).get("brand_guideline_id") or (generation_request or {}).get("brand_guideline_id"))
    )
    brand_policy_rules = _loads_json((brand_guideline or {}).get("blocked_claims_json"), [])
    brand_policy_rule_count = len(brand_policy_rules) if isinstance(brand_policy_rules, list) else 0
    is_video_variant = _is_video_content(_as_text((variant or {}).get("content_type"))) or _as_text((variant or {}).get("format")).upper() == "MP4"
    is_video_source = (
        _is_video_content(_as_text((reference_asset or {}).get("asset_type")))
        or _as_text((reference_asset or {}).get("format")).upper() == "MP4"
        or "video" in _as_text((reference_asset or {}).get("asset_name")).lower()
    )
    source_preview_uri = f"/api/creative-assets/{reference_asset_id}/thumbnail" if reference_asset_id else ""
    source_video_preview_uri = f"/api/creative-assets/{reference_asset_id}/video-preview" if reference_asset_id and is_video_source else ""
    final_preview_uri = f"/api/creative-assets/{creative_id}/thumbnail" if creative_id else ""
    video_preview_uri = f"/api/creative-variants/{creative_id}/video-preview" if creative_id and is_video_variant else ""

    transformations = [
        item
        for item in rows["transformations"]
        if _as_text(item.get("creative_asset_id")) == creative_id
        or _as_text(item.get("output_asset_id")) == creative_id
        or _as_text(item.get("input_asset_id")) == creative_id
    ]
    lineage_generation_model = _as_text(
        (variant or {}).get("generation_model")
        or (generation_request or {}).get("generation_model_label")
        or (creative or {}).get("generation_model")
        or CREATIVE_MODEL_ENDPOINT,
        "N/A",
    )
    transformations = [
        {
            **item,
            "tool_or_model": item.get("tool_or_model") or lineage_generation_model,
            "generation_model": item.get("generation_model") or lineage_generation_model,
        }
        for item in transformations
    ]
    policy_checks = [item for item in rows["policy_checks"] if _as_text(item.get("creative_asset_id")) == creative_id]
    evaluations = [item for item in rows["evaluations"] if _as_text(item.get("creative_asset_id")) == creative_id]
    relevant_ids = {
        _as_text(item)
        for item in [
            activation_id,
            (activation or {}).get("activation_id"),
            (export or {}).get("export_id"),
            creative_id,
            request_id,
            brief_id,
            cohort_id,
            reference_asset_id,
        ]
        if _as_text(item)
    }
    lineage_edges = [
        item
        for item in _creative_workflow_data()["lineage_edges"]
        if _as_text(item.get("source_entity_id")) in relevant_ids
        or _as_text(item.get("target_entity_id")) in relevant_ids
    ]

    steps: list[dict[str, Any]] = []
    if activation:
        steps.append(
            _lineage_step(
                "activation",
                "activation",
                _as_text(activation.get("activation_id")),
                _as_text(activation.get("destination_platform"), "Activation"),
                "Submitted activation record",
                _as_text(activation.get("trafficking_status")),
                _lineage_metadata(
                    [
                        ("Creative", activation.get("creative_asset_id")),
                        ("Campaign", activation.get("campaign_id")),
                        ("Destination asset", activation.get("destination_asset_id")),
                        ("Last sync", activation.get("last_sync_ts")),
                    ]
                ),
            )
        )
    if export:
        steps.append(
            _lineage_step(
                "export",
                "activation_export",
                _as_text(export.get("export_id")),
                "Activation payload",
                _as_text(export.get("destination_system"), "Destination export"),
                _as_text(export.get("export_status")),
                _lineage_metadata(
                    [
                        ("Payload URI", export.get("payload_uri")),
                        ("Destination asset", export.get("destination_asset_id")),
                        ("Exported by", export.get("exported_by")),
                        ("Exported at", export.get("exported_ts")),
                    ]
                ),
            )
        )
    if variant:
        steps.append(
            _lineage_step(
                "variant",
                "creative_variant",
                creative_id,
                _as_text(variant.get("asset_name"), creative_id),
                "Approved creative variant",
                _as_text(variant.get("approval_status")),
                _lineage_metadata(
                    [
                        ("Placement", variant.get("placement")),
                        ("Content type", variant.get("content_type") or variant.get("asset_type")),
                        ("Generation model", variant.get("generation_model")),
                        ("Brand guideline", brand_guideline.get("profile_name")),
                        ("Reference asset", reference_asset_id),
                        ("Predicted CTR", variant.get("predicted_ctr")),
                    ]
                ),
            )
        )
    elif creative:
        steps.append(
            _lineage_step(
                "creative",
                "creative",
                creative_id,
                _as_text(creative.get("asset_name"), creative_id),
                "Activated creative asset",
                _as_text(creative.get("approval_status")),
                _lineage_metadata(
                    [
                        ("Asset type", creative.get("asset_type")),
                        ("Target segment", creative.get("target_segment")),
                        ("Generation model", creative.get("generation_model")),
                        ("Predicted CTR", creative.get("predicted_ctr")),
                    ]
                ),
            )
        )
    if generation_request:
        steps.append(
            _lineage_step(
                "request",
                "generation_request",
                request_id,
                "Generation request",
                _as_text(generation_request.get("campaign_objective"), "Prompt and retrieval request"),
                _as_text(generation_request.get("request_status")),
                _lineage_metadata(
                    [
                        ("Source mode", generation_request.get("source_mode")),
                        ("Retrieval source", generation_request.get("retrieval_source")),
                        ("Generation model", generation_request.get("generation_model_label")),
                        ("Brand guideline", brand_guideline.get("version")),
                        ("Requested variants", generation_request.get("requested_variant_count")),
                        ("Created", generation_request.get("created_ts")),
                    ]
                ),
            )
        )
    if brief:
        steps.append(
            _lineage_step(
                "brief",
                "brief",
                brief_id,
                _as_text(brief.get("brief_name"), brief_id),
                _as_text(brief.get("campaign_objective"), "Original campaign brief"),
                _as_text(brief.get("status")),
                _lineage_metadata(
                    [
                        ("Brand", brief.get("brand_name")),
                        ("Owner", brief.get("owner")),
                        ("Budget", brief.get("budget")),
                        ("Target audience", brief.get("target_audience_description")),
                    ]
                ),
            )
        )
    if audience:
        steps.append(
            _lineage_step(
                "audience",
                "audience",
                cohort_id,
                _as_text(audience.get("cohort_name"), cohort_id),
                _as_text(audience.get("cohort_description"), "C360 audience cohort"),
                _as_text(audience.get("status")),
                _lineage_metadata(
                    [
                        ("Reach", audience.get("estimated_reach")),
                        ("Match rate", audience.get("match_rate")),
                        ("LTV", audience.get("avg_ltv")),
                    ]
                ),
            )
        )
    if reference_asset:
        steps.append(
            _lineage_step(
                "source_asset",
                "source_asset",
                _as_text(reference_asset.get("asset_id"), reference_asset_id),
                _as_text(reference_asset.get("asset_name"), reference_asset_id),
                "Governed seed/source asset",
                _as_text(reference_asset.get("status")),
                _lineage_metadata(
                    [
                        ("Category", reference_asset.get("demo_category")),
                        ("Placement", reference_asset.get("placement")),
                        ("Rights profile", reference_asset.get("rights_profile_id")),
                        ("Brand safety", reference_asset.get("brand_safety_score")),
                    ]
                ),
            )
        )
    if brand_guideline:
        steps.append(
            _lineage_step(
                "brand_guideline",
                "brand_guideline",
                _as_text(brand_guideline.get("guideline_id")),
                _as_text(brand_guideline.get("profile_name"), "Brand guideline"),
                _as_text(brand_guideline.get("tone"), "Generated brand profile"),
                _as_text(brand_guideline.get("status")),
                _lineage_metadata(
                    [
                        ("Brand", brand_guideline.get("brand_name")),
                        ("Version", brand_guideline.get("version")),
                        ("Policy exclusions", f"{brand_policy_rule_count} configured rules" if brand_policy_rule_count else ""),
                    ]
                ),
            )
        )

    return {
        "activation_id": activation_id,
        "activation": activation,
        "export": export,
        "creative_variant": variant,
        "creative": creative,
        "generation_request": generation_request,
        "brief": brief,
        "audience": audience,
        "reference_asset": reference_asset,
        "brand_guideline": brand_guideline,
        "source_preview_uri": source_preview_uri,
        "source_video_preview_uri": source_video_preview_uri,
        "final_preview_uri": final_preview_uri,
        "video_preview_uri": video_preview_uri,
        "steps": steps,
        "evidence": [
            {"label": "Model", "value": _as_text((variant or {}).get("generation_model") or (generation_request or {}).get("generation_model_label"), "N/A")},
            {"label": "Guideline", "value": _as_text(brand_guideline.get("version"), "N/A")},
            {"label": "Transformations", "value": str(len(transformations))},
            {"label": "Policy checks", "value": str(len(policy_checks))},
            {"label": "Synthetic evaluations", "value": str(len(evaluations))},
            {"label": "Lineage edges", "value": str(len(lineage_edges))},
            {"label": "State backend", "value": "Lakebase" if _lakebase_init() else "Memory fallback"},
        ],
        "transformations": transformations,
        "policy_checks": policy_checks,
        "synthetic_evaluations": evaluations,
        "lineage_edges": lineage_edges,
    }


@app.get("/api/activations/{activation_id}/lineage")
async def activation_lineage(activation_id: str) -> dict[str, Any]:
    return _activation_lineage_payload(activation_id)


@app.get("/api/markets")
async def markets() -> list[dict[str, Any]]:
    return _runtime_data()["markets"]


@app.get("/api/audience-traits")
async def audience_traits() -> list[dict[str, Any]]:
    return _creative_workflow_data()["audience_traits"]


@app.get("/api/creative-assets/search")
async def creative_asset_search(
    q: str = "",
    placement: str = "",
    category: str = "",
    asset_type: str = "",
    limit: int = Query(default=100, ge=1, le=100),
) -> list[dict[str, Any]]:
    assets = _governed_retrieval_assets()
    query = q.strip().lower()
    placement_query = placement.strip().lower()
    category_query = category.strip().lower()
    filtered = []
    for asset in assets:
        search_text = " ".join(
            [
                _as_text(asset.get("asset_name")),
                _as_text(asset.get("description")),
                _as_text(asset.get("content_tags")),
                _as_text(asset.get("approved_usage_contexts_json")),
                _as_text(asset.get("demo_category")),
                _as_text(asset.get("category_slug")),
                _as_text(asset.get("placement")),
            ]
        ).lower()
        if query and query not in search_text:
            continue
        if placement_query:
            asset_placement = _as_text(asset.get("placement")).lower()
            if asset_placement and asset_placement != placement_query:
                continue
            if not asset_placement and placement_query not in search_text:
                continue
        if category_query and category_query not in search_text:
            continue
        if asset_type and asset_type.lower() != _as_text(asset.get("asset_type")).lower():
            continue
        filtered.append(asset)
    return filtered[:limit]


@app.get("/api/creative-assets/{asset_id}/video-preview")
async def creative_asset_video_preview(asset_id: str) -> Response:
    asset = next(
        (
            item
            for item in _governed_retrieval_assets()
            if item.get("asset_id") == asset_id or asset_id in _asset_related_ids(item)
        ),
        None,
    )
    if not asset or _as_text(asset.get("asset_type")).lower() != "video":
        raise HTTPException(status_code=404, detail="Approved video seed asset not found")
    mp4_uri = _as_text(asset.get("storage_uri"))
    filename = _video_seed_filename_from_uri(mp4_uri)
    if filename:
        content = _load_video_seed_content(filename)
        if content is not None:
            return Response(
                content=content,
                media_type="video/mp4",
                headers={
                    "Content-Disposition": f'inline; filename="{filename}"',
                    "X-Demo-Video-Preview": "approved-video-seed-file",
                },
            )
    if mp4_uri.startswith("/"):
        mp4_path = Path(mp4_uri)
        if mp4_path.exists():
            return FileResponse(mp4_path, media_type="video/mp4")
        volume_content = _download_volume_file(mp4_path)
        if volume_content is not None:
            return Response(
                content=volume_content,
                media_type="video/mp4",
                headers={"Content-Disposition": f'inline; filename="{asset_id}.mp4"'},
            )
    if DEMO_VIDEO_ASSET.exists():
        return FileResponse(
            DEMO_VIDEO_ASSET,
            media_type="video/mp4",
            headers={
                "Content-Disposition": f'inline; filename="{asset_id}.mp4"',
                "X-Demo-Video-Preview": "approved-video-seed-sample",
            },
        )
    return Response(
        content=_demo_mp4_bytes(),
        media_type="video/mp4",
        headers={
            "Content-Disposition": f'inline; filename="{asset_id}.mp4"',
            "X-Demo-Video-Preview": "approved-video-seed-embedded",
        },
    )


@app.get("/api/creative-assets/{asset_id}/thumbnail")
async def creative_asset_thumbnail(asset_id: str) -> Any:
    workflow = _creative_workflow_data()
    records = _lakebase_rows("creative_variants") + LIVE_CREATIVE_VARIANTS + _governed_retrieval_assets() + workflow["base_assets"] + workflow["variants"]
    record = next(
        (
            item
            for item in records
            if item.get("asset_id") == asset_id
            or item.get("creative_asset_id") == asset_id
            or asset_id in _asset_related_ids(item)
        ),
        None,
    )
    if record:
        if record.get("creative_asset_id") == asset_id:
            return Response(content=_polished_variant_svg(record), media_type="image/svg+xml")
        seed_image = _asset_image_content(asset_id)
        if seed_image is not None:
            content, media_type = seed_image
            if media_type != "image/svg+xml":
                return Response(content=content, media_type=media_type)
        if record.get("creative_asset_id") == asset_id and record.get("reference_asset_id"):
            reference_asset_id = _as_text(record.get("reference_asset_id") or record.get("source_asset_id") or record.get("parent_creative_asset_id"))
            reference_image = _asset_image_content(reference_asset_id)
            if reference_image is not None:
                content, media_type = reference_image
                return Response(content=content, media_type=media_type)
            return Response(content=_polished_variant_svg(record), media_type="image/svg+xml")
        if record.get("creative_asset_id") == asset_id:
            reference_asset_id = _as_text(record.get("reference_asset_id") or record.get("source_asset_id") or record.get("parent_creative_asset_id"))
            reference_image = _asset_image_content(reference_asset_id)
            if reference_image is not None:
                content, media_type = reference_image
                return Response(content=content, media_type=media_type)
        uri = _as_text(record.get("thumbnail_uri") or record.get("storage_uri"))
        image_path = Path(uri)
        if uri and image_path.exists():
            return FileResponse(image_path, media_type=_media_type_for_path(image_path))
        volume_content = _download_volume_file(image_path)
        if volume_content is not None:
            return Response(content=volume_content, media_type=_media_type_for_path(image_path))
        title = _as_text(record.get("asset_name"), asset_id)
        subtitle = _as_text(record.get("placement") or record.get("description"), "Synthetic governed creative")
        ratio = _as_text(record.get("aspect_ratio"), "16:9")
    else:
        title = asset_id
        subtitle = "Synthetic governed creative"
        ratio = "16:9"
    return Response(content=_synthetic_svg(title, subtitle, ratio), media_type="image/svg+xml")


@app.get("/api/creative-generation/requests")
async def creative_generation_requests() -> list[dict[str, Any]]:
    return _dedupe_by_key(
        [*_lakebase_rows("generation_requests"), *LIVE_GENERATION_REQUESTS, *_creative_workflow_data()["generation_requests"]],
        "request_id",
    )


@app.get("/api/creative-generation/requests/{request_id}")
async def creative_generation_request(request_id: str) -> dict[str, Any]:
    request = next(
        (
            item
            for item in _lakebase_rows("generation_requests") + LIVE_GENERATION_REQUESTS + _creative_workflow_data()["generation_requests"]
            if item.get("request_id") == request_id
        ),
        None,
    )
    if not request:
        raise HTTPException(status_code=404, detail="Generation request not found")
    return request


@app.get("/api/creative-generation/requests/{request_id}/variants")
async def creative_generation_request_variants(request_id: str) -> list[dict[str, Any]]:
    variants = _dedupe_by_key(
        [*_lakebase_rows("creative_variants"), *LIVE_CREATIVE_VARIANTS, *_creative_workflow_data()["variants"]],
        "creative_asset_id",
    )
    return [item for item in variants if item.get("request_id") == request_id]


@app.post("/api/creative-generation/requests")
async def create_creative_generation_request(payload: CreativeGenerationRequestIn) -> dict[str, Any]:
    if not payload.brief_id or not payload.cohort_id:
        raise HTTPException(status_code=400, detail="brief_id and cohort_id are required")
    is_video = _is_video_content(payload.content_type)
    count = max(1, min(payload.requested_variant_count, 4 if is_video else 5))
    request_id = f"REQ-LIVE-{int(time.time())}"
    generation_models = _resolve_generation_models(payload, is_video)
    primary_model = generation_models[0]
    model_labels = [_as_text(model.get("label"), model.get("model_id")) for model in generation_models]
    model_ids = [_as_text(model.get("model_id")) for model in generation_models]
    model_endpoint = _as_text(primary_model.get("endpoint_name"), CREATIVE_MODEL_ENDPOINT)
    brand_guideline = _brand_guideline_by_id(payload.brand_guideline_id)
    audience = next((item for item in _runtime_data()["audiences"] if item["cohort_id"] == payload.cohort_id), None)
    brief = next((item for item in _runtime_data()["briefs"] if item.get("brief_id") == payload.brief_id), None)
    cohort_name = audience["cohort_name"] if audience else payload.cohort_id
    reference_assets, retrieval = _retrieve_generation_reference_assets(payload, cohort_name, limit=max(count, 4))
    if not reference_assets:
        reference_assets = _governed_retrieval_assets()[:1]
    base_asset_ids = [_as_text(asset.get("asset_id"), "BASE-0001") for asset in reference_assets] or ["BASE-0001"]
    created_ts = time.strftime("%Y-%m-%d %H:%M:%S")
    model_invocations = {}
    for model in generation_models:
        endpoint = _as_text(model.get("endpoint_name"), CREATIVE_MODEL_ENDPOINT)
        model_invocations[_as_text(model.get("model_id"))] = _invoke_model_endpoint(
            endpoint,
            "creative_generation",
            "You generate polished, brand-safe image and video variants from retrieved governed seed references for a streaming media campaign. Keep each output visually appealing: one focal message, one tasteful accent treatment, generous spacing, readable copy, and no cluttered UI labels or dashboard-like overlays.",
            json.dumps(
                {
                    "brief_id": payload.brief_id,
                    "cohort_id": payload.cohort_id,
                    "placement": payload.placement,
                    "selected_category": payload.category,
                    "content_type": payload.content_type,
                    "brand_guideline": brand_guideline,
                    "generation_model": model,
                    "generation_model_ids": model_ids,
                    "end_card_text": payload.end_card_text,
                    "cta_text": payload.cta_text,
                    "retrieval_source": retrieval["source"],
                    "retrieval_query": retrieval["query"],
                    "reference_assets": [
                        {
                            "asset_id": asset.get("asset_id"),
                            "asset_name": asset.get("asset_name"),
                            "demo_category": asset.get("demo_category"),
                            "category_slug": asset.get("category_slug"),
                            "placement": asset.get("placement"),
                            "thumbnail_uri": asset.get("thumbnail_uri"),
                            "description": asset.get("description"),
                            "vector_asset_id": asset.get("vector_asset_id"),
                            "vector_score": asset.get("vector_score"),
                        }
                        for asset in reference_assets
                    ],
                    "instructions": payload.user_instructions or "Generate polished segment-ready creative variants with clean composition and one distinct visual treatment per variant.",
                    "requested_variant_count": count,
                }
            ),
        )
    request = {
        "request_id": request_id,
        "brief_id": payload.brief_id,
        "cohort_id": payload.cohort_id,
        "placement": payload.placement,
        "campaign_objective": "Databricks model endpoint request",
        "content_type": payload.content_type,
        "brand_guideline_id": brand_guideline["guideline_id"],
        "brand_guideline_version": brand_guideline["version"],
        "generation_model_id": ",".join(model_ids),
        "generation_model_label": " + ".join(model_labels),
        "image_model_id": payload.image_model_id or next((model["model_id"] for model in generation_models if model.get("modality") == "image"), primary_model["model_id"]),
        "compare_model_ids_json": json.dumps(model_ids[1:]),
        "end_card_text": payload.end_card_text,
        "cta_text": payload.cta_text,
        "source_mode": "vector_search_rag_video_seed_generate" if is_video else "vector_search_rag_seed_image_generate",
        "selected_base_asset_ids_json": json.dumps(base_asset_ids),
        "user_instructions": payload.user_instructions or "Generate polished segment-ready creative variants with clean composition and one distinct visual treatment per variant.",
        "system_prompt": f"Multi-model fan-out ({' + '.join(model_labels)}) generates safe, polished {'video' if is_video else 'image'} variants from retrieved governed seed assets under {brand_guideline['profile_name']}; each variant uses a distinct but restrained visual treatment.",
        "negative_prompt": "No real people, copyrighted characters, false claims, or unapproved regions.",
        "requested_variant_count": count,
        "requested_by": "app_user",
        "request_status": "completed",
        "created_ts": created_ts,
        "completed_ts": created_ts,
        "retrieval_query": retrieval["query"],
        "retrieval_source": retrieval["source"],
    }
    spec = _placement_spec(payload.placement)
    variants = []
    transformations = []
    for index in range(count):
        creative_asset_id = f"VAR-LIVE-{int(time.time())}-{index + 1}"
        variant_model = generation_models[index % len(generation_models)]
        variant_model_id = _as_text(variant_model.get("model_id"), primary_model["model_id"])
        variant_model_label = _as_text(variant_model.get("label"), variant_model_id)
        variant_model_endpoint = _as_text(variant_model.get("endpoint_name"), CREATIVE_MODEL_ENDPOINT)
        variant_model_invocation = model_invocations.get(variant_model_id, {})
        reference_asset = reference_assets[index % len(reference_assets)]
        reference_asset_id = _as_text(reference_asset.get("asset_id"), base_asset_ids[0])
        video_category = _as_text(reference_asset.get("demo_category") or payload.category or cohort_name)
        video_headline, video_cta = _video_copy_for_variant(
            payload.end_card_text or "Live games. One streaming home.",
            payload.cta_text or "Start watching",
            index + 1,
        )
        video_treatment = _video_treatment_for(video_category, payload.placement, index + 1)
        visual_treatment = _creative_visual_treatment_for(
            brief,
            audience,
            video_category,
            payload.placement,
            index + 1,
        )
        edit_steps = _edit_steps_for_placement(
            payload.placement,
            index + 1,
            source_width=_as_int_value(reference_asset.get("width_px"), spec["width_px"]),
            source_height=_as_int_value(reference_asset.get("height_px"), spec["height_px"]),
            source_aspect_ratio=_as_text(reference_asset.get("aspect_ratio"), spec["aspect_ratio"]),
        )
        if is_video:
            for edit_type, goal in [
                ("video_end_card_overlay", "Generate a final MP4 end card with readable headline and brand-safe image treatment."),
                ("cta_overlay", "Place the CTA inside the final-frame safe area."),
            ]:
                edit_steps.append(
                    {
                        "edit_sequence": len(edit_steps) + 1,
                        "transformation_type": edit_type,
                        "edit_label": EDIT_OPERATION_LABELS[edit_type],
                        "edit_goal": goal,
                        "parameters": {
                            "placement": payload.placement,
                            "source_width_px": _as_int_value(reference_asset.get("width_px"), spec["width_px"]),
                            "source_height_px": _as_int_value(reference_asset.get("height_px"), spec["height_px"]),
                            "source_aspect_ratio": _as_text(reference_asset.get("aspect_ratio"), spec["aspect_ratio"]),
                            "output_width_px": spec["width_px"],
                            "output_height_px": spec["height_px"],
                            "output_aspect_ratio": spec["aspect_ratio"],
                            "safe_area": spec["safe_area"],
                            "channels": spec["channels"],
                            "end_card_text": video_headline,
                            "cta_text": video_cta,
                            "video_treatment": video_treatment,
                            "visual_treatment": visual_treatment,
                        },
                    }
                )
        for step in edit_steps:
            parameters = step["parameters"]
            transformations.append(
                {
                    "transformation_id": f"XFORM-LIVE-{int(time.time())}-{index + 1}-{step['edit_sequence']}",
                    "creative_asset_id": creative_asset_id,
                    "input_asset_id": reference_asset_id,
                    "output_asset_id": creative_asset_id,
                    "transformation_type": step["transformation_type"],
                    "edit_sequence": step["edit_sequence"],
                    "edit_label": step["edit_label"],
                    "edit_goal": step["edit_goal"],
                    "placement": payload.placement,
                    "source_width_px": parameters["source_width_px"],
                    "source_height_px": parameters["source_height_px"],
                    "source_aspect_ratio": parameters["source_aspect_ratio"],
                    "output_width_px": parameters["output_width_px"],
                    "output_height_px": parameters["output_height_px"],
                    "output_aspect_ratio": parameters["output_aspect_ratio"],
                    "tool_or_model": variant_model_endpoint,
                    "parameters_json": json.dumps(parameters),
                    "edit_status": "completed",
                    "performed_by": "app_user",
                    "created_ts": request["created_ts"],
                }
            )
        variants.append(
            {
                "creative_asset_id": creative_asset_id,
                "request_id": request_id,
                "brief_id": payload.brief_id,
                "cohort_id": payload.cohort_id,
                "source_asset_id": reference_asset_id,
                "parent_creative_asset_id": reference_asset_id,
                "reference_asset_id": reference_asset_id,
                "reference_asset_name": _as_text(reference_asset.get("asset_name"), reference_asset_id),
                "reference_thumbnail_uri": _as_text(reference_asset.get("thumbnail_uri") or reference_asset.get("storage_uri")),
                "reference_demo_category": _as_text(reference_asset.get("demo_category") or payload.category),
                "variant_number": index + 1,
                "asset_name": (
                    f"{video_category} {visual_treatment['name']} Variant {index + 1}"
                    if is_video
                    else f"{_as_text(reference_asset.get('demo_category'), cohort_name)} {visual_treatment['name']} Variant {index + 1}"
                ),
                "asset_type": "Video" if is_video else "Image",
                "content_type": "video_endcard" if is_video else payload.content_type,
                "placement": payload.placement,
                "format": "MP4" if is_video else "SVG",
                "width_px": spec["width_px"],
                "height_px": spec["height_px"],
                "duration_sec": VIDEO_SEED_SAMPLE_DURATION_SECONDS if is_video else 0,
                "aspect_ratio": spec["aspect_ratio"],
                "storage_uri": (
                    f"demo-mp4://{creative_asset_id}.mp4"
                    if is_video
                    else f"rag-vector-search://{CREATIVE_VECTOR_SEARCH_INDEX}/{creative_asset_id}"
                ),
                "thumbnail_uri": f"rag-reference://{reference_asset_id}/{creative_asset_id}.svg",
                "video_preview_uri": f"/api/creative-variants/{creative_asset_id}/video-preview" if is_video else "",
                "mp4_storage_uri": f"demo-mp4://{creative_asset_id}.mp4" if is_video else "",
                "video_source_asset_id": payload.video_source_asset_id or reference_asset_id,
                "end_card_text": video_headline if is_video else payload.end_card_text,
                "cta_text": video_cta if is_video else payload.cta_text,
                "generation_prompt": request["user_instructions"],
                "generation_model": variant_model_label,
                "generation_model_id": variant_model_id,
                "brand_guideline_id": brand_guideline["guideline_id"],
                "generation_params_json": json.dumps(
                    {
                        "mode": CREATIVE_GENERATION_MODE,
                        "model_endpoint": variant_model_endpoint,
                        "model_id": variant_model_id,
                        "model_label": variant_model_label,
                        "generation_model_ids": model_ids,
                        "generation_model_labels": model_labels,
                        "brand_guideline_id": brand_guideline["guideline_id"],
                        "brand_guideline_version": brand_guideline["version"],
                        "model_invocation_status": variant_model_invocation.get("status", "not_invoked"),
                        "model_response_summary": variant_model_invocation.get("response_text", ""),
                        "retrieval_source": retrieval["source"],
                        "retrieval_query": retrieval["query"],
                        "vector_search_index": CREATIVE_VECTOR_SEARCH_INDEX,
                        "vector_asset_id": reference_asset.get("vector_asset_id"),
                        "vector_score": reference_asset.get("vector_score"),
                        "reference_asset_id": reference_asset_id,
                        "reference_asset_name": reference_asset.get("asset_name"),
                        "reference_demo_category": reference_asset.get("demo_category"),
                        "reference_thumbnail_uri": reference_asset.get("thumbnail_uri"),
                        "variant": index + 1,
                        "applied_edit_types": [step["transformation_type"] for step in edit_steps],
                        "video_preview_uri": f"/api/creative-variants/{creative_asset_id}/video-preview" if is_video else "",
                        "end_card_text": video_headline if is_video else payload.end_card_text,
                        "cta_text": video_cta if is_video else payload.cta_text,
                        "video_treatment": video_treatment if is_video else {},
                        "visual_treatment": visual_treatment,
                    }
                ),
                "adaptation_summary": (
                    f"Generated 15s MP4 end card with {visual_treatment['element_primary']} and {video_treatment['name']} treatment from approved video seed {_as_text(reference_asset.get('asset_name'), reference_asset_id)}."
                    if is_video
                    else f"Generated {visual_treatment['element_primary']} for {visual_treatment['audience_name']} from RAG seed reference {_as_text(reference_asset.get('asset_name'), reference_asset_id)}. {_adaptation_summary(edit_steps, payload.placement)}"
                ),
                "approval_status": "Pending_Review",
                "approved_by": "",
                "approved_ts": None,
                "created_ts": request["created_ts"],
                "updated_ts": request["created_ts"],
                "quality_score": 82 + index * 4,
                "predicted_ctr": round(1.02 + index * 0.12, 2),
                "target_segment": cohort_name,
                "content_tags": f"rag_seed_reference,{payload.placement},{_as_text(reference_asset.get('category_slug'), payload.category)},live_request,{visual_treatment['treatment_id']},{video_treatment['treatment_id'] if is_video else 'image'}",
            }
        )
    _lakebase_persist_rows("generation_requests", [request], "generation_request_created")
    _lakebase_persist_rows("creative_variants", variants, "creative_variant_generated")
    _lakebase_persist_rows("creative_transformations", transformations, "creative_transformation_created")
    LIVE_GENERATION_REQUESTS.insert(0, request)
    del LIVE_GENERATION_REQUESTS[30:]
    LIVE_CREATIVE_VARIANTS[:0] = variants
    del LIVE_CREATIVE_VARIANTS[60:]
    LIVE_CREATIVE_TRANSFORMATIONS[:0] = transformations
    del LIVE_CREATIVE_TRANSFORMATIONS[240:]
    return {
        "request": request,
        "variants": variants,
        "transformations": transformations,
        "mode": CREATIVE_GENERATION_MODE,
        "brand_guideline": brand_guideline,
        "generation_model": primary_model,
        "generation_models": generation_models,
        "model_invocations": model_invocations,
        "retrieval": {
            **retrieval,
            "reference_assets": [
                {
                    "asset_id": asset.get("asset_id"),
                    "asset_name": asset.get("asset_name"),
                    "demo_category": asset.get("demo_category"),
                    "thumbnail_uri": asset.get("thumbnail_uri"),
                    "vector_asset_id": asset.get("vector_asset_id"),
                    "vector_score": asset.get("vector_score"),
                }
                for asset in reference_assets
            ],
        },
    }


@app.get("/api/creative-variants")
async def creative_variants(
    request_id: str = "",
    cohort_id: str = "",
    placement: str = "",
) -> list[dict[str, Any]]:
    variants = _dedupe_by_key(
        [*_lakebase_rows("creative_variants"), *LIVE_CREATIVE_VARIANTS, *_creative_workflow_data()["variants"]],
        "creative_asset_id",
    )
    if request_id:
        variants = [item for item in variants if item.get("request_id") == request_id]
    if cohort_id:
        variants = [item for item in variants if item.get("cohort_id") == cohort_id]
    if placement:
        variants = [item for item in variants if item.get("placement") == placement]
    return variants


@app.get("/api/creative-variants/{creative_asset_id}/video-preview")
async def creative_variant_video_preview(creative_asset_id: str) -> Response:
    variants = _dedupe_by_key(
        [*_lakebase_rows("creative_variants"), *LIVE_CREATIVE_VARIANTS, *_creative_workflow_data()["variants"]],
        "creative_asset_id",
    )
    variant = next((item for item in variants if item.get("creative_asset_id") == creative_asset_id), None)
    if not variant:
        raise HTTPException(status_code=404, detail="Creative variant not found")
    mp4_uri = _as_text(variant.get("mp4_storage_uri") or variant.get("storage_uri"))
    filename = _video_seed_filename_for_variant(variant)
    if filename:
        content = _load_video_seed_content(filename)
        if content is not None:
            return Response(
                content=content,
                media_type="video/mp4",
                headers={
                    "Content-Disposition": f'inline; filename="{filename}"',
                    "X-Demo-Video-Preview": "generated-video-seed-file",
                },
            )
    if mp4_uri.startswith("/"):
        mp4_path = Path(mp4_uri)
        if mp4_path.exists():
            return FileResponse(mp4_path, media_type="video/mp4")
        volume_content = _download_volume_file(mp4_path)
        if volume_content is not None:
            return Response(
                content=volume_content,
                media_type="video/mp4",
                headers={"Content-Disposition": f'inline; filename="{creative_asset_id}.mp4"'},
            )
    if DEMO_VIDEO_ASSET.exists():
        return FileResponse(
            DEMO_VIDEO_ASSET,
            media_type="video/mp4",
            headers={
                "Content-Disposition": f'inline; filename="{creative_asset_id}.mp4"',
                "X-Demo-Video-Preview": "sample-mp4-asset",
            },
        )
    return Response(
        content=_demo_mp4_bytes(),
        media_type="video/mp4",
        headers={
            "Content-Disposition": f'inline; filename="{creative_asset_id}.mp4"',
            "X-Demo-Video-Preview": "mp4-container-fallback",
        },
    )


@app.post("/api/creative-variants/{creative_asset_id}/approval")
async def approve_creative_variant(creative_asset_id: str, payload: CreativeApprovalRequest) -> dict[str, Any]:
    decision = payload.decision.strip()
    if decision not in {"Approved", "Rejected", "Pending_Review"}:
        raise HTTPException(status_code=400, detail="decision must be Approved, Rejected, or Pending_Review")

    workflow = _creative_workflow_data()
    variants = _dedupe_by_key(
        [*LIVE_CREATIVE_VARIANTS, *_lakebase_rows("creative_variants"), *workflow["variants"]],
        "creative_asset_id",
    )
    variant = next((item for item in variants if item.get("creative_asset_id") == creative_asset_id), None)
    if not variant:
        snapshot = payload.variant_snapshot or {}
        if snapshot.get("creative_asset_id") == creative_asset_id:
            variant = snapshot
        else:
            raise HTTPException(status_code=404, detail="Creative variant not found")

    policy_checks = [item for item in workflow["policy_checks"] if item.get("creative_asset_id") == creative_asset_id]
    blocking_checks = [
        item
        for item in policy_checks
        if _as_text(item.get("check_status")).lower() in {"fail", "failed", "block", "blocked"}
    ]
    if decision == "Approved" and blocking_checks:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Creative has blocking policy checks and cannot be approved.",
                "blocking_check_ids": [item.get("check_id") for item in blocking_checks],
            },
        )

    all_evaluations = _dedupe_by_key(
        [*_lakebase_rows("synthetic_evaluations"), *workflow["synthetic_evaluations"]],
        "evaluation_id",
    )
    evaluations = [item for item in all_evaluations if item.get("creative_asset_id") == creative_asset_id]
    selected_evaluation = None
    generated_evaluation = False
    if payload.evaluation_id:
        selected_evaluation = next((item for item in evaluations if item.get("evaluation_id") == payload.evaluation_id), None)
        if decision == "Approved" and not selected_evaluation:
            raise HTTPException(status_code=409, detail="Requested evaluation row was not found for this creative.")
    elif evaluations:
        selected_evaluation = max(evaluations, key=lambda item: _as_float_value(item.get("overall_score"), 0.0))

    approved_ts = time.strftime("%Y-%m-%d %H:%M:%S") if decision == "Approved" else None
    updated_variant = {
        **variant,
        "approval_status": decision,
        "approved_by": payload.reviewer if decision == "Approved" else "",
        "approved_ts": approved_ts,
        "updated_ts": approved_ts or time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    asset_materialization = {
        "status": "not_requested" if decision != "Approved" else "not_started",
        "target_uri": "",
        "source_uri": "",
        "media_type": "",
        "bytes": 0,
        "error": "",
    }
    if decision == "Approved":
        materialization_updates, asset_materialization = _materialize_approved_variant_asset(
            updated_variant,
            approved_ts or time.strftime("%Y-%m-%d %H:%M:%S"),
        )
        updated_variant = {**updated_variant, **materialization_updates}
    uc_external_lineage = {
        "enabled": UC_EXTERNAL_LINEAGE_ENABLED,
        "status": "not_requested" if decision != "Approved" else "not_started",
        "metadata_name": "",
        "relationships": [],
    }
    if decision == "Approved":
        lineage_updates, uc_external_lineage = _publish_uc_external_lineage_for_variant(
            updated_variant,
            asset_materialization,
        )
        updated_variant = {**updated_variant, **lineage_updates}

    if decision == "Approved" and not selected_evaluation:
        selected_evaluation = _approval_gate_evaluation_for_variant(
            updated_variant,
            all_evaluations,
            approved_ts or time.strftime("%Y-%m-%d %H:%M:%S"),
        )
        generated_evaluation = True

    if decision == "Approved" and payload.require_evaluation and not selected_evaluation:
        raise HTTPException(status_code=409, detail="Synthetic evaluation is required before approval.")

    live_updated = False
    for index, item in enumerate(LIVE_CREATIVE_VARIANTS):
        if item.get("creative_asset_id") == creative_asset_id:
            LIVE_CREATIVE_VARIANTS[index] = updated_variant
            live_updated = True
            break
    if not live_updated:
        LIVE_CREATIVE_VARIANTS.insert(0, updated_variant)
        del LIVE_CREATIVE_VARIANTS[60:]
    variant_lakebase_persisted = _lakebase_persist_rows("creative_variants", [updated_variant], "creative_variant_approval_updated")
    evaluation_lakebase_persisted = False
    channel_matrix = None
    if decision == "Approved" and selected_evaluation:
        # Add evaluation to in-memory list for immediate availability
        existing_eval_idx = next(
            (i for i, e in enumerate(LIVE_SYNTHETIC_EVALUATIONS) if e.get("evaluation_id") == selected_evaluation.get("evaluation_id")),
            None,
        )
        if existing_eval_idx is not None:
            LIVE_SYNTHETIC_EVALUATIONS[existing_eval_idx] = selected_evaluation
        else:
            LIVE_SYNTHETIC_EVALUATIONS.insert(0, selected_evaluation)
            del LIVE_SYNTHETIC_EVALUATIONS[100:]
        evaluation_lakebase_persisted = _lakebase_persist_rows(
            "synthetic_evaluations",
            [selected_evaluation],
            "synthetic_evaluation_approval_gate_created" if generated_evaluation else "synthetic_evaluation_approval_gate_attached",
        )
        matrix_rows = _evaluation_channel_matrix_rows(
            {
                "variants": [updated_variant],
                "evaluations": [selected_evaluation],
                "evaluation_rubrics": _evaluation_rubrics_data(),
            }
        )
        channel_matrix = matrix_rows[0] if matrix_rows else None

    persisted = False
    persistence_error = ""
    if USE_PIPELINE_DATA:
        try:
            approved_by_expr = _sql_literal(payload.reviewer) if decision == "Approved" else "''"
            approved_ts_expr = "current_timestamp()" if decision == "Approved" else "NULL"
            storage_uri_expr = _sql_literal(updated_variant.get("storage_uri", ""))
            thumbnail_uri_expr = _sql_literal(updated_variant.get("thumbnail_uri", ""))
            format_expr = _sql_literal(updated_variant.get("format", ""))
            _execute_sql(
                f"""
                UPDATE {_pipeline_table("gold_buyside_creative_variant")}
                SET approval_status = {_sql_literal(decision)},
                    approved_by = {approved_by_expr},
                    approved_ts = {approved_ts_expr},
                    storage_uri = {storage_uri_expr},
                    thumbnail_uri = {thumbnail_uri_expr},
                    format = {format_expr},
                    updated_ts = current_timestamp()
                WHERE creative_asset_id = {_sql_literal(creative_asset_id)}
                """,
                row_limit=1,
            )
            _creative_workflow_data.cache_clear()
            persisted = True
        except Exception as exc:
            persistence_error = str(exc)

    return {
        "variant": updated_variant,
        "approval": {
            "creative_asset_id": creative_asset_id,
            "decision": decision,
            "reviewer": payload.reviewer,
            "review_notes": payload.review_notes,
            "evaluation_id": selected_evaluation.get("evaluation_id") if selected_evaluation else None,
            "policy_check_ids": [item.get("check_id") for item in policy_checks],
            "warnings": [item.get("check_id") for item in policy_checks if _as_text(item.get("check_status")).lower() == "warn"],
            "approved_ts": approved_ts,
            "persisted": persisted,
            "app_state_persisted": variant_lakebase_persisted,
            "evaluation": selected_evaluation,
            "evaluation_generated": generated_evaluation,
            "evaluation_persisted": evaluation_lakebase_persisted,
            "channel_matrix": channel_matrix,
            "persistence_error": persistence_error,
            "asset_materialization": asset_materialization,
            "uc_external_lineage": uc_external_lineage,
        },
        "mode": CREATIVE_GENERATION_MODE,
    }


@app.post("/api/creative-variants/{creative_asset_id}/uc-external-lineage")
async def publish_creative_variant_uc_external_lineage(creative_asset_id: str) -> dict[str, Any]:
    variants = _dedupe_by_key(
        [*_lakebase_rows("creative_variants"), *LIVE_CREATIVE_VARIANTS, *_creative_workflow_data()["variants"]],
        "creative_asset_id",
    )
    variant = next((item for item in variants if item.get("creative_asset_id") == creative_asset_id), None)
    if not variant:
        raise HTTPException(status_code=404, detail="Creative variant not found")

    target_uri = _as_text(variant.get("approved_asset_uri") or variant.get("storage_uri"))
    materialization = {
        "status": "existing_asset",
        "target_uri": target_uri,
        "source_uri": _as_text(variant.get("reference_thumbnail_uri") or variant.get("source_asset_id")),
        "media_type": _as_text(variant.get("approved_asset_media_type")),
        "bytes": _as_int_value(variant.get("approved_asset_bytes")),
        "error": "",
    }
    lineage_updates, uc_external_lineage = _publish_uc_external_lineage_for_variant(variant, materialization)
    updated_variant = {**variant, **lineage_updates}
    if lineage_updates:
        for index, item in enumerate(LIVE_CREATIVE_VARIANTS):
            if item.get("creative_asset_id") == creative_asset_id:
                LIVE_CREATIVE_VARIANTS[index] = updated_variant
                break
        _lakebase_persist_rows("creative_variants", [updated_variant], "creative_variant_uc_external_lineage_published")
    return {
        "variant": updated_variant,
        "uc_external_lineage": uc_external_lineage,
    }


@app.post("/api/creative-variants/{creative_asset_id}/adapt")
async def adapt_creative_variant(creative_asset_id: str, payload: CreativeAdaptRequest) -> dict[str, Any]:
    variant = next(
        (
            item
            for item in _lakebase_rows("creative_variants") + LIVE_CREATIVE_VARIANTS + _creative_workflow_data()["variants"]
            if item.get("creative_asset_id") == creative_asset_id
        ),
        None,
    )
    if not variant:
        raise HTTPException(status_code=404, detail="Creative variant not found")
    spec = _placement_spec(payload.placement)
    edit_types = payload.edit_types or [payload.transformation_type]
    edit_steps = _edit_steps_for_placement(
        payload.placement,
        int(variant.get("variant_number", 1) or 1),
        edit_types=edit_types,
        source_width=int(variant.get("width_px", 1280) or 1280),
        source_height=int(variant.get("height_px", 720) or 720),
        source_aspect_ratio=_as_text(variant.get("aspect_ratio"), "16:9"),
    )
    adapted_id = f"{creative_asset_id}-ADAPT-{payload.placement}"
    created_ts = time.strftime("%Y-%m-%d %H:%M:%S")
    model_invocation = _invoke_model_endpoint(
        CREATIVE_MODEL_ENDPOINT,
        "creative_adaptation",
        "You are a creative adaptation assistant that rewrites image edit instructions for placement-safe outputs.",
        json.dumps(
            {
                "creative_asset_id": creative_asset_id,
                "target_placement": payload.placement,
                "edit_types": [step["transformation_type"] for step in edit_steps],
                "output_format": payload.output_format,
                "source_width_px": variant.get("width_px"),
                "source_height_px": variant.get("height_px"),
                "source_aspect_ratio": variant.get("aspect_ratio"),
            }
        ),
    )
    generation_params = _loads_json(variant.get("generation_params_json"), {})
    adapted = {
        **variant,
        "creative_asset_id": adapted_id,
        "parent_creative_asset_id": creative_asset_id,
        "placement": payload.placement,
        "format": payload.output_format.upper(),
        "width_px": spec["width_px"],
        "height_px": spec["height_px"],
        "aspect_ratio": spec["aspect_ratio"],
        "storage_uri": f"rag-vector-search://{CREATIVE_VECTOR_SEARCH_INDEX}/{adapted_id}",
        "thumbnail_uri": f"rag-reference://{_as_text(variant.get('reference_asset_id') or variant.get('source_asset_id'))}/{adapted_id}.svg",
        "generation_model": CREATIVE_MODEL_ENDPOINT,
        "generation_params_json": json.dumps(
            {
                **generation_params,
                "mode": CREATIVE_GENERATION_MODE,
                "model_endpoint": CREATIVE_MODEL_ENDPOINT,
                "adaptation_invocation_status": model_invocation["status"],
                "adaptation_response_summary": model_invocation.get("response_text", ""),
                "applied_edit_types": [step["transformation_type"] for step in edit_steps],
            }
        ),
        "adaptation_summary": _adaptation_summary(edit_steps, payload.placement),
        "approval_status": "Pending_Review",
        "updated_ts": created_ts,
        "content_tags": f"{_as_text(variant.get('content_tags'))},adapted,{payload.placement}",
    }
    transformations = []
    for step in edit_steps:
        parameters = step["parameters"]
        transformations.append(
            {
                "transformation_id": f"XFORM-LIVE-{int(time.time())}-{step['edit_sequence']}",
                "creative_asset_id": adapted_id,
                "input_asset_id": creative_asset_id,
                "output_asset_id": adapted_id,
                "transformation_type": step["transformation_type"],
                "edit_sequence": step["edit_sequence"],
                "edit_label": step["edit_label"],
                "edit_goal": step["edit_goal"],
                "placement": payload.placement,
                "source_width_px": parameters["source_width_px"],
                "source_height_px": parameters["source_height_px"],
                "source_aspect_ratio": parameters["source_aspect_ratio"],
                "output_width_px": parameters["output_width_px"],
                "output_height_px": parameters["output_height_px"],
                "output_aspect_ratio": parameters["output_aspect_ratio"],
                "tool_or_model": CREATIVE_MODEL_ENDPOINT,
                "parameters_json": json.dumps(parameters),
                "edit_status": "completed",
                "performed_by": "app_user",
                "created_ts": created_ts,
            }
        )
    _lakebase_persist_rows("creative_variants", [adapted], "creative_variant_adapted")
    _lakebase_persist_rows("creative_transformations", transformations, "creative_transformation_created")
    LIVE_CREATIVE_VARIANTS.insert(0, adapted)
    del LIVE_CREATIVE_VARIANTS[60:]
    LIVE_CREATIVE_TRANSFORMATIONS[:0] = transformations
    del LIVE_CREATIVE_TRANSFORMATIONS[240:]
    return {
        "variant": adapted,
        "transformations": transformations,
        "mode": CREATIVE_GENERATION_MODE,
        "model_invocation": model_invocation,
    }


@app.get("/api/creative-variants/{creative_asset_id}/lineage")
async def creative_variant_lineage(creative_asset_id: str) -> list[dict[str, Any]]:
    variant = next(
        (
            item
            for item in _lakebase_rows("creative_variants") + LIVE_CREATIVE_VARIANTS + _creative_workflow_data()["variants"]
            if item.get("creative_asset_id") == creative_asset_id
        ),
        None,
    )
    request_id = _as_text(variant.get("request_id")) if variant else ""
    return [
        item
        for item in _creative_workflow_data()["lineage_edges"]
        if item.get("target_entity_id") in {creative_asset_id, request_id} or item.get("source_entity_id") in {creative_asset_id, request_id}
    ]


@app.get("/api/creative-lineage-edges")
async def creative_lineage_edges() -> list[dict[str, Any]]:
    return _creative_workflow_data()["lineage_edges"]


@app.get("/api/creative-transformations")
async def creative_transformations(
    creative_asset_id: str = "",
    placement: str = "",
    transformation_type: str = "",
) -> list[dict[str, Any]]:
    rows = _dedupe_by_key(
        [*_lakebase_rows("creative_transformations"), *LIVE_CREATIVE_TRANSFORMATIONS, *_creative_workflow_data()["creative_transformations"]],
        "transformation_id",
    )
    if creative_asset_id:
        rows = [
            item
            for item in rows
            if item.get("creative_asset_id") == creative_asset_id
            or item.get("input_asset_id") == creative_asset_id
            or item.get("output_asset_id") == creative_asset_id
        ]
    if placement:
        rows = [item for item in rows if item.get("placement") == placement]
    if transformation_type:
        rows = [item for item in rows if item.get("transformation_type") == transformation_type]
    return rows


@app.get("/api/policy-checks")
async def policy_checks(creative_asset_id: str = "") -> list[dict[str, Any]]:
    rows = _dedupe_by_key(
        [*_lakebase_rows("policy_checks"), *_creative_workflow_data()["policy_checks"]],
        "check_id",
    )
    if creative_asset_id:
        rows = [item for item in rows if item.get("creative_asset_id") == creative_asset_id]
    return rows


@app.post("/api/creative-variants/{creative_asset_id}/policy-checks/run")
async def run_policy_checks(creative_asset_id: str) -> dict[str, Any]:
    model_invocation = _invoke_model_endpoint(
        CREATIVE_POLICY_MODEL_ENDPOINT,
        "creative_policy_review",
        "You evaluate creative assets against brand, rights, regional usage, and safety policies.",
        json.dumps({"creative_asset_id": creative_asset_id, "policy_version": "2026.05-demo"}),
        max_tokens=500,
    )
    checks = [item for item in _demo_policy_checks() if item.get("creative_asset_id") == creative_asset_id]
    if not checks:
        checks = [
            {
                "check_id": f"CHECK-LIVE-{int(time.time())}",
                "creative_asset_id": creative_asset_id,
                "check_type": "model_policy_bundle",
                "check_status": "pass",
                "score": 94,
                "blocking_reason": "",
                "evidence_json": json.dumps(
                    {
                        "mode": CREATIVE_GENERATION_MODE,
                        "model_endpoint": CREATIVE_POLICY_MODEL_ENDPOINT,
                        "model_invocation_status": model_invocation["status"],
                        "brand_guideline_id": _default_brand_guideline()["guideline_id"],
                        "brand_guideline_version": _default_brand_guideline()["version"],
                    }
                ),
                "policy_version": "2026.05-demo",
                "model_or_rule": CREATIVE_POLICY_MODEL_ENDPOINT,
                "review_required": False,
                "created_ts": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
        ]
    _lakebase_persist_rows("policy_checks", checks, "policy_checks_run")
    return {"checks": checks, "mode": CREATIVE_GENERATION_MODE, "model_invocation": model_invocation}


@app.get("/api/synthetic-evaluations")
async def synthetic_evaluations(
    creative_asset_id: str = "",
    cohort_id: str = "",
    placement: str = "",
) -> list[dict[str, Any]]:
    rows = _dedupe_by_key(
        [*LIVE_SYNTHETIC_EVALUATIONS, *_lakebase_rows("synthetic_evaluations"), *_creative_workflow_data()["synthetic_evaluations"]],
        "evaluation_id",
    )
    if creative_asset_id:
        rows = [item for item in rows if item.get("creative_asset_id") == creative_asset_id]
    if cohort_id:
        rows = [item for item in rows if item.get("cohort_id") == cohort_id]
    if placement:
        rows = [item for item in rows if item.get("placement") == placement]
    return rows


@app.get("/api/synthetic-evaluations/{evaluation_id}/score-explanation")
async def synthetic_evaluation_score_explanation(evaluation_id: str) -> dict[str, Any]:
    return _score_explanation_for_evaluation(evaluation_id)


@app.post("/api/synthetic-evaluations/run")
async def run_synthetic_evaluations(payload: SyntheticEvaluationRunRequest) -> dict[str, Any]:
    model_invocation = _invoke_model_endpoint(
        CREATIVE_JUDGE_MODEL_ENDPOINT,
        "synthetic_audience_evaluation",
        "You act as a synthetic audience judge and estimate likely audience response to creative variants.",
        json.dumps(
            {
                "creative_asset_ids": payload.creative_asset_ids,
                "cohort_id": payload.cohort_id,
                "placement": payload.placement,
            }
        ),
        max_tokens=600,
    )
    rows = _demo_evaluations()
    if payload.creative_asset_ids:
        rows = [item for item in rows if item.get("creative_asset_id") in set(payload.creative_asset_ids)]
    if payload.cohort_id:
        rows = [item for item in rows if item.get("cohort_id") == payload.cohort_id]
    if payload.placement:
        rows = [item for item in rows if item.get("placement") == payload.placement]
    _lakebase_persist_rows("synthetic_evaluations", rows, "synthetic_evaluations_run")
    return {
        "evaluations": rows,
        "judge_model": CREATIVE_JUDGE_MODEL_ENDPOINT,
        "model_invocation": model_invocation,
    }


@app.get("/api/activation-exports")
async def activation_exports() -> list[dict[str, Any]]:
    return _dedupe_by_key(
        [*_lakebase_rows("activation_exports"), *_creative_workflow_data()["activation_exports"]],
        "export_id",
    )


@app.post("/api/activation-exports")
async def create_activation_export(payload: ActivationExportRequest) -> dict[str, Any]:
    created_ts = time.strftime("%Y-%m-%d %H:%M:%S")
    timestamp = int(time.time() * 1000)
    destination = payload.destination_system.strip() or ACTIVATION_DESTINATION_SYSTEM
    destination_token = "".join(char for char in destination.upper() if char.isalnum())[:10] or "CHANNEL"
    activation_id = f"ACT-LIVE-{timestamp}-{destination_token}"
    export_id = f"EXPORT-LIVE-{timestamp}-{destination_token}"
    destination_asset_id = f"{destination_token}-LIVE-{timestamp}"
    export = {
        "export_id": export_id,
        "creative_asset_id": payload.creative_asset_id,
        "cohort_id": payload.cohort_id,
        "placement": payload.placement,
        "destination_system": destination,
        "destination_asset_id": destination_asset_id,
        "payload_uri": _creative_volume_uri("exports", f"{payload.creative_asset_id}.json"),
        "export_status": "ready",
        "exported_by": "app_user",
        "exported_ts": created_ts,
        "error_message": "",
    }
    activation = {
        "activation_id": activation_id,
        "creative_asset_id": payload.creative_asset_id,
        "campaign_id": f"CAMP-LIVE-{payload.cohort_id or payload.placement}",
        "destination_platform": destination,
        "trafficking_status": "Submitted",
        "impressions": 0,
        "clicks": 0,
        "conversions": 0,
        "cost": float(payload.budget or 0),
        "ab_test_id": None,
        "last_sync_ts": created_ts,
        "activation_source": "live_submission",
        "placement": payload.placement,
        "cohort_id": payload.cohort_id,
        "destination_asset_id": destination_asset_id,
        "export_id": export_id,
    }
    _lakebase_persist_rows("activation_exports", [export], "activation_export_created")
    _lakebase_persist_rows("activations", [activation], "activation_submitted")
    LIVE_ACTIVATION_SUBMISSIONS.insert(0, activation)
    del LIVE_ACTIVATION_SUBMISSIONS[25:]
    return {"export": export, "activation": activation}


@app.get("/api/feedback")
async def feedback() -> list[dict[str, Any]]:
    return _query_workflow_table("prediction_feedback", "gold_buyside_prediction_feedback", [])


@app.get("/api/state/events")
async def state_events(
    entity_type: str = "",
    entity_id: str = "",
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    return {
        "backend": "lakebase" if _lakebase_init() else "memory_fallback",
        "instance": LAKEBASE_INSTANCE_NAME,
        "database": LAKEBASE_DATABASE_NAME,
        "events": _lakebase_events(entity_type=entity_type, entity_id=entity_id, limit=limit),
    }


@app.get("/api/ask/suggestions")
async def ask_suggestions() -> list[str]:
    return _genie_recommended_questions()


@app.post("/api/ask")
async def ask(request: Request, payload: AskRequest) -> dict[str, Any]:
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    genie_error: str | None = None
    if ASK_AI_BACKEND == "genie" and GENIE_SPACE_ID:
        try:
            user_token = request.headers.get("x-forwarded-access-token", "").strip()
            return _ask_genie_resilient(question, access_token=user_token or None)
        except Exception as exc:
            genie_error = str(exc)
            DATA_BACKEND_ERRORS.append(f"genie: {genie_error}")

    return _ask_workflow_fallback(question, genie_error or "")


if (DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/{full_path:path}")
async def serve_app(full_path: str) -> Any:
    index = DIST / "index.html"
    if index.exists():
        return FileResponse(index, headers={"Cache-Control": "no-store, max-age=0"})
    return {"message": "Frontend has not been built yet. Run npm run build, or use npm run dev for local development."}


if __name__ == "__main__":
    port = int(os.getenv("DATABRICKS_APP_PORT", os.getenv("PORT", "8000")))
    host = os.getenv("DATABRICKS_APP_HOST", "0.0.0.0")
    uvicorn.run("app.main:app", host=host, port=port)
