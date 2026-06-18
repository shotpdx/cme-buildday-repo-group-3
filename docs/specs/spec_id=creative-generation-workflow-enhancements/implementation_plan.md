# Creative Generation Workflow Enhancements - Implementation Spec

Status: proposed
Date: 2026-05-27

## Source Inputs

- Transcript: `/Users/pragathi.sharma/Downloads/GMT20260527-170203_Recording.transcript.vtt`
- Current app: `my_project/` FastAPI + React Databricks App
- Current root data bundle: `databricks.yml`, `resources/*.yml`, `pipelines/*.py`
- Existing MVP spec: `docs/specs/spec_id=015dbf91-f584-4acb-a698-701d0596ede9/implementation_plan.md`
- Requested workflow additions: audience traits, governed creative search, image/video generation, adaptation, lineage, policy checks, synthetic audience evaluation, selection, activation, and continuous improvement

## Databricks Skills Applied

- `databricks-app-python`: app resource binding, FastAPI deployment, SQL warehouse access, app resource `valueFrom` pattern
- `databricks-bundles`: deployment through existing Databricks Asset Bundles
- `databricks-spark-declarative-pipelines`: serverless Lakeflow/Spark Declarative Pipelines for Delta tables
- `databricks-synthetic-data-gen`: synthetic audience and image asset data generation plan
- `databricks-unity-catalog`: Unity Catalog tables, volumes, lineage/audit posture
- `databricks-vector-search`: governed image/video retrieval from embedded asset metadata
- `databricks-model-serving`: custom serving endpoints or Foundation Model API endpoints for generation, judging, and orchestration
- `databricks-ai-functions`: batch enrichment, captioning, classification, safety/policy checks, and multimodal analysis
- `databricks-jobs`: scheduled generation, scoring, vector index sync, and feedback jobs

## Transcript-Derived Decisions

1. Add a creative generation step between the current Audience lens and Creative scoring surfaces.
2. Start with image workflows first; video should share the same architecture but can be a later phase.
3. Support two creative creation routes:
   - Search/retrieve governed existing assets from a vector store.
   - Generate new assets from audience traits, brief context, and text instructions.
4. Let the user review several variants, typically 3 to 5, before adapting or activating one.
5. Adapt creatives for placement formats such as homepage hero, app tile, newsletter banner, social square, and story.
6. Track lineage from brief, audience, base asset, prompt, model, and transformations to each final creative.
7. Prioritize auditability over broad reuse, while still making successful assets discoverable for future work.
8. Policy, rights, brand, regional, and safety checks belong before activation and should appear as scores or blocks next to each variant.
9. Market expansion should move out of the primary workflow and become a supporting dashboard if retained.
10. Ask AI / Genie can close the decision loop by answering questions over briefs, audiences, variants, scores, policy results, activations, and feedback.

## Current Baseline

The current project already has:

- A Databricks App with React frontend and FastAPI backend in `my_project/`.
- CSV fallback data plus Databricks SQL table reads controlled by `APP_DATA_SOURCE`.
- Current app views: Overview, Briefs, Audiences, Creatives, Markets, Activations, Ask AI.
- Pipeline tables for audience cohorts, generated creative metadata, campaign activation, identity graph, and A/B tests.
- A `gold_buyside_generated_creatives` table with metadata fields such as `creative_asset_id`, `source_asset_id`, `storage_uri`, `generation_prompt`, `generation_model`, and `approval_status`.

Major gaps versus the transcript:

- No actual image binaries are generated or stored in Unity Catalog volumes.
- No governed base asset repository with rights metadata and prior performance.
- No Vector Search index for creative retrieval.
- No user-facing creative generation request flow.
- No variant-level generation request, prompt, model, transformation, and lineage graph.
- No image adaptation workflow for placement-specific resize, crop, inpainting, or outpainting.
- No policy, rights, regional, safety, or brand checks as first-class tables.
- No synthetic audience evaluation table or scoring pipeline.
- No downstream activation payload contract for AEM, Adobe Target, CMS, DAM, or personalization systems.
- Ask AI is keyword-routed in-app logic, not a governed Genie-backed decision interface.

## Target Product Workflow

The enhanced primary workflow should be:

1. Brief Intake
   - Select a campaign brief and objective.
   - Confirm placements, regions, dates, business goal, and required content type.

