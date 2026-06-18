# June 1 Creative Gen Demo Enhancements - Implementation Spec

Status: proposed
Date: 2026-06-02

## Source Inputs

- Gemini notes PDF: `/Users/pragathi.sharma/Downloads/Slalom _ Databricks - Creative Gen Demo Walkthrough - 2026_06_01 14_00 PDT - Notes by Gemini.pdf`
- Speaker-attributed transcript PDF: `/Users/pragathi.sharma/Downloads/Slalom x Databricks — Creative Gen Demo Walkthrough (Transcript, attributed).pdf`
- Meeting: Slalom | Databricks - Creative Gen Demo Walkthrough, June 1, 2026 at 14:00 PDT
- Current app: `my_project/` React + FastAPI Databricks App
- Prior implemented spec: `docs/specs/spec_id=2026-05-31-transcript-app-review-updates/implementation_plan.md`
- Current backend entry point: `my_project/app/main.py`
- Current frontend entry point: `my_project/src/App.tsx`

## Summary

The June 1 Gemini notes confirm the current Creative Command Center flow is directionally ready, but the demo needs additional features before the Data and AI summit:

- Brand guidelines should be visible and usable as synthetic reference files during creative generation and policy review.
- Creative Studio should let users choose and compare generation models instead of relying on one fixed backend endpoint.
- Transformation, evaluation, and lineage surfaces should clearly show which generation model, image source/model, policy model, and judge model were used.
- Evaluation scoring should be explainable enough to discuss model settings, prompts, and score weightage.
- Genie should be verified against the demo dataset and enriched with demographic and purchase data so it can answer performance questions by groups such as millennials, boomers, and Midwest audiences.
- Video support should be added for personalized text-overlay end cards on 15-second spots.
- Architecture/talk-track support should clearly explain how an unstructured brief maps to audience graph, identity, reach, match rate, LTV, governed asset retrieval, generation, evaluation, activation, lineage, and learning.

This spec is a delta from the implemented May 31 updates. It does not replace the existing Briefs, Audiences, Creative Studio, Evaluation Gate, Activation, Ask AI, or Architecture views.

## Notes-Derived Decisions

1. Add brand guidelines, including dos and donts, typography, color, and compliance requirements, as synthetic reference artifacts.
2. Add a generation model dropdown in Creative Studio so users can select different models for creative variants.
3. Track model usage in the transformation, evaluation, and lineage surfaces.
4. Review and expose scoring model settings, prompt context, and weightage for channel scoring.
5. Verify Genie functionality against the provided dataset.
6. Add synthetic demographic and purchase data to improve Genie demo questions.
7. Expand the creative workflow to include video end-card personalization for 15-second videos.
8. Preserve the Databricks technical architecture: Delta tables in Lake Foundry, Unity Catalog, vector index endpoint, React app, FastAPI backend, and Databricks platform services.
9. Use one generated CME Streaming brand guideline profile for the summit demo, not one profile per brief.
10. Show 2 to 3 curated model options in the Creative Studio model dropdown.
11. Generate an actual short MP4 for video end-card preview.
12. Move channel scoring and score explanations behind backend APIs instead of keeping the projection logic only in the frontend.
13. Add the exact Genie question from the transcript to the live demo question set: `Which of these creatives is most likely to resonate with boomers in the Midwest?`
14. Make image lineage explicit enough to show source asset, final asset, model used, and transformation steps.
15. Add a brief-to-audience data-flow explanation for unstructured brief intake, audience graph, identity source, reach, match, LTV, and allowed channels.

## Current Baseline

The repo already includes several relevant capabilities:

- `my_project/app/main.py` exposes model status fields:
  - `CREATIVE_MODEL_ENDPOINT`
  - `CREATIVE_IMAGE_MODEL`
  - `CREATIVE_POLICY_MODEL_ENDPOINT`
  - `CREATIVE_JUDGE_MODEL_ENDPOINT`
- Creative Studio already supports:
  - brief and audience selection
  - governed asset retrieval
  - image variant generation
  - image adaptation and transformation ledger
  - variant approval
  - visible creative endpoint and image model/source labels
- Evaluation Gate already supports:
  - policy readiness checks
  - synthetic audience scores
  - channel-by-variant matrix
  - recommended channel override
  - multi-channel activation
- Activation already supports lineage tracing from activation back to creative, generation request, brief, audience, source asset, transformations, checks, and evaluations.
- Ask AI already supports Genie-first behavior with governed fallback answers and curated prompts.

