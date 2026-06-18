# Creative Command Center Transcript Review Updates

Status: implemented
Date: 2026-05-31

## Source Inputs

- Transcript: `/Users/pragathi.sharma/Downloads/GMT20260529-163202_Recording.transcript.vtt`
- Current app: `my_project/` React + FastAPI Databricks App
- Current deployment target: `creative-command-center-dev`

## Summary

The transcript confirms the app flow is directionally right: Briefs -> Audience -> Creative Studio -> Evaluation Gate -> Activate. The main updates are to make briefs inspectable, clarify the difference between creative approval and channel activation, and ensure an activated creative appears in the Activation dashboard. Secondary updates are around audience selection/match-rate display, channel-level evaluation scores, and demo readiness for backend Databricks artifacts.

## Priority Updates

### P0 - Brief Detail Modal

Add a modal or side drawer from each row on the Briefs page.

Current behavior:
- Briefs page is only a table of summary rows.
- Clicking a brief does not expose the fuller brief context.

Target behavior:
- Each brief row has a clear click target such as `View details`.
- Opening a brief shows a modal with:
  - brief name, ID, brand, status, owner
  - campaign objective
  - target audience description
  - budget, created date, concepts count, creatives count
  - source table/path where available
  - downstream context: recommended audiences, placements, or creative instructions if available
- Modal supports close via button, Escape, and backdrop click.
- The table remains scannable and does not navigate away from the Briefs page.

Implementation notes:
- Minimal implementation can use the current `Brief` row fields.
- Preferred implementation adds `/api/briefs/{brief_id}` and returns any richer fields available from `gold_media_creative_briefs`.
- If richer fields are not available in the table, render a concise "Not available in source data" state rather than fabricating business-critical fields.

Acceptance criteria:
- A user can inspect more detail for every brief without leaving the page.
- Modal is keyboard accessible and works on desktop and mobile widths.
- Missing optional data is handled cleanly.

### P0 - Rename Export To Activate And Feed Activation Dashboard

Rename the Evaluation Gate action from `Export` to `Activate`.

Current behavior:
- Evaluation Gate button says `Export`.
- `POST /api/activation-exports` returns an export payload.
- The Activation dashboard reads `/api/activations`, so the new export does not show up as a newly submitted activation.

Target behavior:
- Evaluation Gate action label is `Activate`.
- CTA copy and KPI labels use activation language:
  - `Exports Ready` -> `Ready to Activate` or `Activated`
  - `activation export` filter -> `activation`
  - success message: `Activation submitted: <destination_asset_id or activation_id>`
- Activating a creative creates a visible activation record.
- The new activation appears on the Activation dashboard with status `Submitted` or `Draft`.

Implementation notes:
- Keep `/api/activation-exports` if needed for compatibility, but treat it as the activation-submit API in the UI.
- Minimum demo behavior: frontend appends the returned activation/export record to Activation dashboard state.
- Better backend behavior: `POST /api/activation-exports` returns both:
  - `export`: payload metadata for downstream systems
  - `activation`: dashboard-shaped row with `activation_id`, `creative_asset_id`, `campaign_id`, `destination_platform`, `trafficking_status`, metrics initialized to zero, and `last_sync_ts`
- `/api/activations` should merge submitted activations with table-backed activations if the activation is not persisted to `gold_buyside_campaign_activation`.

Acceptance criteria:
- No user-facing Evaluation Gate copy says `Export` for the primary action.
- Clicking `Activate` on an eligible row visibly adds or reveals the item in Activation dashboard.
- Activation dashboard can filter by the selected destination platform/channel.

### P1 - Channel-Level Evaluation And Activation Choice

Clarify that Creative Studio approval is about creative quality/safety, while Evaluation Gate is about projected channel performance.

Target behavior:
- Creative Studio shows pre-approval checks such as:
  - brand fit
  - compliance/claims
  - image safety
  - rights/usage
- Evaluation Gate shows projected performance by channel/platform for approved variants:
  - Meta
  - Google Ads / YouTube
  - DV360 / The Trade Desk
  - Adobe Target / onsite personalization
  - Email/newsletter where relevant
- Evaluation row includes:
  - recommended channel
  - projected CTR
  - projected CPM or spend efficiency
  - projected conversions or subscription starts
  - overall projected score
- Activation flow lets the user select one or more destination channels before activation.

Implementation notes:
- Existing `SyntheticEvaluation` can be extended with `channel`, `projected_ctr`, `projected_cpm`, `projected_conversions`, and `recommended_channel`.
- If schema changes are too large for the next iteration, compute a deterministic channel recommendation client-side from existing placement and score fields, then formalize the table later.
- For multi-channel activation, create one activation/export row per selected channel.

