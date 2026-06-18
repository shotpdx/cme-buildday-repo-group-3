#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time
from hashlib import md5
from dataclasses import dataclass
from typing import Any

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import (
    Disposition,
    ExecuteStatementRequestOnWaitTimeout,
    Format,
    StatementState,
)


SPACE_TITLE = os.getenv("GENIE_SPACE_TITLE", "Creative Command Center - Creative Workflow")
PIPELINE_CATALOG = os.getenv("PIPELINE_CATALOG", os.getenv("DATABRICKS_CATALOG", "cme_outcomes_uswest"))
PIPELINE_SCHEMA = os.getenv("PIPELINE_SCHEMA", os.getenv("DATABRICKS_SCHEMA", "lakefoundry"))
SOURCE_CATALOG = os.getenv("SOURCE_CATALOG", os.getenv("PIPELINE_SOURCE_CATALOG", PIPELINE_CATALOG))
SOURCE_SCHEMA = os.getenv("SOURCE_SCHEMA", os.getenv("PIPELINE_SOURCE_SCHEMA", "media_demo"))


@dataclass(frozen=True)
class TableSpec:
    catalog: str
    schema: str
    table: str
    purpose: str

    @property
    def identifier(self) -> str:
        return f"{self.catalog}.{self.schema}.{self.table}"

    @property
    def quoted_identifier(self) -> str:
        return ".".join(f"`{part}`" for part in (self.catalog, self.schema, self.table))


def _workflow_table(table: str, purpose: str) -> TableSpec:
    return TableSpec(PIPELINE_CATALOG, PIPELINE_SCHEMA, table, purpose)


def _source_table(table: str, purpose: str) -> TableSpec:
    return TableSpec(SOURCE_CATALOG, SOURCE_SCHEMA, table, purpose)


TABLE_SPECS = [
    _workflow_table("gold_buyside_ab_test_config", "A/B testing setup and winner criteria for activated creatives."),
    _workflow_table("gold_buyside_ab_test_variant", "A/B variant results and performance by test."),
    _workflow_table("gold_buyside_activation_export", "Approved creative exports into onsite personalization and downstream activation systems."),
    _workflow_table("gold_buyside_asset_rights_profile", "Rights, licensing, regional, channel, talent, and legal review constraints."),
    _workflow_table("gold_buyside_asset_search_corpus", "Vector-search-ready text corpus for governed creative retrieval."),
    _workflow_table("gold_buyside_audience_cohort", "Audience cohort definitions, reach, personalization granularity, and channel/region eligibility."),
    _workflow_table("gold_buyside_audience_trait_profile", "Audience traits that influence creative brief, tone, device use, churn risk, and topic affinity."),
    _workflow_table("gold_buyside_base_creative_asset", "Approved source images and videos with rights, metadata, storage URIs, and prior performance."),
    _workflow_table("gold_buyside_campaign_activation", "Trafficking, platform delivery, spend, clicks, conversions, and activation status."),
    _workflow_table("gold_buyside_creative_generation_request", "Generation requests tying brief, audience, placement, base assets, prompts, and model mode."),
    _workflow_table("gold_buyside_creative_lineage_edge", "Variant-level lineage edges across requests, source assets, checks, evaluations, and activations."),
    _workflow_table("gold_buyside_creative_policy_check", "Brand, rights, regional, legal, and safety review outcomes."),
    _workflow_table("gold_buyside_creative_transformation", "Resize, crop, inpaint, outpaint, cleanup, background extension, text-safe-area, and aspect-ratio edits."),
    _workflow_table("gold_buyside_creative_variant", "Generated and adapted creative variants with model, prompt, approval, and storage metadata."),
    _workflow_table("gold_buyside_generated_creatives", "Compatibility creative table used by existing command-center activation surfaces."),
    _workflow_table("gold_buyside_identity_graph", "Identity graph coverage used to connect audiences, households, devices, and activation reach."),
    _workflow_table("gold_buyside_prediction_feedback", "Live feedback comparing real-world performance against synthetic audience predictions."),
    _workflow_table("gold_buyside_synthetic_audience_eval", "Synthetic-audience scores and ranks by creative variant, cohort, and placement."),
    _workflow_table("gold_buyside_synthetic_audience_panel", "Synthetic audience panel members representing target cohorts without real PII."),
    _source_table("gold_media_audience_segments", "Media audience segment taxonomy used by briefs and cohort planning."),
    _source_table("gold_media_brand_asset_library", "Approved media brand assets and templates used as creative foundations."),
    _source_table("gold_media_campaign_engagement", "Campaign engagement outcomes useful for feedback and continuous improvement."),
    _source_table("gold_media_churn_predictions", "Churn and propensity signals used to inform high-value audience treatment."),
    _source_table("gold_media_content_affinity", "Topic and genre affinities that should influence creative concepts and prompts."),
    _source_table("gold_media_creative_briefs", "Campaign brief objectives, audiences, message pillars, inclusions, and exclusions."),
    _source_table("gold_media_creative_concepts", "Creative concept, tone, visual treatment, and alignment context."),
    _source_table("gold_media_customer_360", "Customer profile and engagement context for audience sizing and personalization."),
    _source_table("gold_media_customer_enrichment", "Enriched customer attributes supporting segment and propensity analysis."),
    _source_table("gold_media_customer_ltv", "Lifetime value metrics for high-value audience prioritization."),
    _source_table("gold_media_media_plan_line_items", "Media plan placements, formats, targeting, budget, and platform activation context."),
    _source_table("gold_media_top_genres_per_user", "Per-user genre affinity signals for segment-level content recommendations."),
]