Key gaps versus the June 1 notes:

- No first-class brand guideline entity, API, or UI panel.
- Creative generation request payload has no user-selected generation model.
- Existing model labels are informational; users cannot compare model outputs.
- Score calculations are not surfaced with rubric weights, prompts, or model settings.
- Genie has curated workflow questions but does not yet focus on demographic and purchase-analysis questions.
- No demo data tables for demographic cohorts and purchase signals.
- No video end-card workflow, preview, payload type, or storage contract.
- Architecture/talk-track surfaces do not yet explicitly explain how a PDF/PowerPoint brief becomes audience segments through audience graph, identity, reach, match, LTV, and channel eligibility.
- Lineage currently records transformations, but the transcript asks for the source-to-final image story to be obvious, ideally with source and final previews plus model and edit steps.

## Priority Updates

### P0 - Brand Guidelines Reference

Add a brand guideline surface in Creative Studio and use the selected guideline as generation and policy context.

Target behavior:

- Creative Studio shows a `Brand guidelines` panel near the generation brief.
- The demo uses one generated global `CME Streaming` guideline profile across all briefs.
- The panel displays:
  - brand name
  - guideline version
  - approved colors
  - typography rules
  - required language
  - dos
  - donts
  - restricted claims
  - regional/compliance notes
- The generation request includes the selected guideline ID and a compact guideline summary.
- Policy checks reference the guideline version in their evidence.
- The Architecture view lists brand guidelines as a governed artifact.

Implementation notes:

- Add a backend fallback dataset and optional CSV loader for `brand_guidelines`.
- Add `GET /api/brand-guidelines`.
- Add `brand_guideline_id` to `CreativeGenerationRequestIn`.
- Include guideline context in `_invoke_model_endpoint(...)` request payload.
- Add `brand_guideline_id` and `brand_guideline_version` to `generation_params_json`.
- Include guideline evidence in policy check rows where possible.
- Generate one synthetic CME Streaming guideline record in `main.py` or `my_project/sample_data/brand_guidelines.csv`.
- Do not add per-brief guideline management for the summit demo.

Suggested data columns:

- `guideline_id`
- `brand_name`
- `guideline_version`
- `status`
- `approved_color_palette_json`
- `typography_rules_json`
- `required_language_json`
- `dos_json`
- `donts_json`
- `restricted_claims_json`
- `regional_constraints_json`
- `compliance_notes`
- `created_ts`
- `updated_ts`

Acceptance criteria:

- User can view guidelines before generating variants.
- Generated variants record which guideline was used.
- Policy evidence shows the guideline version or states that no guideline was selected.
- Demo does not imply live brand-document ingestion unless that is actually configured.

### P0 - Generation Model Selector

Add a selectable model dropdown to Creative Studio and persist the selected model through generation, transformations, and lineage.

Target behavior:

- Creative Studio includes a `Generation model` dropdown.
- The summit demo shows 2 to 3 curated options:
  - `GPT-5 Mini - Balanced`: default creative planning/generation endpoint option used in the current demo flow.
  - `Kimi 2 - Model Compare`: alternate model option requested in the transcript for side-by-side output comparison.
  - `Runway Gen-3 - Video End Card`: video-capable option used when `Video end card` mode is selected.
- Model options include display name, endpoint/model ID, modality, cost tier, latency tier, and demo notes.
- Selecting a model changes the generation request payload.
- Generated variant cards show the selected model.
- Transformation ledger shows the tool/model used.
- Activation lineage shows:
  - generation endpoint/model
  - image model/source
  - policy model
  - judge model
  - model invocation status when available

Implementation notes:

- Add `GET /api/generation-models`.
- Add these fields to `CreativeGenerationRequestIn`:
  - `generation_model_id`
  - `image_model_id`
  - `compare_model_ids`
- Resolve model IDs to endpoint names server-side. Do not trust arbitrary endpoint names from the browser.
- Use the resolved endpoint instead of the global `CREATIVE_MODEL_ENDPOINT` inside `create_creative_generation_request`.
- Preserve the existing environment variable defaults for backward compatibility.
- Store selected model metadata in:
  - generation request
  - creative variant `generation_model`
  - variant `generation_params_json`
  - transformation `tool_or_model`
  - lineage metadata

Suggested model option fields:

- `model_id`
- `display_name`
- `endpoint_name`
- `provider`
- `modality` (`image`, `video`, `text_orchestration`, `judge`)
- `status`
- `cost_tier`
- `latency_tier`
- `recommended_use`
- `is_default`