Acceptance criteria:
- Users can tell why a creative is approved versus why it is recommended for a channel.
- Evaluation can compare at least three approved variants across at least three channels or show one recommended channel per row.
- Activation requires or defaults a destination channel/platform.

### P1 - Audience Page Selector And Match Rate Fix

The transcript calls out that the Audience page is overloaded and match rate is not displaying.

Target behavior:
- Add a dropdown/picker to focus on one audience at a time, similar to Creative Studio.
- Preserve the broader chart/table, but make the selected audience details easier to inspect.
- Fix match-rate display so it does not show missing/blank values when data is available.
- If match rate is unavailable, show `N/A` with a short tooltip or muted state.

Implementation notes:
- Check whether `match_rate` is missing from Databricks query output or dropped in parsing.
- Keep reach and match-rate side by side because the transcript explicitly calls out both.

Acceptance criteria:
- Audience selection is easy with many audience rows.
- Match rate displays correctly for CSV and Databricks-backed data.

### P1 - Verify Search And Adaptation Filters

The transcript notes that search/filtering and adaptation filtering may not be working consistently.

Target behavior:
- Asset search filters by placement, channel tag, asset type, and user search term.
- Adapted variants appear under the selected placement filter after creation.
- Search for terms like `homepage`, `homepage hero`, `social square`, and `newsletter` returns expected matching assets.

Acceptance criteria:
- Placement filter narrows base assets and variants predictably.
- Creating an adaptation for `social_square` makes it discoverable when the UI is filtered to `social_square`.

### P2 - Backend Demo Readiness

The transcript says the walkthrough should show "all the jobs, tables, everything."

Target behavior:
- Architecture or Talk Track view should explicitly list:
  - Lakeflow/data foundation pipeline
  - synthetic workflow setup job
  - vector search setup job
  - creative asset UC volume
  - key gold tables
  - vector search endpoint/index
  - model endpoint configuration
- Add a concise backend checklist or expandable panel for demo operators.

Acceptance criteria:
- Demo presenter can show the Databricks backend artifacts without leaving the narrative.
- App copy matches deployed resource names and configured catalog/schema.

### P2 - Image Generation Model Labeling

The transcript discusses confusion around GPT-5 Mini versus image-generation models.

Target behavior:
- Creative Studio should distinguish:
  - orchestration/model endpoint used for prompt planning or scoring
  - image generation model used to create visual assets
- If the app is not actually invoking an image model live, label this as simulated/demo generation using governed seed assets and metadata.

Acceptance criteria:
- UI does not imply text-only model endpoints are directly producing images unless that is actually true.
- Model labels are configurable and visible in the Architecture view.

## Recommended Demo Flow After Updates

1. Open Briefs and click a brief to show the detail modal.
2. Move to Audiences, select one audience from the picker, confirm reach and match rate.
3. Open Creative Studio, choose brief + audience + placement, retrieve governed assets, generate variants.
4. Review Creative Studio safety/brand checks and approve 2-3 eligible variants.
5. Move to Evaluation Gate, compare approved variants by projected channel performance.
6. Select one or more channels and click `Activate`.
7. Move to Activations and show the newly submitted activation row.
8. Open Architecture/Talk Track and show jobs, tables, UC volumes, vector search, and model endpoint configuration.

## Out Of Scope For This Spec

- Real downstream API integrations with Meta, Google, Adobe, or The Trade Desk.
- Full campaign budget allocation optimization.
- Persisting live activation writes into production systems unless a safe dev table target is confirmed.
- Video generation/editing beyond metadata compatibility.

## Review Questions

1. Should Evaluation show a full channel-by-variant matrix, or one recommended channel per variant for the demo?
- show the channel by variant metrix , then recommend one channel per variant but also allow to overwrite if needed 
2. Should Activation support multi-channel submission in the first pass, or one selected channel at a time?
- Yes select multi channel submission as check box, if enabled then allow multiple channel submission
3. Should the Brief modal use only existing fields, or should the backend query and expose richer source-system brief text?
- show existing fields. 
4. Should the Activation dashboard show submitted synthetic activations mixed with live/in-flight campaigns, or in a separate `New submissions` section?
- have a New submissions section

## Implementation Status

Implemented in `my_project/src/App.tsx` and `my_project/app/main.py`:

- Briefs table has a `View` action and detail modal using existing brief fields only.
- Evaluation Gate uses `Activate` language, shows a channel-by-variant matrix, recommends one channel per variant, allows overwrite, and supports multi-channel submission.
- Activation submissions are returned from the backend as dashboard-shaped rows and appear in a separate `New submissions` section.
- Audience page has a focused audience picker and handles `match_rate` whether source data is stored as `0-1` or `0-100`.
- Creative Studio search normalizes placement terms such as `homepage hero` and shows pre-approval readiness checks.
- Creative Studio and model status expose a separate image model/source label.