2. Audience Segments
   - Select high-value audience cohorts.
   - Show traits that should influence the creative: topic affinity, subscription propensity, churn risk, device usage, engagement style, lifecycle stage, region, and channel constraints.

3. Creative Search and Retrieval
   - Search governed base images and videos by segment, placement, content type, topic, campaign objective, and usage context.
   - Retrieve candidate assets with rights, metadata, prior performance, approved channels, approved regions, and prior usage.

4. Creative Generation
   - Generate 3 to 5 variants per audience segment and placement.
   - Support both base-asset-derived variants and prompt-only variants.
   - Store output binaries in Unity Catalog volumes and metadata in Delta tables.

5. Creative Modification and Adaptation
   - Resize and reformat for homepage hero, app tile, newsletter banner, social unit, and story.
   - Track image edits such as crop, inpaint, outpaint, cleanup, background extension, text-safe-area adjustment, and aspect-ratio conversion.
   - Defer video modifications to phase 2 or 3, but preserve table fields for duration, opening frame, crop, alternate edit, and transcript/caption metadata.

6. Lineage, Governance, and Reuse
   - For every generated or modified asset, track parent asset, brief, segment, prompt, model, model parameters, transformation steps, reviewer, approval state, and storage URI.
   - Make variants discoverable and auditable through Unity Catalog tables and app drilldowns.

7. Policy, Rights, and Safety Checks
   - Run automatic checks for brand fit, rights, license, talent/IP, regional usage, channel usage, safety, and claims/compliance.
   - Block assets that fail hard constraints and score assets that pass with warnings.

8. Synthetic Audience Evaluation
   - Evaluate variants against synthetic audience panel members derived from the selected segment traits.
   - Score click propensity, dwell time, subscription-start propensity, relevance, clarity, fatigue risk, brand fit, and overall recommendation.
   - Rank variants within each segment and placement.

9. Selection and Activation
   - Select the best eligible creative per segment and placement based on policy result, synthetic score, business goal, and human review.
   - Push approved metadata and asset references to downstream systems or simulated activation adapters.

10. Continuous Improvement
   - Compare observed performance with synthetic predictions.
   - Feed learnings back into segment definitions, retrieval weights, prompts, policy rules, model choice, and creative playbooks.

## UX Changes

### Navigation

Replace the current linear workflow:

`Overview -> Briefs -> Audiences -> Creatives -> Markets -> Activations -> Ask AI`

with:

`Overview -> Briefs -> Audiences -> Creative Studio -> Evaluation -> Activations -> Ask AI`

Recommended handling:

- `Creative Studio` replaces the current `Creatives` view and contains search, generation, variants, and adaptation.
- `Evaluation` is a new workflow view for policy checks, rights checks, synthetic scoring, and ranking.
- `Markets` moves to a secondary insights dashboard after Ask AI menu option on the left.
- `Ask AI` remains available as a side panel or final tab, backed by governed tables and optionally Genie.

### Creative Studio Page

Required panels:

- Brief and audience context header
- Segment trait chips
- Prompt/instruction composer
- Placement selector
- Asset search panel with filter controls
- Base asset result cards with thumbnail, usage rights, performance, and approved contexts
- Generate variants action
- Variant grid showing 3 to 5 image outputs per segment/placement
- Adaptation controls for aspect ratio and placement
- Lineage drawer for any selected variant

### Evaluation Page

Required panels:

- Policy and rights checklist per variant
- Synthetic audience scoring radar or score table
- Variant ranking by segment and placement
- Warnings and hard blocks
- Human approval action
- Selection summary for activation

## Data Architecture

All tables should be deployed to `${var.catalog}.${var.schema}` through the root bundle. The current dev defaults are `cme_outcomes_uswest.lakefoundry`, but implementation should keep catalog and schema parameterized.

### Unity Catalog Volumes

Create a managed UC volume for creative binaries:

- Volume: `${var.catalog}.${var.schema}.creative_assets`
- Base path: `/Volumes/${var.catalog}/${var.schema}/creative_assets/`

Recommended folders:

- `base/`: synthetic and source base assets
- `generated/`: generated variants
- `adapted/`: resized, cropped, inpainted, outpainted, or placement-specific variants
- `thumbnails/`: small app-ready preview images
- `eval_artifacts/`: optional rendered comparison sheets and judge payload snapshots
- `exports/`: activation payloads for downstream systems

### Delta Tables

#### `gold_buyside_audience_trait_profile`

Grain: one row per audience cohort.

