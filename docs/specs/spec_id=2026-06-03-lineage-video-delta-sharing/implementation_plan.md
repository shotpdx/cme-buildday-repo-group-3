# June 3 Lineage, Video Variants, and Delta Sharing - Implementation Spec

Status: proposed
Date: 2026-06-05

## Source Inputs

- Meeting transcript: June 3, 2026 recording between Pragathi Sharma and Craig Ng
- Prior implemented spec: `docs/specs/spec_id=2026-06-01-gemini-creative-gen-demo-enhancements/implementation_plan.md`
- Current app: `my_project/` React + FastAPI Databricks App
- Current backend entry point: `my_project/app/main.py`
- Current frontend entry point: `my_project/src/App.tsx`

## Summary

The June 3 meeting confirmed the video generation and brand guidelines features are directionally ready. The discussion identified three key areas for improvement before the Data and AI summit:

1. Unity Catalog lineage needs to capture volume-to-table provenance so customers can trace how approved images were derived from base assets.
2. Video variant generation is working but needs horizontal and vertical orientation options with distinct seed files.
3. Delta Sharing should be tested as the mechanism to ship the demo to customer workspaces.

Additional UI polish items:
- Score details drawer label should be more business-friendly (e.g., "Evaluation Criteria" instead of "CME Streaming Synthetic Audience Score").
- Lineage modal should show volume paths and model/prompt provenance for auditability.

## Transcript-Derived Decisions

1. Keep video variants simple: only horizontal (16:9) and vertical (9:16) orientations, not many variant styles.
2. Brand guidelines are already added as static data; the capability to upload from a PDF or Volume is a future enhancement.
3. Score details drawer needs label updates to be more user-friendly (e.g., "Evaluation Criteria" or "Audience Score Model").
4. Lineage should be auditable and reproducible: trace from base image to approved image with model, prompt, and transformation steps.
5. Unity Catalog lineage for volumes is path-based (generic path sources), not first-class volume nodes. Volume-to-table writes are captured.
6. Test writing approved images to a Delta table to capture lineage from volume source to table target.
7. Lake Base syncs back to Delta Lake for activation could provide lineage visibility.
8. Delta Sharing is the preferred mechanism to ship demo assets to customer workspaces.
9. The provenance story must answer: "How did we create this? Can we retrace our steps?"
10. Source preview and final preview in lineage modal are confirmed as valuable.
11. Add generation model to transformations and evaluation lineage (in progress).

## Current Baseline

The repo already includes:

- Video variant generation with Image/Video content type toggle
- Video orientation selector (horizontal/vertical)
- Video placement options (ctv_15s, youtube_15s, social_video_15s)
- Demo MP4 files in `my_project/app/video_assets/`
- Brand guidelines API and static data
- Score details endpoint (`/api/synthetic-evaluations/{evaluation_id}/score-explanation`)
- Activation lineage modal with source preview and final preview
- Lake Base instance for persisting user actions

Key gaps versus the June 3 discussion:

- No Unity Catalog lineage capture from volume to table for approved images.
- Score details drawer exists in backend but label needs business-friendly rename.
- Lineage modal does not yet show volume URLs or full provenance chain.
- No Delta Sharing configuration for cross-workspace asset transfer.
- Video seed files need more variety (currently one demo file).

## Priority Updates

### P0 - Unity Catalog Lineage for Approved Images

Capture volume-to-table lineage so approved image provenance is auditable in Unity Catalog.

Target behavior:

- When a variant is approved, write metadata to a Delta table that references the source volume path.
- Unity Catalog lineage graph shows: volume path (source) → approved_creative_assets table (target).
- Lineage is queryable programmatically via Unity Catalog APIs.
- The UI lineage modal embeds the volume URL for the source and final assets.

Implementation notes:

- Create `gold_buyside_approved_creative_asset` Delta table with columns:
  - `approved_asset_id`
  - `source_volume_path`
  - `approved_volume_path`
  - `base_asset_id`
  - `creative_asset_id`
  - `generation_model`
  - `generation_prompt`
  - `transformation_steps_json`
  - `brand_guideline_id`
  - `approved_by`
  - `approved_ts`
