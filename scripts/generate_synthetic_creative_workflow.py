from __future__ import annotations

import argparse
import json
import math
import os
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate synthetic creative workflow data and image assets.")
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--source-catalog", required=True)
    parser.add_argument("--source-schema", required=True)
    parser.add_argument("--volume", default="creative_assets")
    parser.add_argument("--asset-prefix", default="creative_assets")
    parser.add_argument("--destination-system", default="onsite_personalization")
    parser.add_argument("--creative-model-endpoint", default="databricks-gpt-5-mini")
    parser.add_argument("--policy-model-endpoint", default="databricks-gpt-5-mini")
    parser.add_argument("--judge-model-endpoint", default="databricks-gpt-5-mini")
    return parser.parse_args()


def qname(*parts: str) -> str:
    return ".".join(f"`{part}`" for part in parts)


PLACEMENT_SPECS: dict[str, dict[str, Any]] = {
    "homepage_hero": {"ratio": "16:9", "width": 1280, "height": 720, "channels": ["web", "onsite_personalization"], "safe_area": {"x_pct": 8, "y_pct": 12, "width_pct": 54, "height_pct": 42}},
    "app_tile": {"ratio": "1:1", "width": 1080, "height": 1080, "channels": ["app", "onsite_personalization"], "safe_area": {"x_pct": 10, "y_pct": 12, "width_pct": 76, "height_pct": 48}},
    "newsletter_banner": {"ratio": "6:1", "width": 1200, "height": 200, "channels": ["email"], "safe_area": {"x_pct": 6, "y_pct": 18, "width_pct": 68, "height_pct": 56}},
    "social_square": {"ratio": "1:1", "width": 1080, "height": 1080, "channels": ["social"], "safe_area": {"x_pct": 9, "y_pct": 10, "width_pct": 74, "height_pct": 54}},
    "story_unit": {"ratio": "9:16", "width": 1080, "height": 1920, "channels": ["social", "app"], "safe_area": {"x_pct": 8, "y_pct": 16, "width_pct": 78, "height_pct": 58}},
}

EDIT_OPERATION_LABELS = {
    "resize": "Resize",
    "crop": "Crop",
    "inpaint": "Inpaint",
    "outpaint": "Outpaint",
    "cleanup": "Cleanup",
    "background_extension": "Background extension",
    "text_safe_area_adjustment": "Text-safe-area adjustment",
    "aspect_ratio_conversion": "Aspect-ratio conversion",
}


def edit_steps_for_placement(placement: str, variant_number: int, source_asset: dict[str, Any]) -> list[dict[str, Any]]:
    spec = PLACEMENT_SPECS[placement]
    ordered_types = ["resize", "aspect_ratio_conversion", "text_safe_area_adjustment", "cleanup"]
    if placement in {"homepage_hero", "newsletter_banner", "story_unit"}:
        ordered_types.extend(["outpaint", "background_extension"])
    if placement in {"app_tile", "social_square", "story_unit"}:
        ordered_types.append("crop")
    if variant_number % 2 == 1:
        ordered_types.append("inpaint")

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
                    "source_width_px": int(source_asset.get("width_px", 1280)),
                    "source_height_px": int(source_asset.get("height_px", 720)),
                    "source_aspect_ratio": str(source_asset.get("aspect_ratio", "16:9")),
                    "output_width_px": spec["width"],
                    "output_height_px": spec["height"],
                    "output_aspect_ratio": spec["ratio"],
                    "safe_area": spec["safe_area"],
                    "channels": spec["channels"],
                },
            }
        )
    return steps


def adaptation_summary(steps: list[dict[str, Any]], placement: str) -> str:
    labels = [step["edit_label"] for step in steps[:4]]
    suffix = f" + {len(steps) - len(labels)} more" if len(steps) > len(labels) else ""
    return f"{placement.replace('_', ' ').title()} adaptation: {', '.join(labels)}{suffix}."


