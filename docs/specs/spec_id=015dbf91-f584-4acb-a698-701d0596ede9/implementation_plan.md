# Personalized Creative Activation Command Center - MVP Implementation Plan

**Goal:** Build the Buy Side MVP data foundation and UI for brief-to-activation workflow, enabling brands/agencies to translate briefs, manage audiences, generate segment-level creatives, and activate to downstream platforms with A/B testing and basic performance tracking.

**Architecture:** Databricks Lakehouse with Unity Catalog (`cme_outcomes_uswest.lakefoundry`) for new MVP tables. The existing `media_demo` schema contains Customer 360 and related gold tables that we reference. A Databricks App (APX/React) provides the UI with pages for Home, Briefs, Audiences, Creatives, Activations, and Ask. Data pipelines use Spark Declarative Pipelines (DLT) for table creation and maintenance.

---

### Task 1: Create Identity Graph Gold Table

**Depends On:** none

**Files:**
- Create: `pipelines/identity_graph.py`

**Requirements:**
- Create `gold_buyside_identity_graph` table in `cme_outcomes_uswest.lakefoundry`
- Use `canonical_id` from existing `gold_media_customer_360` as `master_id`
- Include flat columns for linked IDs: `hashed_email_id`, `maid_id`, `ctv_id`, `household_id`, `cookie_id`
- Generate synthetic linked IDs from existing customer data (hash email, generate MAIDs, etc.)
- Include `id_resolution_confidence`, `last_resolved_ts`, `created_ts` columns
- Grain: One row per master_id

**Acceptance Criteria:**
- [ ] Table created with correct schema in Unity Catalog
- [ ] All ~10K customers from customer_360 have identity graph entries
- [ ] Linked IDs are properly generated/hashed
- [ ] Table is queryable and joins correctly to customer_360

**Skills:** `spark-declarative-pipelines`, `synthetic-data-generation`

---

### Task 2: Create Audience/Cohort Reference Gold Table

**Depends On:** none

**Files:**
- Create: `pipelines/audience_cohort_reference.py`

**Requirements:**
- Create `gold_buyside_audience_cohort` table in `cme_outcomes_uswest.lakefoundry`
- Columns: `cohort_id`, `cohort_name`, `cohort_description`, `definition_type` (enum: `rule_based`, `ml_model`, `lookalike`, `manual`), `definition_value` (JSON with rules/model ref), `feature_summary_text`
- Eligibility flags as separate boolean columns: `is_region_allowed`, `is_channel_allowed`, `is_frequency_capped`
- Include `personalization_granularity` (string: `Segment`, `Micro_Cohort`, `One_to_One`)
- Include `estimated_reach`, `last_refreshed_ts`, `created_ts`, `updated_ts`, `status` (Active/Archived)
- Seed with ~20 cohorts based on existing segment combinations from `gold_media_audience_segments`

**Acceptance Criteria:**
- [ ] Table created with correct schema
- [ ] ~20 seed cohorts covering major segment combinations
- [ ] Definition values are valid JSON
- [ ] Eligibility flags properly populated

**Skills:** `spark-declarative-pipelines`, `synthetic-data-generation`

---

### Task 3: Create Generated/Modified Creative Assets Table

**Depends On:** none

**Files:**
- Create: `pipelines/generated_creative_assets.py`

**Requirements:**
- Create `gold_buyside_generated_creatives` table in `cme_outcomes_uswest.lakefoundry`
- Columns: `creative_asset_id`, `brief_id` (FK to `gold_media_creative_briefs`), `concept_id` (FK to `gold_media_creative_concepts`), `source_asset_id` (FK to `gold_media_brand_asset_library`)
- Include `asset_name`, `asset_type` (Image/Video/DCO), `format`, `width_px`, `height_px`, `aspect_ratio`, `duration_sec`
- Include `storage_uri`, `generation_prompt`, `generation_model`, `generation_params` (JSON)
- Include `target_segment`, `target_content_genre`, `content_tags` (comma-separated string per decision)
- Include `approval_status` (Draft/Pending_Review/Approved/Rejected), `approved_by`, `approved_ts`
- Include `created_ts`, `updated_ts`
- Seed with ~100 generated creatives linked to existing briefs and concepts

**Acceptance Criteria:**
- [ ] Table created with correct schema
- [ ] ~100 seed creatives with valid FK references
- [ ] Storage URIs follow volume path pattern
- [ ] Content tags stored as comma-separated strings

**Skills:** `spark-declarative-pipelines`, `synthetic-data-generation`

---