SAMPLE_QUESTIONS = [
    "Which approved creative variants rank highest by segment and placement?",
    "Which pending review variants are missing policy checks or synthetic audience evaluations?",
    "Which base creative assets are approved for homepage hero placements for sports audiences?",
    "What transformations were applied to each creative variant, including crop, inpaint, outpaint, and aspect-ratio conversion?",
    "Which policy checks are blocked, warning, or require review, and what evidence was recorded?",
    "Compare synthetic audience scores by placement, cohort, and creative variant.",
    "Which creatives are ready for onsite personalization activation exports?",
    "Which generation model endpoints produced the current variants, and which variants are approved?",
    "What audience traits should influence creative direction for churn-risk sports cohorts?",
    "Where did live performance differ most from synthetic audience predictions?",
    "Which base assets have rights constraints that block social or newsletter usage?",
    "Which briefs have generated variants, approved winners, policy checks, and activation exports?",
]


DESCRIPTION = f"""Natural language analytics for the Creative Command Center workflow.

This Genie Space is curated around the current creative generation and activation use case. It includes all queryable gold tables in the buyside creative workflow plus the related media-demo gold tables that provide brief, audience, asset, engagement, affinity, churn, value, and media-plan context.

Core relationships:
- briefs join to generation requests and variants through brief_id.
- audience cohorts join to trait profiles, generation requests, variants, synthetic audience panels, evaluations, activation exports, and prediction feedback through cohort_id.
- base assets join to rights profiles by rights_profile_id and to variants through source_asset_id or selected_base_asset_ids_json.
- generation requests join to variants by request_id.
- creative variants join to transformations, policy checks, synthetic audience evaluations, activation exports, campaign activation, lineage, and feedback by creative_asset_id.
- transformations capture placement adaptation operations such as resize, crop, inpaint, outpaint, cleanup, background extension, text-safe-area adjustment, and aspect-ratio conversion.
- activation exports represent approved assets prepared for onsite personalization and downstream activation.

Use this space for governed questions about audience traits, creative retrieval, generation requests, variant approval, model endpoints, transformations, policy and rights checks, synthetic audience scoring, activation readiness, and feedback loops."""


def _warehouse_id(client: WorkspaceClient) -> str:
    configured = (
        os.getenv("DATABRICKS_WAREHOUSE_ID")
        or os.getenv("DATABRICKS_SQL_WAREHOUSE_ID")
        or os.getenv("SQL_WAREHOUSE_ID")
    )
    if configured:
        return configured

    warehouses = list(client.warehouses.list())
    if not warehouses:
        raise RuntimeError("No Databricks SQL warehouses are available.")

    def state_value(warehouse: Any) -> str:
        state = getattr(warehouse, "state", "")
        return getattr(state, "value", str(state))

    running = next((warehouse for warehouse in warehouses if state_value(warehouse).upper() == "RUNNING"), None)
    return getattr(running or warehouses[0], "id")