- On approval action, write a row to this table with the source and approved paths.
- Unity Catalog will capture lineage from the volume read to the table write.
- Add volume URLs to the lineage modal metadata section.
- Verify lineage appears in Databricks UI Catalog Explorer.

Acceptance criteria:

- Approved variants are written to a Delta table with source volume path.
- Unity Catalog lineage graph shows volume-to-table relationship.
- Lineage can be queried via `GET /api/2.0/lineage-tracking/table-lineage`.
- Lineage modal shows volume URLs for source and final assets.
- Provenance is reproducible: base image, model, prompt, transformations, approved image.

### P0 - Score Details Label Update

Rename score details drawer labels to be business-friendly.

Target behavior:

- The score details drawer header says "Evaluation Criteria" instead of "CME Streaming Synthetic Audience Score".
- Sub-labels are clear: "Judge Model", "Scoring Dimensions", "Channel Recommendation Reason".

Implementation notes:

- Update frontend `ScoreExplanationDrawer` or equivalent component.
- Update backend `_score_explanation_for_evaluation` response labels if needed.
- Keep technical details available but under user-friendly headings.

Acceptance criteria:

- Score details drawer uses business-friendly labels.
- Presenter can explain the evaluation criteria without technical jargon.

### P1 - Video Seed File Variety

Add more video seed files for horizontal and vertical orientations.

Target behavior:

- At least 2-3 horizontal (16:9) seed videos for youtube_15s and ctv_15s placements.
- At least 2-3 vertical (9:16) seed videos for social_video_15s placement.
- Video variants show visual variety based on selected seed.

Implementation notes:

- Add seed MP4 files to `my_project/app/video_assets/seeds/` directory.
- Name files by orientation and category: `horizontal_sports_01.mp4`, `vertical_family_01.mp4`.
- Update `_demo_video_seed_for_variant` to select seeds based on category and orientation.
- Keep total video file size reasonable for bundle deployment.

Acceptance criteria:

- Video generation shows visual variety across seed files.
- Horizontal and vertical orientations have distinct seed pools.
- Video preview plays correctly for each seed.

### P1 - Lineage Modal Volume URL Display

Show volume URLs in the activation lineage modal for full provenance.

Target behavior:

- Lineage modal metadata section shows:
  - `source_volume_url`: Volume path of the base/reference asset
  - `approved_volume_url`: Volume path of the approved variant
  - `generation_model`: Model used for generation
  - `generation_prompt`: Prompt or instructions used
  - `transformation_chain`: Steps from source to final

Implementation notes:

- Extend `/api/activations/{activation_id}/lineage` response to include volume URLs.
- Add `source_volume_url` and `approved_volume_url` to lineage metadata.
- Include generation prompt summary in lineage evidence.
- Update frontend `ActivationLineageModal` to render volume URLs.

Acceptance criteria:

- Lineage modal shows volume paths for source and final assets.
- Provenance chain is complete: base → transformations → model → approved.
- Users can answer "How did we create this?" from the lineage modal.

### P2 - Delta Sharing Configuration

Configure Delta Sharing to transfer demo assets to customer workspaces.

Target behavior:

- Demo tables can be shared via Delta Sharing to external recipients.
- Shared tables include: briefs, audiences, creative assets, variants, evaluations.
- Volumes can be packaged or referenced for cross-workspace access.
- Asset Bundles can be deployed to recipient workspace.

Implementation notes:

- Create a Delta Share in the source workspace.
- Add relevant tables to the share.
- Document the recipient workflow: accept share, mount tables, deploy bundle.
- Test end-to-end sharing with a recipient workspace.
- For volumes, consider: zip and upload, or use external locations.

Acceptance criteria:

- Delta Share is configured with demo tables.
- Recipient can access shared tables in their workspace.
- Asset Bundles deploy successfully in recipient workspace.
- Documentation covers the sharing workflow.

### P2 - Lake Base to Delta Lake Sync for Activation

Explore syncing Lake Base state back to Delta Lake for activation lineage.

Target behavior:

- Approved variants in Lake Base sync to a Delta table for activation workflows.
- Lineage captures the Lake Base → Delta Lake → activation path.
- Reverse ETL pattern enables downstream system integration.