### Task 4: Create Campaign Trafficking & Activation Table

**Depends On:** none

**Files:**
- Create: `pipelines/campaign_activation.py`

**Requirements:**
- Create `gold_buyside_campaign_activation` table in `cme_outcomes_uswest.lakefoundry`
- Columns: `activation_id`, `creative_asset_id` (FK), `line_item_id` (FK to `gold_media_media_plan_line_items`), `campaign_id`, `brief_id`
- Include `destination_platform` (DSP name), `destination_placement_id`, `trafficking_status` (Draft/Submitted/Live/Paused/Ended)
- Include `activation_ts`, `last_sync_ts`
- Performance metrics: `impressions` (bigint), `clicks` (bigint), `conversions` (bigint), `cost` (double), `last_metrics_update_ts`
- Include `ab_test_id` (FK, nullable), `ab_test_variant_id` (FK, nullable)
- Seed with ~50 activations linked to existing line items and generated creatives

**Acceptance Criteria:**
- [ ] Table created with correct schema
- [ ] ~50 seed activations with valid FK references
- [ ] Performance metrics populated with realistic values
- [ ] Trafficking status distribution is realistic

**Skills:** `spark-declarative-pipelines`, `synthetic-data-generation`

---

### Task 5: Create A/B Test Configuration and Variant Tables

**Depends On:** none

**Files:**
- Create: `pipelines/ab_test_tables.py`

**Requirements:**
- Create `gold_buyside_ab_test_config` table:
  - Columns: `ab_test_id`, `test_name`, `test_description`, `brief_id` (FK), `test_type` (Creative/Audience/Message)
  - Include `start_date`, `end_date`, `status` (Draft/Running/Completed/Cancelled)
  - Include `success_metric` (CTR/Conversion/ROAS), `confidence_threshold`, `min_sample_size`
  - Include `created_ts`, `updated_ts`
- Create `gold_buyside_ab_test_variant` table:
  - Columns: `variant_id`, `ab_test_id` (FK), `variant_name`, `variant_type` (Control/Treatment)
  - Include `creative_asset_id` (FK, nullable), `traffic_allocation_pct`
  - Include `is_canary` (boolean for canary rollout), `canary_pct` (if is_canary)
  - Include `impressions`, `clicks`, `conversions`, `metric_value`, `is_winner` (boolean)
  - Include `created_ts`, `updated_ts`
- Seed with ~10 A/B tests and ~30 variants

**Acceptance Criteria:**
- [ ] Both tables created with correct schemas
- [ ] ~10 test configs with valid brief references
- [ ] ~30 variants with proper allocation percentages summing to 100% per test
- [ ] Canary variants properly flagged

**Skills:** `spark-declarative-pipelines`, `synthetic-data-generation`

---

### Task 6: Create DAB Bundle and Deploy Pipelines

**Depends On:** 1, 2, 3, 4, 5

**Files:**
- Create: `databricks.yml`
- Create: `resources/buyside_data_foundation.yml`

**Requirements:**
- Create minimal DAB bundle configuration
- Define a single DLT pipeline `buyside_data_foundation` that includes all 5 pipeline notebooks
- Configure for `cme_outcomes_uswest` catalog and `lakefoundry` schema
- Set development mode as default target
- Validate and deploy the bundle
- Run the pipeline to create all tables

**Acceptance Criteria:**
- [ ] `databricks bundle validate` succeeds
- [ ] `databricks bundle deploy` succeeds
- [ ] `databricks bundle run buyside_data_foundation` completes successfully
- [ ] All 6 tables exist in Unity Catalog with data

**Skills:** `asset-bundles`, `spark-declarative-pipelines`

---

### Task 7: Build Databricks App - Core Layout and Home Page

**Depends On:** 6

**Files:**
- Create: `app/app.yaml`
- Create: `app/src/main.py`
- Create: `app/src/pages/home.py`
- Create: `app/requirements.txt`

**Requirements:**
- Create Streamlit-based Databricks App with persistent left-side navigation
- Navigation items: Home, Briefs, Audiences, Creatives, Activations, Ask
- Home page displays daily command center:
  - Briefs in flight (count by status from `gold_media_creative_briefs`)
  - Blocked items (briefs needing attention)
  - Key metrics: Total activations, Active A/B tests, Avg CTR
- Use Lakebase sync tables for real-time queries where available
- Clean, professional styling with cards/metrics layout

**Acceptance Criteria:**
- [ ] App runs locally with `streamlit run`
- [ ] Navigation works across all pages (placeholder for non-Home)
- [ ] Home page shows live data from gold tables
- [ ] Responsive layout with proper spacing