Purpose: describe which audience traits should alter creative decisions.

Key columns:

- `cohort_id`
- `trait_profile_id`
- `topic_affinity_json`
- `subscription_propensity_score`
- `churn_risk_score`
- `device_usage_json`
- `engagement_style`
- `lifecycle_stage`
- `preferred_tone`
- `creative_implications_text`
- `excluded_claims_json`
- `region_constraints_json`
- `channel_constraints_json`
- `created_ts`
- `updated_ts`

#### `gold_buyside_base_creative_asset`

Grain: one row per governed base image or video.

Purpose: searchable asset repository that generation can start from.

Key columns:

- `asset_id`
- `asset_name`
- `asset_type` (`image`, `video`, `template`)
- `storage_uri`
- `thumbnail_uri`
- `format`
- `width_px`
- `height_px`
- `duration_sec`
- `aspect_ratio`
- `content_tags`
- `description`
- `source_system`
- `source_asset_external_id`
- `rights_profile_id`
- `approved_usage_contexts_json`
- `historical_performance_json`
- `brand_safety_score`
- `status`
- `created_ts`
- `updated_ts`

#### `gold_buyside_asset_rights_profile`

Grain: one row per rights profile.

Purpose: normalize rights, license, region, talent, and channel constraints.

Key columns:

- `rights_profile_id`
- `license_type`
- `allowed_regions_json`
- `blocked_regions_json`
- `allowed_channels_json`
- `blocked_channels_json`
- `allowed_date_start`
- `allowed_date_end`
- `talent_restrictions_json`
- `ip_restrictions_json`
- `requires_legal_review`
- `notes`

#### `gold_buyside_asset_search_corpus`

Grain: one row per searchable asset.

Purpose: source table for Databricks Vector Search Delta Sync index.

Key columns:

- `asset_id`
- `search_text`
- `asset_type`
- `content_tags`
- `approved_regions`
- `approved_channels`
- `placement_contexts`
- `rights_profile_id`
- `thumbnail_uri`
- `storage_uri`
- `status`

`search_text` should concatenate asset description, tags, genre, usage contexts, prior performance summary, and rights-safe descriptors. Use Databricks managed embeddings with `databricks-gte-large-en`.

#### `gold_buyside_creative_generation_request`

Grain: one row per user generation/search request.

Purpose: capture the intent that created a set of variants.

Key columns:

- `request_id`
- `brief_id`
- `cohort_id`
- `placement`
- `campaign_objective`
- `content_type`
- `source_mode` (`search`, `generate`, `search_and_generate`, `adapt_existing`)
- `selected_base_asset_ids_json`
- `user_instructions`
- `system_prompt`
- `negative_prompt`
- `requested_variant_count`
- `requested_by`
- `request_status`
- `created_ts`
- `completed_ts`

#### `gold_buyside_creative_variant`

Grain: one row per generated or adapted output asset.

Purpose: supersede or extend the existing generated creative metadata table.

Key columns:

- `creative_asset_id`
- `request_id`
- `brief_id`
- `cohort_id`
- `source_asset_id`
- `parent_creative_asset_id`
- `variant_number`
- `asset_name`
- `asset_type`
- `placement`
- `format`
- `width_px`
- `height_px`
- `duration_sec`
- `aspect_ratio`
- `storage_uri`
- `thumbnail_uri`
- `generation_prompt`
- `generation_model`
- `generation_params_json`
- `adaptation_summary`
- `approval_status`
- `approved_by`
- `approved_ts`
- `created_ts`
- `updated_ts`

Migration note: the existing `gold_buyside_generated_creatives` can be kept as a compatibility view over this table during the UI migration.

#### `gold_buyside_creative_transformation`

Grain: one row per transformation step.

Purpose: track resize, crop, inpaint, outpaint, cleanup, or video edit events.

Key columns:

- `transformation_id`
- `creative_asset_id`
- `input_asset_id`
- `output_asset_id`
- `transformation_type`
- `placement`
- `tool_or_model`
- `parameters_json`
- `performed_by`
- `created_ts`

#### `gold_buyside_creative_lineage_edge`

Grain: one row per lineage edge.

Purpose: explicitly model audit lineage from brief and audience to output asset.

Key columns:

- `lineage_edge_id`
- `source_entity_type`
- `source_entity_id`
- `target_entity_type`
- `target_entity_id`
- `relationship_type`
- `metadata_json`
- `created_ts`