Acceptance criteria:

- User can generate variants with at least two selectable image-generation/model-source options, with a third video-capable option visible when video mode is available.
- Variant cards make the selected model visible.
- Ask AI can answer which models produced the current variants.
- Existing environment-variable behavior still works if no model is selected.

### P0 - Evaluation Score Explainability

Expose enough scoring context to explain how channel scores and recommendations are calculated.

Target behavior:

- Evaluation Gate keeps the channel-by-variant matrix.
- Each row has a score details control or drawer.
- Score details show:
  - judge model endpoint
  - score rubric version
  - weighted criteria
  - normalized criterion scores
  - final weighted score
  - channel recommendation reason
  - prompt template or prompt summary
  - model settings used for the evaluation
- Architecture view includes the evaluation rubric and judge model as demo artifacts.

Implementation notes:

- Move channel projection and recommendation logic from frontend-only helpers into backend demo logic.
- Frontend should render backend-provided channel scores, projected CTR, projected CPM, projected conversions, recommended channel, and explanation IDs.
- Add a deterministic scoring config for demo mode so the backend can explain the current scores.
- Add `GET /api/evaluation-rubrics`.
- Add `GET /api/synthetic-evaluations/{evaluation_id}/score-explanation`.
- Add `GET /api/evaluation-channel-matrix` or equivalent to return backend-computed channel-by-variant projections.
- If using existing synthetic evaluation rows only, generate explanations from the row values plus a static rubric.

Suggested rubric fields:

- `rubric_id`
- `rubric_version`
- `judge_model`
- `prompt_template_name`
- `criteria_json`
- `weights_json`
- `channel_adjustments_json`
- `created_ts`

Acceptance criteria:

- Presenter can explain why a channel was recommended.
- At least one score details drawer shows weights and model settings.
- The explanation is deterministic for the bundled sample data.
- The frontend no longer owns the authoritative channel recommendation calculation.

### P0 - Genie Verification And Demo Data

Verify Genie behavior and add synthetic demographic and purchase signals that support audience and performance questions.

Target behavior:

- Ask AI can answer or route demo questions such as:
  - `How did creative variants perform for millennials versus boomers?`
  - `Which audience groups show the strongest purchase intent?`
  - `Which approved variants perform best for sports fans with high purchase frequency?`
  - `Where do synthetic predictions differ from observed purchase/conversion behavior?`
- Recommended Genie-live questions for the summit demo:
  - `Which of these creatives is most likely to resonate with boomers in the Midwest?`
  - `How is creative X performing against audience Y?`
  - `How did creative variants perform for millennials versus boomers?`
  - `Which audience groups show the strongest purchase intent by channel?`
  - `Which approved creative should we activate for high-intent sports fans, and why?`
  - `Where did observed purchase or conversion behavior differ most from synthetic predictions?`
  - `Which generation model produced the strongest approved variants for each demographic group?`
- Governed fallback should remain available for operational workflow questions, missing-data cases, and any Genie failure.
- If Genie fails, the governed fallback response should still answer from the same synthetic tables.
- Suggested Ask AI prompts include demographic and purchase examples.

Implementation notes:

- Add sample data and fallback rows for demographic and purchase signals.
- Add those rows to backend data loading and `/api/backend-tables`.
- Update `GENIE_RECOMMENDED_QUESTIONS_FALLBACK`.
- Extend `_answer_with_governed_fallback(...)` to cover demographic and purchase-intent questions.
- If the deployed Genie space is maintained through bundle resources, update the Genie instructions and sample questions in the bundle resource.

Suggested data columns:

`audience_demographics`:

- `cohort_id`
- `generation`
- `age_min`
- `age_max`
- `region`
- `household_income_band`
- `device_preference`
- `subscription_status`
- `population_share`

`purchase_signals`:

- `signal_id`
- `cohort_id`
- `generation`
- `category`
- `purchase_frequency`
- `avg_order_value`
- `purchase_intent_score`
- `subscription_start_rate`
- `conversion_rate`
- `last_observed_ts`

Acceptance criteria:

- Ask AI can answer at least three demographic/purchase questions in demo mode.
- Genie is expected to answer the recommended live questions above when configured, including the exact boomers-in-the-Midwest resonance question from the transcript.
- Genie recommended questions include demographic and purchase prompts.
- Fallback answers are table-backed and do not fabricate missing data.

### P1 - Multi-Model Comparison

Let users compare outputs from different generation models as a focused extension of the P0 model selector.