Implementation notes:

- Configure Lake Base table sync to Delta Lake.
- Trigger sync on approval or activation events.
- Verify lineage is captured for the sync operation.
- Document the pattern for customer deployment.

Acceptance criteria:

- Lake Base state syncs to Delta Lake on relevant events.
- Lineage shows Lake Base as a source for activation tables.
- Pattern is documented for replication.

## API Changes

Extend:

- `GET /api/activations/{activation_id}/lineage`
  - add `source_volume_url`
  - add `approved_volume_url`
  - add `generation_prompt_summary`
  - add `transformation_chain`

- `POST /api/creative-variants/{creative_asset_id}/approval`
  - write to `gold_buyside_approved_creative_asset` table
  - include volume paths in the written row

Add:

- `GET /api/approved-creative-assets` - list approved assets with volume provenance

## Data Additions

New table: `gold_buyside_approved_creative_asset`

Columns:
- `approved_asset_id` (string, primary key)
- `source_volume_path` (string)
- `approved_volume_path` (string)
- `base_asset_id` (string)
- `creative_asset_id` (string)
- `variant_id` (string)
- `brief_id` (string)
- `cohort_id` (string)
- `generation_model` (string)
- `generation_model_id` (string)
- `generation_prompt` (string)
- `transformation_steps_json` (string)
- `brand_guideline_id` (string)
- `brand_guideline_version` (string)
- `approved_by` (string)
- `approved_ts` (timestamp)
- `created_ts` (timestamp)

## UX Changes

### Score Details Drawer

Update labels:
- Header: "CME Streaming Synthetic Audience Score" → "Evaluation Criteria"
- "Model used" → "Judge Model"
- Add "Scoring Dimensions" section header
- Add "Recommendation Reason" section header

### Activation Lineage Modal

Add metadata fields:
- Source volume URL
- Approved volume URL
- Generation model and prompt summary
- Transformation chain

### Video Generation

- Ensure visual variety in generated video variants
- Clear labeling of horizontal vs vertical orientation

## Testing Plan

Backend:

- Add test that approval writes to `gold_buyside_approved_creative_asset` table.
- Add test that lineage endpoint returns volume URLs.
- Verify Unity Catalog lineage via API query after approval.
- Test video seed selection returns varied files by orientation.

Frontend:

- Verify score details drawer shows updated labels.
- Verify lineage modal shows volume URLs.
- Verify video variants show visual variety.

Manual demo checks:

- Approve a variant and verify row appears in approved assets table.
- Check Unity Catalog Explorer for volume-to-table lineage.
- Open lineage modal and verify volume URLs are displayed.
- Generate video variants and confirm orientation variety.
- Query lineage programmatically via Databricks API.

## Out Of Scope

- Real-time Unity Catalog lineage visualization in the app (use Databricks UI).
- Automated Delta Sharing recipient onboarding.
- Production video platform integration.
- PDF/document upload for brand guidelines (future enhancement).

## Resolved Demo Decisions

1. Video variants are limited to horizontal and vertical orientations only.
2. Brand guidelines remain static data; document upload is out of scope for summit.
3. Unity Catalog lineage for volumes is path-based; we capture volume-to-table relationships.
4. Score details drawer labels will be business-friendly.
5. Delta Sharing is the preferred cross-workspace transfer mechanism.
6. Provenance must be auditable: base image → model → prompt → transformations → approved image.

## Definition Of Done

- Approved variants write to Delta table with volume path provenance.
- Unity Catalog shows lineage from volume to approved assets table.
- Score details drawer uses business-friendly labels.
- Lineage modal displays volume URLs for source and final assets.
- Video seed files provide visual variety by orientation.
- Delta Sharing configuration is documented and tested.
- Presenter can answer "How did we create this creative?" from the lineage view.
- Demo sequence works end-to-end:
  1. Select brief and audience.
  2. Choose video or image content type.
  3. Generate variants from governed seed assets.
  4. Approve a variant (writes to Delta table).
  5. View lineage with volume URLs and provenance.
  6. Check Unity Catalog Explorer for lineage graph.
  7. Review score details with business-friendly labels.