def write_svg(path: Path, title: str, subtitle: str, palette: tuple[str, str], ratio: str) -> bool:
    width, height = (1200, 628)
    if ratio == "1:1":
        width, height = (1080, 1080)
    elif ratio == "9:16":
        width, height = (1080, 1920)
    elif ratio == "4:5":
        width, height = (1080, 1350)
    elif ratio == "16:9":
        width, height = (1280, 720)
    elif ratio == "6:1":
        width, height = (1200, 200)

    safe_title = title.replace("&", "and")
    safe_subtitle = subtitle.replace("&", "and")
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{palette[0]}"/>
      <stop offset="1" stop-color="{palette[1]}"/>
    </linearGradient>
    <pattern id="grid" width="52" height="52" patternUnits="userSpaceOnUse">
      <path d="M 52 0 L 0 0 0 52" fill="none" stroke="rgba(255,255,255,0.20)" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="{width}" height="{height}" fill="url(#g)"/>
  <rect width="{width}" height="{height}" fill="url(#grid)" opacity="0.46"/>
  <circle cx="{int(width * 0.82)}" cy="{int(height * 0.22)}" r="{int(min(width, height) * 0.18)}" fill="rgba(255,255,255,0.18)"/>
  <rect x="{int(width * 0.07)}" y="{int(height * 0.13)}" width="{int(width * 0.58)}" height="{int(height * 0.08)}" rx="10" fill="rgba(255,255,255,0.22)"/>
  <text x="{int(width * 0.08)}" y="{int(height * 0.48)}" fill="white" font-family="Inter, Arial, sans-serif" font-size="{max(34, int(width * 0.045))}" font-weight="800">{safe_title[:42]}</text>
  <text x="{int(width * 0.08)}" y="{int(height * 0.58)}" fill="rgba(255,255,255,0.84)" font-family="Inter, Arial, sans-serif" font-size="{max(20, int(width * 0.023))}" font-weight="600">{safe_subtitle[:62]}</text>
  <text x="{int(width * 0.08)}" y="{int(height * 0.82)}" fill="rgba(255,255,255,0.72)" font-family="IBM Plex Mono, monospace" font-size="{max(16, int(width * 0.017))}" font-weight="600">{ratio} synthetic governed asset</text>