def _execute_sql(client: WorkspaceClient, warehouse_id: str, statement: str, row_limit: int = 100) -> list[dict[str, Any]]:
    response = client.statement_execution.execute_statement(
        statement=statement,
        warehouse_id=warehouse_id,
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

    columns = [
        column.name or ""
        for column in (response.manifest.schema.columns if response.manifest and response.manifest.schema else [])
    ]
    rows = response.result.data_array if response.result and response.result.data_array else []
    return [dict(zip(columns, row)) for row in rows]


def _queryable_tables(client: WorkspaceClient, warehouse_id: str) -> tuple[list[TableSpec], list[dict[str, str]]]:
    included: list[TableSpec] = []
    skipped: list[dict[str, str]] = []
    for spec in TABLE_SPECS:
        try:
            _execute_sql(client, warehouse_id, f"SELECT COUNT(*) AS row_count FROM {spec.quoted_identifier}", row_limit=1)
            _execute_sql(client, warehouse_id, f"DESCRIBE TABLE {spec.quoted_identifier}", row_limit=300)
            included.append(spec)
        except Exception as exc:
            skipped.append({"identifier": spec.identifier, "reason": str(exc)})
    return included, skipped


def _serialized_space(table_identifiers: list[str]) -> str:
    return json.dumps(
        {
            "version": 2,
            "config": {
                "sample_questions": [
                    {
                        "id": md5(f"{SPACE_TITLE}:{index}:{question}".encode("utf-8")).hexdigest(),
                        "question": [question],
                    }
                    for index, question in enumerate(SAMPLE_QUESTIONS)
                ],
            },
            "data_sources": {
                "tables": [{"identifier": identifier} for identifier in table_identifiers],
            },
        },
        indent=2,
    )


def _find_space(client: WorkspaceClient, title: str) -> dict[str, Any] | None:
    response = client.genie.list_spaces()
    spaces = getattr(response, "spaces", None) or []
    for space in spaces:
        if getattr(space, "title", None) == title:
            return space.as_dict()
    return None


def _create_or_update_space(
    client: WorkspaceClient,
    *,
    existing: dict[str, Any] | None,
    warehouse_id: str,
    table_identifiers: list[str],
) -> dict[str, Any]:
    full_payload = {
        "title": SPACE_TITLE,
        "warehouse_id": warehouse_id,
        "description": DESCRIPTION,
        "table_identifiers": table_identifiers,
        "serialized_space": _serialized_space(table_identifiers),
    }
    simple_payload = {
        "title": SPACE_TITLE,
        "warehouse_id": warehouse_id,
        "description": DESCRIPTION,
        "table_identifiers": table_identifiers,
    }

    method = "PATCH" if existing else "POST"
    path = f"/api/2.0/genie/spaces/{existing['space_id']}" if existing else "/api/2.0/genie/spaces"

    try:
        return client.api_client.do(method, path, body=full_payload)
    except Exception as first_error:
        try:
            return client.api_client.do(method, path, body=simple_payload)
        except Exception as second_error:
            raise RuntimeError(
                f"Genie space upsert failed with serialized payload ({first_error}) "
                f"and simple payload ({second_error})."
            ) from second_error


def main() -> None:
    client = WorkspaceClient()
    warehouse_id = _warehouse_id(client)
    included, skipped = _queryable_tables(client, warehouse_id)
    table_identifiers = [spec.identifier for spec in included]
    existing = _find_space(client, SPACE_TITLE)
    response = _create_or_update_space(
        client,
        existing=existing,
        warehouse_id=warehouse_id,
        table_identifiers=table_identifiers,
    )
    space_id = response.get("space_id") or response.get("id") or (existing or {}).get("space_id")
    result = {
        "space_id": space_id,
        "title": SPACE_TITLE,
        "warehouse_id": warehouse_id,
        "operation": "updated" if existing else "created",
        "table_count": len(table_identifiers),
        "tables": table_identifiers,
        "skipped": skipped,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