Expected relationship types:

- `brief_to_request`
- `audience_to_request`
- `base_asset_to_variant`
- `request_to_variant`
- `variant_to_adaptation`
- `variant_to_policy_check`
- `variant_to_synthetic_eval`
- `variant_to_activation`

#### `gold_buyside_creative_policy_check`

Grain: one row per check per creative variant.

Purpose: brand, rights, regional, safety, legal, and policy gate results.

Key columns:

- `check_id`
- `creative_asset_id`
- `check_type`
- `check_status` (`pass`, `warn`, `fail`, `blocked`, `not_applicable`)
- `score`
- `blocking_reason`
- `evidence_json`
- `policy_version`
- `model_or_rule`
- `review_required`
- `created_ts`

#### `gold_buyside_synthetic_audience_panel`

Grain: one row per synthetic audience persona.

Purpose: synthetic panel members used for pre-live evaluation. No real PII.

Key columns:

- `panel_member_id`
- `cohort_id`
- `persona_name`
- `lifecycle_stage`
- `topic_affinity_json`
- `device_preference`
- `engagement_style`
- `subscription_propensity_score`
- `churn_risk_score`
- `region`
- `synthetic_profile_json`
- `created_ts`

#### `gold_buyside_synthetic_audience_eval`

Grain: one row per creative variant per segment and placement.

Purpose: estimate response before activation.

Key columns:

- `evaluation_id`
- `creative_asset_id`
- `cohort_id`
- `placement`
- `panel_size`
- `click_propensity_score`
- `expected_dwell_time_score`
- `subscription_start_propensity_score`
- `relevance_score`
- `clarity_score`
- `fatigue_risk_score`
- `brand_fit_score`
- `overall_score`
- `rank_within_segment_placement`
- `judge_model`
- `judge_prompt_version`
- `evidence_json`
- `created_ts`

#### `gold_buyside_activation_export`

Grain: one row per downstream activation payload.

Purpose: track pushes to AEM, Adobe Target, CMS, DAM, onsite personalization, or simulated adapters.

Key columns:

- `export_id`
- `creative_asset_id`
- `cohort_id`
- `placement`
- `destination_system`
- `destination_asset_id`
- `payload_uri`
- `export_status`
- `exported_by`
- `exported_ts`
- `error_message`

#### `gold_buyside_prediction_feedback`

Grain: one row per activated creative performance observation.

Purpose: compare real-world outcomes with synthetic predictions.

Key columns:

- `feedback_id`
- `creative_asset_id`
- `cohort_id`
- `placement`
- `activation_id`
- `synthetic_overall_score`
- `actual_ctr`
- `actual_dwell_time`
- `actual_subscription_starts`
- `actual_conversion_rate`
- `prediction_error_json`
- `learning_summary`
- `created_ts`

## Synthetic Image Data Generation

The first implementation should generate synthetic image binaries and metadata for a demo-safe governed repository. This is separate from live image-generation model integration.

### Output Location

Use bundle variables:

- Catalog: `${var.catalog}`
- Schema: `${var.schema}`
- Volume: `/Volumes/${var.catalog}/${var.schema}/creative_assets/`

Current dev values are `cme_outcomes_uswest.lakefoundry`, but actual data generation should proceed only after confirming that target.

### Generation Pattern

Use a Databricks Job with serverless compute for metadata generation and image file writes:

- Create schema if missing.
- Create managed volume if missing.
- Generate 100 to 200 synthetic base images.
- Generate 3 to 5 synthetic variants for selected briefs, audiences, and placements.
- Generate thumbnails for app rendering.
- Write Delta metadata tables with comments for Unity Catalog discoverability.
- Avoid real brands, copyrighted characters, real people, or licensed content in synthetic assets.

### Synthetic Image Content

For demo reliability, generate safe placeholder marketing imagery with deterministic programmatic rendering:

- Abstract sports/event hero
- Family co-viewing tile
- Premium upgrade banner
- Winback offer social unit
- Mobile-first app tile
- Newsletter banner
- Streaming content slate

Each image should visually encode:

- Segment label
- Placement-safe composition
- Aspect ratio
- Color treatment
- Minimal generated headline or placeholder text
- Metadata ID embedded only when useful for debugging

Implementation options:

- Phase 1: Python image generator using Pillow or a lightweight rendering library in a Databricks Job. This guarantees reproducible files without external model dependencies.
- Phase 2: Optional image generation/editing model integration behind a service abstraction. Store outputs using the same volume and table contracts.