**Skills:** `databricks-app-python`, `web-design-guidelines`

---

### Task 8: Build Briefs Page

**Depends On:** 7

**Files:**
- Create: `app/src/pages/briefs.py`

**Requirements:**
- List view showing all briefs from `gold_media_creative_briefs`
- Display: brief_name, brief_type, objective, brief_status, flight dates, budget
- Filter by status, brief_type, objective
- Detail view on row click showing full brief details
- Show linked concepts count and linked line items count
- Status badge with color coding (Draft=gray, Translated=blue, Approved=green, etc.)

**Acceptance Criteria:**
- [ ] List view displays all briefs with pagination
- [ ] Filters work correctly
- [ ] Detail view shows all brief fields
- [ ] Status badges are color-coded

**Skills:** `databricks-app-python`, `web-design-guidelines`

---

### Task 9: Build Audiences Page

**Depends On:** 7

**Files:**
- Create: `app/src/pages/audiences.py`

**Requirements:**
- List view showing cohorts from `gold_buyside_audience_cohort`
- Display: cohort_name, definition_type, estimated_reach, personalization_granularity, status, last_refreshed
- Filter by definition_type, status, personalization_granularity
- Detail view showing full cohort definition and eligibility flags
- Show feature_summary_text for quick understanding

**Acceptance Criteria:**
- [ ] List view displays all cohorts
- [ ] Filters work correctly
- [ ] Detail view shows definition JSON formatted nicely
- [ ] Eligibility flags displayed as badges

**Skills:** `databricks-app-python`, `web-design-guidelines`

---

### Task 10: Build Creatives Page

**Depends On:** 7

**Files:**
- Create: `app/src/pages/creatives.py`

**Requirements:**
- Library section: Grid view of generated creatives from `gold_buyside_generated_creatives`
- Display: thumbnail placeholder, asset_name, asset_type, format, dimensions, approval_status
- Filter by asset_type, approval_status, target_segment
- Detail view showing full creative metadata, linked brief/concept
- Show generation prompt and parameters
- Shortlist section: Filter for approved creatives ready for activation

**Acceptance Criteria:**
- [ ] Grid view displays creatives with visual cards
- [ ] Filters work correctly
- [ ] Detail view shows all metadata
- [ ] Shortlist filter shows only approved creatives

**Skills:** `databricks-app-python`, `web-design-guidelines`

---

### Task 11: Build Activations Page

**Depends On:** 7

**Files:**
- Create: `app/src/pages/activations.py`

**Requirements:**
- List view of activations from `gold_buyside_campaign_activation`
- Display: creative name, destination_platform, trafficking_status, impressions, clicks, conversions, cost
- Calculate and display CTR (clicks/impressions)
- Filter by trafficking_status, destination_platform
- Detail view showing full activation details including A/B test info if linked
- Performance metrics section with basic charts (impressions over time placeholder)

**Acceptance Criteria:**
- [ ] List view displays all activations with metrics
- [ ] CTR calculated and displayed
- [ ] Filters work correctly
- [ ] Detail view shows A/B test linkage when present

**Skills:** `databricks-app-python`, `web-design-guidelines`

---

### Task 12: Build Ask (AskCreative) Page

**Depends On:** 7

**Files:**
- Create: `app/src/pages/ask.py`

**Requirements:**
- Natural language query interface with text input
- Context selector dropdown: Brief, Campaign, Audience, Creative Set, Activation
- Display area for responses
- For MVP: Simple keyword-based query routing to relevant tables
- Example queries shown as suggestions
- Query history in session state

**Acceptance Criteria:**
- [ ] Text input accepts natural language queries
- [ ] Context selector changes query scope
- [ ] Basic queries return relevant data
- [ ] Example queries are clickable

**Skills:** `databricks-app-python`, `web-design-guidelines`

---

### Task 13: Deploy Databricks App

**Depends On:** 8, 9, 10, 11, 12

**Files:**
- Modify: `resources/buyside_app.yml` (create)

**Requirements:**
- Add app resource to DAB bundle
- Configure app with correct source path and permissions
- Deploy and run the app
- Verify all pages load correctly with live data

**Acceptance Criteria:**
- [ ] `databricks bundle validate` succeeds with app resource
- [ ] `databricks bundle deploy` succeeds
- [ ] `databricks bundle run buyside_app` starts the app
- [ ] All pages accessible and functional in deployed app

**Skills:** `asset-bundles`, `databricks-app-python`