</svg>
"""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(svg, encoding="utf-8")
        return True
    except PermissionError:
        return False


def table_rows(table_name: str, limit: int, fallback: list[dict[str, Any]]) -> list[dict[str, Any]]:
    try:
        rows = spark.table(table_name).limit(limit).collect()  # noqa: F821
        return [row.asDict(recursive=True) for row in rows] or fallback
    except Exception:
        return fallback


def save_table(catalog: str, schema: str, table: str, rows: list[dict[str, Any]], comment: str) -> bool:
    df = spark.createDataFrame(rows)  # noqa: F821
    full_name = qname(catalog, schema, table)
    try:
        (
            df.write.format("delta")
            .mode("overwrite")
            .option("overwriteSchema", "true")
            .option("delta.enableChangeDataFeed", "true")
            .saveAsTable(full_name)
        )
        spark.sql(f"ALTER TABLE {full_name} SET TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true')")  # noqa: F821
        spark.sql(f"COMMENT ON TABLE {full_name} IS {json.dumps(comment)}")  # noqa: F821
        return True
    except Exception as exc:
        print(json.dumps({"table": f"{catalog}.{schema}.{table}", "write_status": "skipped", "reason": str(exc)[:500]}))
        return False


def main() -> None:
    args = parse_args()
    now = datetime.utcnow().replace(microsecond=0)
    catalog = args.catalog
    schema = args.schema
    volume = args.volume
    asset_prefix = args.asset_prefix.strip().strip("/")
    volume_root = Path(f"/Volumes/{catalog}/{schema}/{volume}") / asset_prefix if asset_prefix else Path(f"/Volumes/{catalog}/{schema}/{volume}")

    spark.sql(f"CREATE SCHEMA IF NOT EXISTS {qname(catalog, schema)} COMMENT 'Creative Command Center synthetic workflow data'")  # noqa: F821
    try:
        spark.sql(f"DESCRIBE VOLUME {qname(catalog, schema, volume)}")  # noqa: F821
    except Exception:
        spark.sql(f"CREATE VOLUME IF NOT EXISTS {qname(catalog, schema, volume)} COMMENT 'Governed creative image and video assets'")  # noqa: F821

    fallback_briefs = [
        {"brief_id": "BRIEF-001", "brief_name": "Summer Campaign 2026", "objective": "Lift tune-in intent"},
        {"brief_id": "BRIEF-002", "brief_name": "Sports Winback", "objective": "Recover churn-risk fans"},
    ]
    fallback_cohorts = [
        {"cohort_id": "COH-001", "cohort_name": "Live Sports Loyalists", "cohort_description": "Heavy live-game viewers with high retention value"},
        {"cohort_id": "COH-002", "cohort_name": "Churn Risk: Sports", "cohort_description": "Sports fans with falling engagement"},
        {"cohort_id": "COH-003", "cohort_name": "Family Co-Viewing", "cohort_description": "Households with weekend family viewing"},
        {"cohort_id": "COH-004", "cohort_name": "Premium Upgrade Lookalikes", "cohort_description": "Lookalikes modeled from annual-plan converters"},
    ]

    briefs = table_rows(f"{args.source_catalog}.{args.source_schema}.gold_media_creative_briefs", 3, fallback_briefs)
    cohorts = table_rows(f"{catalog}.{schema}.gold_buyside_audience_cohort", 6, fallback_cohorts)
    cohorts = cohorts[:6] or fallback_cohorts

    palettes = [
        ("#0f9f95", "#256b8f"),
        ("#c7793a", "#b65aa6"),
        ("#256b8f", "#1f9d72"),
        ("#5b65d8", "#d89a23"),
        ("#13212d", "#0f9f95"),
    ]
    placements = [
        (name, spec["ratio"], int(spec["width"]), int(spec["height"]), list(spec["channels"]))
        for name, spec in PLACEMENT_SPECS.items()
    ]

    rights_profiles = [
        {
            "rights_profile_id": "RIGHTS-001",
            "license_type": "owned",
            "allowed_regions_json": json.dumps(["US", "CA"]),
            "blocked_regions_json": json.dumps([]),
            "allowed_channels_json": json.dumps(["web", "app", "email", "social", "onsite_personalization"]),
            "blocked_channels_json": json.dumps([]),
            "allowed_date_start": "2026-01-01",
            "allowed_date_end": "2026-12-31",
            "talent_restrictions_json": json.dumps([]),
            "ip_restrictions_json": json.dumps([]),
            "requires_legal_review": False,
            "notes": "Synthetic owned asset profile for demo use.",
        },
        {
            "rights_profile_id": "RIGHTS-002",
            "license_type": "stock_limited",
            "allowed_regions_json": json.dumps(["US"]),
            "blocked_regions_json": json.dumps(["EU"]),
            "allowed_channels_json": json.dumps(["web", "app", "onsite_personalization"]),
            "blocked_channels_json": json.dumps(["paid_social"]),
            "allowed_date_start": "2026-03-01",
            "allowed_date_end": "2026-09-30",
            "talent_restrictions_json": json.dumps(["no_implied_endorsement"]),
            "ip_restrictions_json": json.dumps([]),
            "requires_legal_review": True,
            "notes": "Synthetic limited-rights asset profile.",
        },
    ]

    trait_rows = []
    for index, cohort in enumerate(cohorts):
        cohort_id = str(cohort.get("cohort_id", f"COH-{index + 1:03d}"))
        cohort_name = str(cohort.get("cohort_name", f"Synthetic Cohort {index + 1}"))
        trait_rows.append(
            {
                "cohort_id": cohort_id,
                "trait_profile_id": f"TRAIT-{index + 1:04d}",
                "topic_affinity_json": json.dumps(["live sports", "premium events"] if "Sports" in cohort_name else ["family viewing", "new releases"]),
                "subscription_propensity_score": round(0.52 + (index * 0.06), 2),
                "churn_risk_score": round(0.68 if "Churn" in cohort_name else 0.18 + (index * 0.04), 2),
                "device_usage_json": json.dumps({"mobile": 0.42, "ctv": 0.36, "web": 0.22}),
                "engagement_style": "lean-forward clips" if index % 2 else "appointment viewing",
                "lifecycle_stage": "winback" if "Churn" in cohort_name else "growth",
                "preferred_tone": "urgent" if "Churn" in cohort_name else "premium",
                "creative_implications_text": f"Use {cohort_name} traits to adjust topic, format, tone, and call-to-action.",
                "excluded_claims_json": json.dumps(["guaranteed savings", "exclusive rights without validation"]),
                "region_constraints_json": json.dumps({"allowed": ["US", "CA"], "blocked": []}),
                "channel_constraints_json": json.dumps({"allowed": ["web", "app", "email", "social", "onsite_personalization"]}),
                "created_ts": now,
                "updated_ts": now,
            }
        )

    base_assets = []
    for index in range(20):
        placement = placements[index % len(placements)]
        palette = palettes[index % len(palettes)]
        asset_id = f"BASE-{index + 1:04d}"
        title = f"{placement[0].replace('_', ' ').title()} Base {index + 1}"
        subtitle = "Governed source asset with approved usage metadata"
        storage_uri = f"{volume_root}/base/{asset_id}.svg"
        write_svg(Path(storage_uri), title, subtitle, palette, placement[1])
        base_assets.append(
            {
                "asset_id": asset_id,
                "asset_name": title,
                "asset_type": "image",
                "storage_uri": storage_uri,
                "thumbnail_uri": storage_uri,
                "format": "svg",
                "width_px": placement[2],
                "height_px": placement[3],
                "duration_sec": 0,
                "aspect_ratio": placement[1],
                "content_tags": ",".join(["synthetic", "governed", placement[0], "brand_safe"]),
                "description": f"Synthetic {placement[0]} visual for premium streaming creative testing.",
                "source_system": "synthetic_databricks_job",
                "source_asset_external_id": f"SYNTH-{index + 1:04d}",
                "rights_profile_id": rights_profiles[index % len(rights_profiles)]["rights_profile_id"],
                "approved_usage_contexts_json": json.dumps(placement[4]),
                "historical_performance_json": json.dumps({"ctr": round(0.55 + index * 0.04, 2), "conversion_rate": round(0.04 + index * 0.003, 3)}),
                "brand_safety_score": int(88 + (index % 9)),
                "status": "active",
                "created_ts": now - timedelta(days=30 - index),
                "updated_ts": now,
            }
        )

    search_corpus = [
        {
            "asset_id": asset["asset_id"],
            "asset_name": asset["asset_name"],
            "description": asset["description"],
            "search_text": " ".join(
                [
                    str(asset["asset_name"]),
                    str(asset["description"]),
                    str(asset["content_tags"]),
                    str(asset["approved_usage_contexts_json"]),
                    str(asset["historical_performance_json"]),
                ]
            ),
            "asset_type": asset["asset_type"],
            "content_tags": asset["content_tags"],
            "approved_regions": "US,CA",
            "approved_channels": ",".join(json.loads(str(asset["approved_usage_contexts_json"]))),
            "placement_contexts": asset["content_tags"],
            "rights_profile_id": asset["rights_profile_id"],
            "thumbnail_uri": asset["thumbnail_uri"],
            "storage_uri": asset["storage_uri"],
            "status": asset["status"],
        }
        for asset in base_assets
    ]

    requests = []
    variants = []
    transformations = []
    lineage_edges = []
    policy_checks = []
    eval_rows = []
    request_index = 0
    variant_index = 0
    line_index = 0
    check_index = 0

    for cohort_index, cohort in enumerate(cohorts[:4]):
        cohort_id = str(cohort.get("cohort_id", f"COH-{cohort_index + 1:03d}"))
        cohort_name = str(cohort.get("cohort_name", f"Cohort {cohort_index + 1}"))
        brief = briefs[cohort_index % len(briefs)]
        brief_id = str(brief.get("brief_id", f"BRIEF-{cohort_index + 1:03d}"))
        brief_name = str(brief.get("brief_name", brief.get("name", "Campaign brief")))
        for placement_index, placement in enumerate(placements):
            request_index += 1
            request_id = f"REQ-{request_index:05d}"
            base_asset = base_assets[(cohort_index * len(placements) + placement_index) % len(base_assets)]
            instructions = f"Create variants for {cohort_name} in {placement[0]} with a clear streaming value proposition."
            requests.append(
                {
                    "request_id": request_id,
                    "brief_id": brief_id,
                    "cohort_id": cohort_id,
                    "placement": placement[0],
                    "campaign_objective": str(brief.get("objective", "Increase campaign response")),
                    "content_type": "image",
                    "source_mode": "search_and_generate",
                    "selected_base_asset_ids_json": json.dumps([base_asset["asset_id"]]),
                    "user_instructions": instructions,
                    "system_prompt": f"Use Databricks model endpoint {args.creative_model_endpoint} to generate brand-safe creative variants from governed base assets.",
                    "negative_prompt": "No real people, copyrighted characters, false claims, or unapproved regional references.",
                    "requested_variant_count": 4,
                    "requested_by": "creative.command@databricks.demo",
                    "request_status": "completed",
                    "created_ts": now - timedelta(hours=request_index),
                    "completed_ts": now - timedelta(hours=request_index, minutes=-4),
                }
            )
            for local_variant in range(4):
                variant_index += 1
                creative_id = f"VAR-{variant_index:06d}"
                palette = palettes[(cohort_index + placement_index + local_variant) % len(palettes)]
                title = f"{cohort_name[:28]} V{local_variant + 1}"
                subtitle = f"{brief_name[:34]} - {placement[0].replace('_', ' ')}"
                storage_uri = f"{volume_root}/generated/{creative_id}.svg"
                write_svg(Path(storage_uri), title, subtitle, palette, placement[1])
                overall_seed = 72 + (cohort_index * 3) + (placement_index * 2) + (local_variant * 4)
                approval_status = "Approved" if local_variant in {2, 3} else "Pending_Review"
                edit_steps = edit_steps_for_placement(placement[0], local_variant + 1, base_asset)
                variants.append(
                    {
                        "creative_asset_id": creative_id,
                        "request_id": request_id,
                        "brief_id": brief_id,
                        "cohort_id": cohort_id,
                        "source_asset_id": base_asset["asset_id"],
                        "parent_creative_asset_id": base_asset["asset_id"],
                        "variant_number": local_variant + 1,
                        "asset_name": f"{cohort_name} {placement[0].replace('_', ' ').title()} Variant {local_variant + 1}",
                        "asset_type": "Image",
                        "placement": placement[0],
                        "format": "SVG",
                        "width_px": placement[2],
                        "height_px": placement[3],
                        "duration_sec": 0,
                        "aspect_ratio": placement[1],
                        "storage_uri": storage_uri,
                        "thumbnail_uri": storage_uri,
                        "generation_prompt": instructions,
                        "generation_model": args.creative_model_endpoint,
                        "generation_params_json": json.dumps(
                            {
                                "mode": "model_endpoint",
                                "model_endpoint": args.creative_model_endpoint,
                                "palette": list(palette),
                                "variant": local_variant + 1,
                                "applied_edit_types": [step["transformation_type"] for step in edit_steps],
                            }
                        ),
                        "adaptation_summary": adaptation_summary(edit_steps, placement[0]),
                        "approval_status": approval_status,
                        "approved_by": "reviewer@databricks.demo" if approval_status == "Approved" else "",
                        "approved_ts": now if approval_status == "Approved" else None,
                        "created_ts": now - timedelta(hours=request_index, minutes=local_variant),
                        "updated_ts": now,
                        "quality_score": int(min(98, overall_seed + 6)),
                        "predicted_ctr": round(0.72 + overall_seed / 100.0, 2),
                        "target_segment": cohort_name,
                        "content_tags": f"synthetic,{placement[0]},variant,{cohort_name.lower().replace(' ', '_')}",
                    }
                )
                for step in edit_steps:
                    parameters = step["parameters"]
                    transformations.append(
                        {
                            "transformation_id": f"XFORM-{variant_index:06d}-{step['edit_sequence']:02d}",
                            "creative_asset_id": creative_id,
                            "input_asset_id": base_asset["asset_id"],
                            "output_asset_id": creative_id,
                            "transformation_type": step["transformation_type"],
                            "edit_sequence": step["edit_sequence"],
                            "edit_label": step["edit_label"],
                            "edit_goal": step["edit_goal"],
                            "placement": placement[0],
                            "source_width_px": parameters["source_width_px"],
                            "source_height_px": parameters["source_height_px"],
                            "source_aspect_ratio": parameters["source_aspect_ratio"],
                            "output_width_px": parameters["output_width_px"],
                            "output_height_px": parameters["output_height_px"],
                            "output_aspect_ratio": parameters["output_aspect_ratio"],
                            "tool_or_model": args.creative_model_endpoint,
                            "parameters_json": json.dumps(parameters),
                            "edit_status": "completed",
                            "performed_by": "creative.command@databricks.demo",
                            "created_ts": now,
                        }
                    )
                for source_type, source_id, relationship in [
                    ("brief", brief_id, "brief_to_request"),
                    ("audience", cohort_id, "audience_to_request"),
                    ("base_asset", base_asset["asset_id"], "base_asset_to_variant"),
                    ("generation_request", request_id, "request_to_variant"),
                ]:
                    line_index += 1
                    lineage_edges.append(
                        {
                            "lineage_edge_id": f"LINE-{line_index:07d}",
                            "source_entity_type": source_type,
                            "source_entity_id": source_id,
                            "target_entity_type": "creative_variant" if relationship != "brief_to_request" and relationship != "audience_to_request" else "generation_request",
                            "target_entity_id": creative_id if relationship not in {"brief_to_request", "audience_to_request"} else request_id,
                            "relationship_type": relationship,
                            "metadata_json": json.dumps({"placement": placement[0], "request_id": request_id}),
                            "created_ts": now,
                        }
                    )
                for step in edit_steps:
                    line_index += 1
                    lineage_edges.append(
                        {
                            "lineage_edge_id": f"LINE-{line_index:07d}",
                            "source_entity_type": "creative_transformation",
                            "source_entity_id": f"XFORM-{variant_index:06d}-{step['edit_sequence']:02d}",
                            "target_entity_type": "creative_variant",
                            "target_entity_id": creative_id,
                            "relationship_type": "transformation_to_variant",
                            "metadata_json": json.dumps(
                                {
                                    "placement": placement[0],
                                    "transformation_type": step["transformation_type"],
                                    "edit_sequence": step["edit_sequence"],
                                }
                            ),
                            "created_ts": now,
                        }
                    )

                check_defs = [
                    ("brand_fit", "pass", overall_seed + 7, ""),
                    ("rights", "pass", 96, ""),
                    ("regional_usage", "pass", 94, ""),
                    ("safety", "pass" if local_variant != 0 else "warn", overall_seed, "Review headline intensity" if local_variant == 0 else ""),
                ]
                for check_type, status, score, reason in check_defs:
                    check_index += 1
                    policy_checks.append(
                        {
                            "check_id": f"CHECK-{check_index:07d}",
                            "creative_asset_id": creative_id,
                            "check_type": check_type,
                            "check_status": status,
                            "score": float(min(99, score)),
                            "blocking_reason": reason,
                            "evidence_json": json.dumps(
                                {
                                    "source": "databricks_model_endpoint",
                                    "placement": placement[0],
                                    "rights_profile_id": base_asset["rights_profile_id"],
                                    "policy_model_endpoint": args.policy_model_endpoint,
                                }
                            ),
                            "policy_version": "2026.05-demo",
                            "model_or_rule": args.policy_model_endpoint,
                            "review_required": status != "pass",
                            "created_ts": now,
                        }
                    )

                eval_rows.append(
                    {
                        "evaluation_id": f"EVAL-{variant_index:07d}",
                        "creative_asset_id": creative_id,
                        "cohort_id": cohort_id,
                        "placement": placement[0],
                        "panel_size": 125,
                        "click_propensity_score": float(min(99, overall_seed + 2)),
                        "expected_dwell_time_score": float(min(99, overall_seed + 4)),
                        "subscription_start_propensity_score": float(min(99, overall_seed - 1)),
                        "relevance_score": float(min(99, overall_seed + 8)),
                        "clarity_score": float(min(99, overall_seed + 5)),
                        "fatigue_risk_score": float(max(5, 32 - local_variant * 5)),
                        "brand_fit_score": float(min(99, overall_seed + 7)),
                        "overall_score": float(min(99, overall_seed + 5)),
                        "rank_within_segment_placement": 0,
                        "judge_model": args.judge_model_endpoint,
                        "judge_prompt_version": "2026.05-demo",
                        "evidence_json": json.dumps({"top_signal": "message clarity", "segment": cohort_name}),
                        "created_ts": now,
                    }
                )

    grouped_eval = defaultdict(list)
    for row in eval_rows:
        grouped_eval[(row["cohort_id"], row["placement"])].append(row)
    for rows in grouped_eval.values():
        for rank, row in enumerate(sorted(rows, key=lambda item: item["overall_score"], reverse=True), start=1):
            row["rank_within_segment_placement"] = rank

    panel_rows = []
    panel_index = 0
    for cohort in cohorts[:4]:
        cohort_id = str(cohort.get("cohort_id"))
        cohort_name = str(cohort.get("cohort_name", "Synthetic Cohort"))
        for member in range(50):
            panel_index += 1
            panel_rows.append(
                {
                    "panel_member_id": f"PANEL-{panel_index:07d}",
                    "cohort_id": cohort_id,
                    "persona_name": f"{cohort_name} Persona {member + 1}",
                    "lifecycle_stage": "winback" if "Churn" in cohort_name else "growth",
                    "topic_affinity_json": json.dumps(["sports", "live events"] if "Sports" in cohort_name else ["family", "premium video"]),
                    "device_preference": ["ctv", "mobile", "web", "tablet"][member % 4],
                    "engagement_style": "short-form browsing" if member % 2 else "long-form viewing",
                    "subscription_propensity_score": round(0.42 + (member % 17) / 30.0, 2),
                    "churn_risk_score": round(0.2 + (member % 11) / 25.0, 2),
                    "region": "US",
                    "synthetic_profile_json": json.dumps({"synthetic": True, "no_real_pii": True, "member_index": member}),
                    "created_ts": now,
                }
            )

    export_rows = []
    for row in eval_rows:
        if row["rank_within_segment_placement"] == 1:
            export_id = f"EXPORT-{len(export_rows) + 1:06d}"
            payload_path = volume_root / "exports" / f"{export_id}.json"
            payload = {
                "destination": args.destination_system,
                "creative_asset_id": row["creative_asset_id"],
                "cohort_id": row["cohort_id"],
                "placement": row["placement"],
                "exported_ts": now.isoformat(),
            }
            try:
                payload_path.parent.mkdir(parents=True, exist_ok=True)
                payload_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            except PermissionError:
                pass
            export_rows.append(
                {
                    "export_id": export_id,
                    "creative_asset_id": row["creative_asset_id"],
                    "cohort_id": row["cohort_id"],
                    "placement": row["placement"],
                    "destination_system": args.destination_system,
                    "destination_asset_id": f"ONSITE-{len(export_rows) + 1:06d}",
                    "payload_uri": str(payload_path),
                    "export_status": "ready",
                    "exported_by": "creative.command@databricks.demo",
                    "exported_ts": now,
                    "error_message": "",
                }
            )

    feedback_rows = [
        {
            "feedback_id": f"FEEDBACK-{index + 1:06d}",
            "creative_asset_id": export["creative_asset_id"],
            "cohort_id": export["cohort_id"],
            "placement": export["placement"],
            "activation_id": f"ACT-SYN-{index + 1:06d}",
            "synthetic_overall_score": float(88 - (index % 6)),
            "actual_ctr": round(0.8 + (index % 5) * 0.12, 2),
            "actual_dwell_time": round(7.5 + (index % 4) * 1.3, 2),
            "actual_subscription_starts": int(80 + index * 7),
            "actual_conversion_rate": round(0.05 + (index % 4) * 0.01, 3),
            "prediction_error_json": json.dumps({"ctr_error": round(math.sin(index) * 0.08, 3)}),
            "learning_summary": "Synthetic prediction aligned with early onsite personalization response.",
            "created_ts": now,
        }
        for index, export in enumerate(export_rows[:12])
    ]

    compatibility_creatives = [
        {
            "creative_asset_id": item["creative_asset_id"],
            "brief_id": item["brief_id"],
            "concept_id": item["request_id"],
            "source_asset_id": item["source_asset_id"],
            "asset_name": item["asset_name"],
            "asset_type": item["asset_type"],
            "format": item["format"],
            "width_px": item["width_px"],
            "height_px": item["height_px"],
            "aspect_ratio": item["aspect_ratio"],
            "duration_sec": item["duration_sec"],
            "storage_uri": item["storage_uri"],
            "generation_prompt": item["generation_prompt"],
            "generation_model": item["generation_model"],
            "generation_params": item["generation_params_json"],
            "target_segment": item["target_segment"],
            "target_content_genre": item["placement"],
            "content_tags": item["content_tags"],
            "approval_status": item["approval_status"],
            "approved_by": item["approved_by"],
            "approved_ts": item["approved_ts"],
            "created_ts": item["created_ts"],
            "updated_ts": item["updated_ts"],
        }
        for item in variants
    ]

    tables = [
        ("gold_buyside_asset_rights_profile", rights_profiles, "Rights and licensing profiles for creative workflow assets."),
        ("gold_buyside_audience_trait_profile", trait_rows, "Creative-relevant trait profiles for high-value audience cohorts."),
        ("gold_buyside_base_creative_asset", base_assets, "Governed base creative assets with usage metadata and UC volume storage URIs."),
        ("gold_buyside_asset_search_corpus", search_corpus, "Text corpus table for creative asset Vector Search indexing."),
        ("gold_buyside_creative_generation_request", requests, "Creative generation request records from brief, audience, placement, and instructions."),
        ("gold_buyside_creative_variant", variants, "Generated and adapted creative variants with prompt, model, storage, and approval metadata."),
        ("gold_buyside_creative_transformation", transformations, "Transformation events for generated and adapted creative assets."),
        ("gold_buyside_creative_lineage_edge", lineage_edges, "Explicit lineage edges across briefs, audiences, requests, base assets, variants, checks, and activations."),
        ("gold_buyside_creative_policy_check", policy_checks, "Policy, rights, regional, safety, and brand fit check results."),
        ("gold_buyside_synthetic_audience_panel", panel_rows, "Synthetic audience panel members for pre-live evaluation with no real PII."),
        ("gold_buyside_synthetic_audience_eval", eval_rows, "Synthetic audience evaluation scores and rankings for creative variants."),
        ("gold_buyside_activation_export", export_rows, "Onsite personalization activation export payload metadata."),
        ("gold_buyside_prediction_feedback", feedback_rows, "Real-world feedback comparison against synthetic predictions."),
        ("gold_buyside_generated_creatives", compatibility_creatives, "Compatibility table for current Creative Command Center generated creative API."),
    ]

    failed_tables = []
    for table, rows, comment in tables:
        if not save_table(catalog, schema, table, rows, comment):
            failed_tables.append(table)

    print(
        json.dumps(
            {
                "catalog": catalog,
                "schema": schema,
                "volume": str(volume_root),
            "base_assets": len(base_assets),
            "variants": len(variants),
            "transformations": len(transformations),
            "policy_checks": len(policy_checks),
                "synthetic_evaluations": len(eval_rows),
                "activation_exports": len(export_rows),
                "failed_tables": failed_tables,
                "permission_note": "Grant CREATE TABLE on the target schema and WRITE VOLUME on the target volume to persist this synthetic workflow in Unity Catalog."
                if failed_tables
                else "",
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    if "spark" not in globals():
        raise RuntimeError("This script must run as a Databricks Spark Python task.")
    main()