### Generated Records

Recommended demo seed counts:

- 8 audience cohorts
- 20 base assets
- 5 placement templates
- 4 variants per cohort-placement pair for the primary demo campaign
- 160 generated/adapted image variants total
- 1,000 synthetic audience panel members
- 4,000 to 8,000 synthetic evaluation rows depending on panel sampling

## Vector Search and Retrieval

Create a Databricks Vector Search endpoint and Delta Sync index over `gold_buyside_asset_search_corpus`.

Recommended endpoint:

- `creative-asset-search-${bundle.target}`
- Type: `STANDARD` for low-latency demo search

Recommended index:

- `${var.catalog}.${var.schema}.creative_asset_search_index`
- Primary key: `asset_id`
- Embedding source column: `search_text`
- Embedding endpoint: `databricks-gte-large-en`
- Pipeline type: `TRIGGERED` for demo control; `CONTINUOUS` can be considered later

Search behavior:

- Use semantic search for natural-language prompts.
- Use hybrid search when the query contains exact placement, campaign, title, region, or rights terms.
- Always apply filters for asset type, status, approved channel, approved region, and date eligibility before surfacing candidates.

## AI and Model Serving

### Required Serving Boundaries

Use environment variables so the app can switch endpoint-backed creative workflows without code changes:

- `CREATIVE_GENERATION_MODE=model_endpoint|external`
- `CREATIVE_MODEL_ENDPOINT=databricks-gpt-5-mini`
- `CREATIVE_POLICY_MODEL_ENDPOINT=databricks-gpt-5-mini`
- `CREATIVE_JUDGE_MODEL_ENDPOINT=databricks-gpt-5-mini`
- `VISION_METADATA_ENDPOINT`
- `EMBEDDING_ENDPOINT=databricks-gte-large-en`

### Model Usage

Use Databricks Foundation Model APIs or Model Serving endpoints for:

- Captioning and visual metadata extraction from generated images.
- Policy and brand checks requiring multimodal inspection.
- Synthetic audience judging.
- Prompt refinement and generation request normalization.

Use Databricks AI Functions where they fit:

- `ai_extract` for flat metadata extraction.
- `ai_classify` for fixed-label policy routing.
- `ai_similarity` for duplicate or near-duplicate creative detection.
- `ai_query` only for multimodal image inspection, custom endpoints, or structured nested JSON outputs.

For actual image generation/editing, the spec should not assume a specific vendor. The app should call an internal abstraction that can later map to Adobe Firefly, Runway, a custom model serving endpoint, or another approved creative AI service.

## API Enhancements

Add FastAPI endpoints under `my_project/app/main.py`:

- `GET /api/audience-traits`
- `GET /api/creative-assets/search`
- `POST /api/creative-generation/requests`
- `GET /api/creative-generation/requests/{request_id}`
- `GET /api/creative-generation/requests/{request_id}/variants`
- `POST /api/creative-variants/{creative_asset_id}/adapt`
- `GET /api/creative-variants/{creative_asset_id}/lineage`
- `GET /api/creative-variants/{creative_asset_id}/policy-checks`
- `POST /api/creative-variants/{creative_asset_id}/policy-checks/run`
- `POST /api/synthetic-evaluations/run`
- `GET /api/synthetic-evaluations`
- `POST /api/activation-exports`
- `GET /api/feedback`

The app should continue to support CSV/demo fallback, but the new creative workflow should prefer Databricks tables and UC volume URIs.

## Databricks App Configuration

Update `my_project/app.yaml` to use Databricks App resources instead of hardcoded resource IDs for workspace deployment:

```yaml
command:
  - uvicorn
  - app.main:app
  - --host
  - 0.0.0.0
  - --port
  - "8000"

env:
  - name: APP_DATA_SOURCE
    value: databricks
  - name: DATABRICKS_WAREHOUSE_ID
    valueFrom: sql-warehouse
  - name: CREATIVE_ASSET_VOLUME
    valueFrom: creative-assets-volume
  - name: CREATIVE_VECTOR_INDEX
    valueFrom: creative-search-index
  - name: CREATIVE_GENERATION_MODE
    value: model_endpoint
  - name: CREATIVE_MODEL_ENDPOINT
    value: databricks-gpt-5-mini
  - name: CREATIVE_POLICY_MODEL_ENDPOINT
    value: databricks-gpt-5-mini
  - name: CREATIVE_JUDGE_MODEL_ENDPOINT
    value: databricks-gpt-5-mini
  - name: PIPELINE_CATALOG
    value: ${var.catalog}
  - name: PIPELINE_SCHEMA
    value: ${var.schema}
```