Target behavior:

- Creative Studio supports a `Compare models` mode.
- User can select 2 or 3 models and generate a comparable variant set.
- Variant cards group or label outputs by model.
- Comparison summary shows:
  - model
  - variant count
  - average policy score
  - average synthetic score
  - estimated cost tier
  - latency tier
  - approval count
- Ask AI can summarize model performance across current variants.

Implementation notes:

- Keep P0 model selector simple; add comparison mode after selected-model generation is stable.
- A single request can create variants across multiple models, or the frontend can issue one request per model and group the result.
- Store `comparison_group_id` in generation request and variant metadata.

Acceptance criteria:

- Presenter can generate or display side-by-side variants from at least two model options.
- Model comparison includes quality/evaluation context, not just labels.

### P1 - Video End-Card Personalization

Add demo-level support for personalized text overlay end cards for 15-second video spots.

Target behavior:

- Creative Studio has a content mode selector with `Image` and `Video end card`.
- In video mode, user selects:
  - brief
  - audience
  - base video/spot
  - end-card message
  - call to action
  - model/source
  - target channel
- The app creates end-card variants with:
  - `asset_type = Video`
  - `content_type = video_endcard`
  - `duration_sec = 15`
  - end-card overlay text
  - source video asset
  - end-card timestamp or final-frame range
  - generation model and transformation metadata
- The summit demo target is an actual generated MP4 preview, not a simulated card.
- Activation payload includes video/end-card metadata.

Implementation notes:

- Extend `CreativeGenerationRequestIn.content_type` to accept `video_endcard`.
- Add base video assets to governed retrieval data.
- Extend placement specs or add video placement specs for:
  - `ctv_15s`
  - `youtube_15s`
  - `social_video_15s`
- Add a video end-card transformation type:
  - `end_card_text_overlay`
  - `cta_overlay`
  - `final_frame_template`
- Reuse existing variant, transformation, policy, synthetic evaluation, and lineage tables where possible.
- Generate a short playable MP4 from synthetic/demo assets and the selected end-card text.
- Store the MP4 under the creative assets volume or local demo fallback path and expose it through the app preview.
- Keep real external generative video integration out of scope unless the endpoint is already configured.

Suggested additional metadata:

- `video_source_asset_id`
- `end_card_text`
- `cta_text`
- `overlay_start_sec`
- `overlay_end_sec`
- `template_id`
- `duration_sec`
- `video_preview_uri`
- `mp4_storage_uri`
- `mp4_duration_sec`

Acceptance criteria:

- User can create at least one personalized video end-card variant in demo mode.
- The video preview is a playable MP4.
- Video variant appears in the transformation ledger and lineage.
- Video variant can pass through Evaluation Gate and Activate flow.
- UI clearly distinguishes generated demo MP4 output from production video-platform delivery.

### P2 - Architecture And Demo Readiness Updates

Update demo support surfaces so the presenter can explain the new features without leaving the app narrative.

Target behavior:

- Architecture view lists:
  - brand guidelines artifact
  - generation model options
  - scoring rubric
  - demographic and purchase signal data
  - video end-card workflow
- Talk Track view includes the updated demo sequence.
- Backend checklist includes whether Genie, model endpoints, and sample datasets are configured.

Acceptance criteria:

- Presenter can explain the June 1 additions from the app.
- Resource names, endpoints, and fallback status match backend configuration.

## API Changes

Add:

- `GET /api/brand-guidelines`
- `GET /api/generation-models`
- `GET /api/evaluation-rubrics`
- `GET /api/evaluation-channel-matrix`
- `GET /api/synthetic-evaluations/{evaluation_id}/score-explanation`
- `GET /api/creative-variants/{creative_asset_id}/video-preview`

Extend:

- `POST /api/creative-generation/requests`
  - add `brand_guideline_id`
  - add `generation_model_id`
  - add `image_model_id`
  - add `compare_model_ids`
  - allow `content_type = image | video_endcard`
- `GET /api/model-status`
  - include available model count
  - include default model IDs
  - include scoring rubric version
  - include brand guideline source status
  - include video end-card support status
- `POST /api/activation-exports`
  - preserve existing image payload behavior
  - include video/end-card metadata when `asset_type = Video` or `content_type = video_endcard`

## Data Additions

Short-term demo data can live in backend fallback constants or `my_project/sample_data/*.csv`.

Recommended table names for Databricks-backed mode:

- `gold_buyside_brand_guideline`
- `gold_buyside_generation_model_option`
- `gold_buyside_evaluation_rubric`
- `gold_buyside_channel_score_explanation`
- `gold_buyside_audience_demographic_signal`
- `gold_buyside_purchase_signal`

Recommended extension to existing creative tables:

- `brand_guideline_id`
- `brand_guideline_version`
- `image_model_id`
- `comparison_group_id`
- `content_type`
- `video_source_asset_id`
- `end_card_text`
- `cta_text`
- `overlay_start_sec`
- `overlay_end_sec`
- `template_id`
- `video_preview_uri`
- `mp4_storage_uri`
- `mp4_duration_sec`

## UX Changes

### Creative Studio

Add:

- Brand guidelines panel under generation context.
- Generation model dropdown.
- Optional compare-models toggle.
- Content mode segmented control: `Image` / `Video end card`.
- Video end-card fields when video mode is active.
- Model labels on generated variant cards.
- Guideline version on generated variant details.

Preserve:

- governed asset retrieval
- trait influence panel
- generate variants action
- variant grid
- adaptation workflow
- transformation ledger

### Evaluation Gate

Add:

- Score details drawer per evaluation row.
- Backend-computed channel score matrix.
- Rubric version and judge model label.
- Criterion weights and score contribution.
- Channel recommendation reason.
- Video readiness indicators when a video end-card variant is evaluated.

Preserve:

- channel-by-variant matrix
- recommended channel override
- multi-channel activation
- policy block handling

### Ask AI

Add:

- Demographic and purchase-intent suggested prompts.
- The recommended Genie-live questions from the Genie Verification section.
- Fallback answers for demographic and purchase questions.
- Model comparison prompts once multi-model comparison is available.

### Activation Lineage

Add:

- brand guideline step or metadata
- selected model option metadata
- image model/source metadata
- source asset preview and final asset preview
- transformation steps between source and final asset
- scoring rubric metadata
- video source and end-card overlay metadata for video variants

### Architecture / Talk Track

Add:

- Brief intake data-flow narrative:
  - source brief can be unstructured input such as PDF or PowerPoint
  - target audience is interpreted from the brief
  - audience lens maps the brief to audience graph and identity source
  - audience rows expose reach, match rate, LTV, allowed channels, and eligibility
  - selected audience traits drive governed retrieval, generation, policy review, channel scoring, activation, and learning
- Lake Foundry / Databricks data-flow narrative:
  - bronze-to-silver-to-gold pipeline
  - Delta tables in Lake Foundry
  - Unity Catalog governance
  - Vector Search endpoint feeding governed asset retrieval into the React app
  - Genie and model endpoints supporting decisioning and generation

## Recommended Implementation Order

1. Add brand guideline fallback data, API, UI panel, and generation payload fields.
2. Add generation model options API and Creative Studio dropdown.
3. Persist selected model and guideline metadata into variants, transformations, and lineage.
4. Move channel scoring behind backend API and add score explanation endpoint/UI drawer.
5. Add demographic and purchase demo data plus Ask AI fallback coverage.
6. Add video end-card mode with actual generated MP4 preview and lineage support.
7. Update Architecture/Talk Track, brief-to-audience data-flow explanation, and backend checklist.

## Testing Plan

Backend:

- Add unit tests for new endpoints returning fallback data.
- Add tests that `POST /api/creative-generation/requests` accepts selected model and guideline fields.
- Add tests that invalid model IDs are rejected or safely defaulted.
- Add tests for backend channel matrix score calculations.
- Add tests for score explanation payload shape.
- Add tests for Ask AI demographic and purchase fallback questions.
- Add tests that video end-card requests create variants with expected metadata and MP4 preview URI.

Frontend:

- Run TypeScript build.
- Verify Creative Studio renders:
  - brand guidelines panel
  - model dropdown
  - image mode
  - video end-card mode
  - generated variant model labels
- Verify Evaluation Gate score details drawer.
- Verify Activation lineage includes guideline/model/video metadata plus source and final asset previews.

Manual demo checks:

- Generate image variants with default model.
- Generate image variants with alternate model.
- Show model provenance on variant card and lineage.
- Explain channel score weights from score details.
- Ask the recommended Genie-live demographic, purchase, prediction-gap, and model-comparison questions.
- Ask the exact transcript question: `Which of these creatives is most likely to resonate with boomers in the Midwest?`
- Create video end-card MP4 variant and activate it.

## Out Of Scope