Note: Databricks App `app.yaml` does not interpolate bundle variables directly in all contexts today. If interpolation is not supported in the current CLI/app runtime path, generate environment-specific `app.yaml` values during deployment or keep catalog/schema as literal dev/prod values in separate targets.

## Bundle and Deployment Plan

Use the existing Databricks workspace targeted by local Databricks CLI credentials. Do not store tokens in bundle files, app code, or committed `.env` files.

### Root Data Bundle

Add resources:

- `resources/creative_assets_volume.yml`
- `resources/creative_workflow_pipeline.yml`
- `resources/creative_generation_jobs.yml`

Add pipeline/source files:

- `pipelines/creative_asset_library.py`
- `pipelines/creative_generation_workflow.py`
- `pipelines/creative_policy_checks.py`
- `pipelines/synthetic_audience_evaluation.py`
- `scripts/generate_synthetic_creative_images.py`
- `scripts/setup_vector_search_index.py`

Deploy:

```bash
set -a; source .env; set +a
databricks bundle validate -t dev
databricks bundle deploy -t dev
databricks bundle run buyside_data_foundation -t dev
databricks bundle run creative_synthetic_image_generation -t dev
databricks bundle run creative_policy_and_eval_refresh -t dev
```

### App Bundle

Update `my_project/resources/creative_command_center.app.yml` only if source paths or app names change.

Deploy:

```bash
cd my_project
npm ci
npm run build
set -a; source ../.env; set +a
databricks bundle validate -t dev
databricks bundle deploy -t dev
databricks bundle run creative_command_center -t dev
```

Post-deployment checks:

- App starts successfully.
- `/api/backend-tables` reports `databricks_sql` for workflow tables.
- Creative Studio loads thumbnails from UC volume-backed paths or app proxy endpoints.
- Vector search returns governed base assets with rights filters applied.
- Synthetic evaluation rankings appear for at least one brief, segment, and placement.
- Activation export creates rows in `gold_buyside_activation_export`.

## Implementation Phases

### Phase 1 - Demo-Ready Image Workflow

Goal: make the transcript workflow visible end to end with synthetic but governed data.

Tasks:

1. Move `Markets` out of the main flow and add `Creative Studio` plus `Evaluation`.
2. Create UC volume and synthetic image generation job.
3. Create base asset, rights profile, search corpus, generation request, variant, lineage, policy, synthetic panel, evaluation, and activation export tables.
4. Create Vector Search endpoint/index setup script.
5. Add API endpoints for search, generation request creation, variants, lineage, checks, and evaluation.
6. Render synthetic thumbnails and variants in the app.
7. Rank 3 to 5 variants for a selected audience and placement.
8. Deploy to Databricks workspace through bundles.

Acceptance criteria:

- At least 20 synthetic base image assets exist in UC volume and Delta metadata.
- At least 100 generated/adapted image variants exist for demo briefs and audiences.
- Search returns rights-eligible assets for a chosen segment and placement.
- A generation request creates or retrieves 3 to 5 variants.
- Each variant has lineage back to brief, audience, request, base asset if applicable, prompt, model/mode, and transformations.
- Each variant has policy/right/safety check rows.
- Each variant has synthetic audience scores and a rank.
- One approved variant can be exported to a simulated downstream system.

### Phase 2 - Model-Backed Creative Generation and Editing

Goal: replace or supplement synthetic rendering with real image generation/editing services.

Tasks:

1. Add `CREATIVE_GENERATION_MODE=model_endpoint`.
2. Implement serving endpoint or external service adapter.
3. Store request/response payload hashes, model versions, and output assets.
4. Add inpainting/outpainting/crop-safe-area controls.
5. Add reviewer workflow for Pending Review, Approved, Rejected, and Blocked.

Acceptance criteria:

- Model-backed requests produce assets using the same storage and metadata contracts.
- The same policy, lineage, and evaluation pipelines work for model outputs.
- Failed model requests are logged without corrupting workflow state.

### Phase 3 - Video Support

Goal: extend the same workflow to video once image flow is stable.

Tasks:

1. Support video metadata and preview thumbnails.
2. Add opening-frame swap, crop/reframe, duration trim/extend, and alternate edit records.
3. Add video-specific policy checks for talent/IP, region, captions, and safety.
4. Add video synthetic evaluation rubric.

Acceptance criteria:

- Video assets can be searched, adapted, scored, and exported.
- Lineage captures all video transformation steps.

### Phase 4 - Continuous Improvement and Genie

Goal: close the loop from synthetic prediction to real performance.

Tasks:

1. Create feedback ingestion from activation performance.
2. Compare synthetic scores to actual CTR, dwell, conversion, and subscription starts.
3. Generate creative pattern summaries and prompt improvement suggestions.
4. Create or update Genie Space over workflow tables for Ask AI.
5. Add Ask AI actions for "why did this variant win?", "what prompt produced this?", and "which rights checks blocked activation?".

Acceptance criteria:

- Feedback rows link to activated creatives and synthetic predictions.
- App surfaces prediction error and learning summaries.
- Ask AI answers over governed tables instead of hardcoded keyword routing.

## File-Level Work Plan

Root bundle:

- Modify `databricks.yml` to include new resource files and variables for volume, vector endpoint, and optional serving endpoints.
- Add `resources/creative_assets_volume.yml`.
- Add `resources/creative_workflow_pipeline.yml`.
- Add `resources/creative_generation_jobs.yml`.
- Add `pipelines/creative_asset_library.py`.
- Add `pipelines/creative_generation_workflow.py`.
- Add `pipelines/creative_policy_checks.py`.
- Add `pipelines/synthetic_audience_evaluation.py`.
- Add `scripts/generate_synthetic_creative_images.py`.
- Add `scripts/setup_vector_search_index.py`.

App bundle:

- Modify `my_project/app.yaml` to use production FastAPI command and resource `valueFrom` where available.
- Modify `my_project/app/main.py` for new endpoints and Databricks-backed loaders.
- Modify `my_project/src/App.tsx` navigation and views.
- Add frontend components under `my_project/src/components/` if the single-file app becomes too large.
- Update `my_project/README.md` and `my_project/SETUP.md` with Databricks table and app resource requirements.

Sample data fallback:

- Add CSV fallback files only for small UI smoke tests:
  - `creative_assets.csv`
  - `generation_requests.csv`
  - `creative_variants.csv`
  - `policy_checks.csv`
  - `synthetic_evaluations.csv`
  - `lineage_edges.csv`
- Do not store synthetic image binaries in `sample_data`; store them in UC volume for deployed demo or generate local thumbnails only for development.

## Governance and Security Requirements

- Never hardcode Databricks tokens, warehouse IDs, model endpoint credentials, or external API keys.
- Use Databricks App resources and `valueFrom` for SQL warehouse, volume, serving endpoint, vector search index, and Genie Space references.
- Use Unity Catalog tables and volumes for all generated and modified creative assets.
- Store only synthetic audience personas; do not write real PII into evaluation tables.
- Include policy version, model version, prompt version, and evidence fields for auditability.
- Rights checks must be hard gates for region, channel, date window, and license scope.
- Generated assets with failed or blocked checks must not be eligible for activation export.

## Open Questions

1. Confirm the Unity Catalog and schema for synthetic image data generation. The repo defaults to `cme_outcomes_uswest.lakefoundry`, but generation should not run until the target is explicitly approved.
2. Which creative generation/editing service should be treated as the production integration: custom Databricks Model Serving endpoint, Adobe Firefly, Runway, another provider, or synthetic-only for the demo?
3. Should the first demo support only images, or should video metadata appear as disabled/coming-soon UI controls?
4. Which downstream system should activation simulate first: AEM, Adobe Target, CMS, DAM, or onsite personalization?
5. Should the Ask AI path be implemented through Genie Space first, or remain a lightweight API response until the data model stabilizes?
6. Are brand guideline rules available as structured data, documents, or only prompt text?

## Definition of Done

- The deployed Databricks App demonstrates the revised workflow from brief and audience to creative search/generation, adaptation, checks, synthetic evaluation, selection, and activation export.
- Generated image assets are actual files in Unity Catalog volume storage, not only table rows.
- Every generated/adapted asset has lineage, policy checks, and synthetic evaluation records.
- The app reads Databricks tables by default in deployed mode.
- CSV fallback remains available for local smoke tests only.
- Bundle deployment and run commands are documented and repeatable for the Databricks dev workspace.