- Real production brand-document ingestion.
- External production video-platform rendering and trafficking.
- Live external activation APIs for video platforms.
- Model cost accounting beyond tier labels.
- Re-training or optimizing the scoring model.

## Transcript Coverage Checklist

- Executive dashboard: already covered by current baseline and May 31 implemented spec; preserve spend, conversions, impressions, quality index, channel allocation, trend, quality gate, and operational feed views.
- Brief management: already covered by current baseline and May 31 implemented spec; preserve brief list, status, details, target audience, budget, and owner context.
- Brief-to-audience data flow: add Architecture/Talk Track explanation for unstructured brief input, audience graph, identity source, reach, match rate, LTV, and channel eligibility.
- Audience page: already covered by current baseline and May 31 implemented spec; preserve selected audience picker, reach, match, LTV, audience type, and trait inspection.
- Creative Studio: preserve governed categories, approved prior assets/templates, asset search, brief/audience selection, local market personalization, variant generation, adaptation, resize/crop/basic transformations, and approval.
- Brand guidelines: add one generated global CME Streaming guideline profile with visible dos, donts, typography, colors, required language, restricted claims, and policy evidence.
- Evaluation gate: move channel scoring behind backend API, expose brand fit, compliance, image safety, rights, score weights, prompt/model settings, and recommended channel rationale.
- Genie: include the exact transcript question `Which of these creatives is most likely to resonate with boomers in the Midwest?`, plus `How is creative X performing against audience Y?`, demographic questions, and purchase-intent questions.
- Activation control: preserve new submissions, live delivery metrics, draft/submitted/running statuses, Activate flow, and trace capability.
- Lineage and provenance: make model used, source asset, final asset, source/final previews, transformation steps, approval, generation request, brief, audience, evaluation, and activation payload visible.
- Model comparison: show GPT-5 Mini and Kimi 2 as the transcript-requested image/creative model comparison options, with Runway Gen-3 for video end cards.
- Architecture: preserve Lake Foundry, Delta tables, bronze/silver/gold pipeline, Vector Search endpoint, Unity Catalog, React app, Genie, and model endpoint narrative.
- Video: add a 15-second end-card workflow with actual generated MP4 preview and configurable CTA text overlay.
- Meeting logistics: Craig sending the recording and scheduling the Wednesday/Thursday follow-up are non-product follow-ups and are not implementation requirements.

## Resolved Demo Decisions

1. Model dropdown shows 2 to 3 curated options: `GPT-5 Mini - Balanced`, `Kimi 2 - Model Compare`, and `Runway Gen-3 - Video End Card`.
2. Brand guidelines use one generated global `CME Streaming` profile for the demo.
3. Video end-card preview is an actual generated short MP4.
4. Scoring explanations and channel projections are computed behind backend APIs.
5. Genie should answer these questions live when configured:
   - `Which of these creatives is most likely to resonate with boomers in the Midwest?`
   - `How is creative X performing against audience Y?`
   - `How did creative variants perform for millennials versus boomers?`
   - `Which audience groups show the strongest purchase intent by channel?`
   - `Which approved creative should we activate for high-intent sports fans, and why?`
   - `Where did observed purchase or conversion behavior differ most from synthetic predictions?`
   - `Which generation model produced the strongest approved variants for each demographic group?`
6. Governed fallback remains available for the same demographic and purchase questions when Genie is unavailable, and for operational workflow questions such as missing checks, activation readiness, lineage, and table-backed model provenance.
7. The architecture/talk track must cover the transcript question about data flow from unstructured brief intake to audience graph, identity, reach, match, LTV, governed asset retrieval, generation, evaluation, activation, and learning.

## Definition Of Done

- June 1 Gemini note action items are represented in the app or clearly scoped as P1/P2.
- New features work in CSV/sample-data mode.
- Databricks-backed mode remains compatible with existing configuration.
- User-facing labels do not imply live image/video generation when the app is using governed seed assets or generated demo MP4 output.
- Video end-card preview is a playable generated MP4 for the summit demo.
- The presenter can complete this demo sequence:
  1. Select a brief and audience.
  2. Review brand guidelines.
  3. Choose a generation model.
  4. Generate image variants.
  5. Compare or inspect model provenance.
  6. Review evaluation score explanation.
  7. Ask Genie/Ask AI the boomers-in-the-Midwest resonance question plus demographics or purchase intent.
  8. Create a personalized 15-second video end-card variant.
  9. Activate an approved winner.
  10. Trace the activation back to brief, audience, guideline, source asset, model, transformations, evaluation, and activation payload.
