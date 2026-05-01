# Backlog Item

**Status:** ✅ Implemented

**Title:** Personalized Creative Activation Command Center - Revised Buy Side (MVP)

**Description:**
Brands and agencies have invested heavily in unifying first-party signals and third-party data, resulting in a rich per-user understanding. However, the creatives users see are typically limited to broad personas due to bottlenecks in the creative supply chain. Translating briefs, generating creatives, coordinating approvals, and validating variants takes days or weeks, leading marketers to default to 'lowest-common-denominator' creatives. This leaves relevance, response, and ROAS well below what the underlying data could enable.

**Acceptance Criteria:**
meta:
  contract_version: '1.0'
  title: Personalized Creative Activation Command Center - Revised Buy Side (MVP)
  requester:
    name: User
    role: Requester
    org: Unknown
  stakeholders:
  - role: Brand / Marketing Lead
    description: Owns campaign objective, brief, audience definition, and budget.
  - role: Performance / Programmatic Lead
    description: Owns ROAS, CPA, and paid-media efficiency across DSPs and walled
      gardens.
  - role: Creative Director / Head of Production
    description: Owns concept and brand integrity.
  - role: Audience / Data Strategy Lead
    description: Owns telemetry, identity, 3P enrichment, and clean-room partnerships.
  - role: Brand Standards / Legal / Regional Reviewer
    description: Owns brand, talent, IP, regulated-industry, and regional compliance.
  source_context:
    conversation_id: current_conversation
    links: []
  created_at: '2024-05-23T12:00:00Z'
  updated_at: '2024-05-23T12:00:00Z'
outcome:
  problem_statement: Brands and agencies have invested heavily in unifying first-party
    signals and third-party data, resulting in a rich per-user understanding. However,
    the creatives users see are typically limited to broad personas due to bottlenecks
    in the creative supply chain. Translating briefs, generating creatives, coordinating
    approvals, and validating variants takes days or weeks, leading marketers to default
    to 'lowest-common-denominator' creatives. This leaves relevance, response, and
    ROAS well below what the underlying data could enable.
  goals:
  - Enable agencies and brands to submit and translate marketing briefs into structured
    audiences, messages, and KPIs.
  - Provide tools to define and manage telemetry-driven audiences and cohorts.
  - Facilitate segment-level creative generation, basic editing, and library management.
  - Allow pushing approved creatives to various DSPs, walled gardens, and ad servers.
  - Offer a natural-language interface for brief exploration, creative intelligence,
    and operational status.
  - Establish a unified identity graph for consistent user/household identification.
  - Implement basic A/B testing with canary rollout for creative activation.
  - Capture basic performance metrics for activated campaigns.
  non_goals:
  - V1 features ('Governed Creative Supply Chain') including concepts, storyboards,
    synthetic evaluations, workflow, brand proofing, and clean room integration for
    signal exchange.
  - V2 features ('Intelligence & Personalization') including full campaign hierarchy
    management, advanced creative intelligence, 1:1 personalization, and data health
    monitoring.
  - Full integration with Sell Side Creative Workbench beyond conceptual clean room
    signal exchange.
  - Advanced creative generation capabilities beyond segment-level and basic editing.
  - Comprehensive attribution modeling (MMM, MTA, incrementality testing) for the
    MVP phase.
  success_metrics:
  - metric: Briefs Translated
    description: Number of natural-language briefs successfully structured by the
      platform.
  - metric: Audiences Defined
    description: Number of telemetry-driven audiences created and managed.
  - metric: Creatives Generated/Managed
    description: Number of segment-level creatives generated, edited, and stored.
  - metric: Activations Launched
    description: Number of approved creatives successfully pushed to downstream platforms.
  - metric: AskCreative Query Resolution
    description: Accuracy and relevance of responses from the natural-language interface.
  - metric: A/B Test Execution
    description: Successful setup and execution of A/B tests with canary rollouts.
  - metric: Basic Performance Data Capture
    description: Successful ingestion of impressions, clicks, and conversions for
      activated creatives.
  users_personas:
  - Brand / Marketing Lead (advertiser)
  - Performance / Programmatic Lead (brand or agency)
  - Creative Director / Head of Production (agency or in-house)
  - Audience / Data Strategy Lead (agency or brand)
  - Brand Standards / Legal / Regional Reviewer
  constraints:
  - The Buy Side app maintains its own Unity Catalog catalog, schemas, and tables,
    independent from the Sell Side.
  - Connection between Buy Side and Sell Side (if applicable) is via Databricks Clean
    Rooms, not shared infrastructure.
  - Leverage existing Databricks ecosystem for data management, ML, and application
    deployment.
  - MVP focuses on segment-level creative generation, not 1:1 personalization.
artifact_plan:
  artifact_types:
  - dashboard
  - workflow
  - api
  - model
  - pipeline
  environments:
  - dev
  - staging
  - prod
  delivery:
    milestones:
    - name: MVP - 'Brief to Activation' Pages
      description: Deliver core user interface for Home, Briefs, Audiences, Creatives,
        Activations, and Ask (AskCreative).
      due_date: TBD
    - name: MVP - Data Foundation
      description: Implement Identity Graph, Telemetry Event Stream, 3P Enrichment
        Reference, Audience/Cohort Reference, Brand Asset & DCO Template Library,
        Generated/Modified Creative Assets, Campaign/Offer Reference, Creative-Campaign
        Mapping, Basic Rights Profiles, Campaign Trafficking & Activation.
      due_date: TBD
    - name: MVP - A/B Testing & Canary Rollout
      description: Implement Ab_Test_Configuration and Ab_Test_Variant tables and
        basic logic for creative allocation.
      due_date: TBD
    - name: MVP - Campaign Tracking Augmentation
      description: Augment Campaign Trafficking & Activation table with basic performance
        metrics.
      due_date: TBD
    definition_of_done:
    - All MVP pages are functional and accessible.
    - Core data foundation tables are designed, implemented, and populated with sample
      data.
    - Identity Graph successfully resolves Master_ID and links various identifiers.
    - Audience/Cohort Reference allows definition and management of segments.
    - Brand Asset & DCO Template Library stores assets with content tags.
    - Segment-level creative generation and basic editing capabilities are available.
    - Activations can push creatives to simulated or integrated downstream systems.
    - AskCreative interface processes natural language queries for MVP-scoped data.
    - A/B test configurations and variants can be defined and linked to activations.
    - Basic performance metrics (impressions, clicks, conversions, cost) are captured
      and updated for activated creatives.
    - All data quality requirements for MVP components are met.
    - Relevant data pipelines are operational for MVP data flows.
open_questions:
- question: Do we name specific personas at Keystone (e.g., 'Sarah Chen, Group Creative
    Director') like DI did with specific roles?
  status: open
- question: Should the demo focus on one brand line's campaign end-to-end, or interleave
    all three to show portfolio complexity?
  status: open
- question: How explicit should the narrative be about creative gen tools (Firefly,
    Runway, etc.) being integrations rather than competitors?
  status: open
- question: Should Scene 3 include a live moment where the Sell Side Creative Workbench
    appears, or keep it referenced-only?
  status: open
- question: Should any scene include a live notebook/SQL moment (like DI's Scene 2
    with the MMM notebook), or keep it purely app-driven?
  status: open
decisions:
- decision: The 'Master_ID' in the Identity Graph will be the same as the existing
    'canonical_id' from 'gold_media_customer_360'.
  rationale: To ensure efficiency and streamline the data foundation, leveraging existing
    identifiers.
  made_by: User
  made_at: '2024-05-23T12:00:00Z'
- decision: Linked_IDs within the Identity Graph table will be stored as separate
    columns for each Linked_ID type (e.g., 'hashed_email_id', 'maid_id', 'ctv_id').
  rationale: To create a flat structure for easier access to specific identifier types.
  made_by: User
  made_at: '2024-05-23T12:00:00Z'
- decision: The 'Definition' field in the 'Audience / Cohort Reference' table will
    be split into 'definition_type', 'definition_value', and 'feature_summary_text'
    columns.
  rationale: To provide a good balance of structure and flexibility for diverse audience
    definitions.
  made_by: User
  made_at: '2024-05-23T12:00:00Z'
- decision: Eligibility_Flags in the 'Audience / Cohort Reference' table will be represented
    as separate boolean columns (e.g., 'is_region_allowed', 'is_channel_allowed')
    and a string column for 'personalization_granularity'.
  rationale: To provide clear and direct flags for eligibility.
  made_by: User
  made_at: '2024-05-23T12:00:00Z'
- decision: Content_Tags in the 'Brand Asset & DCO Template Library' table will be
    stored as a comma-separated string.
  rationale: A straightforward approach for tagging and search within the MVP.
  made_by: User
  made_at: '2024-05-23T12:00:00Z'
- decision: 'A/B testing with canary rollout for the MVP will be implemented using
    two new tables: ''Ab_Test_Configuration'' and ''Ab_Test_Variant''.'
  rationale: To provide a robust and structured way to manage test configurations
    and variants.
  made_by: User
  made_at: '2024-05-23T12:00:00Z'
- decision: 'Campaign tracking for the MVP will augment the ''Campaign Trafficking
    & Activation'' table with basic performance metrics: ''impressions'', ''clicks'',
    ''conversions'', ''cost'', and ''last_metrics_update_timestamp''.'
  rationale: To provide immediate feedback on activated creatives within the MVP without
    requiring a separate, more complex attribution system.
  made_by: User
  made_at: '2024-05-23T12:00:00Z'
assumptions:
- assumption: The Databricks platform and its core services (Unity Catalog, MLflow,
    Mosaic AI, Clean Rooms) are available and configured.
  risk_if_wrong: Core functionalities like governance, ML model management, and secure
    data sharing will be compromised.
- assumption: Necessary integrations with external DSPs, walled gardens, and ad servers
    for creative activation can be built or are available via APIs.
  risk_if_wrong: Creative activation and performance data ingestion will be blocked
    or require manual processes.
- assumption: Data sources for 1P telemetry and 3P enrichment are accessible and can
    be ingested into the Databricks Lakehouse.
  risk_if_wrong: The foundation for audience definition and personalization will be
    incomplete or inaccurate.
- assumption: The 'AskCreative' natural language interface can be powered effectively
    by MAS + Genie with connections to the defined gold tables.
  risk_if_wrong: The conversational AI capabilities will not meet user expectations
    or provide accurate insights.
data:
  sources:
  - name: Telemetry Event Stream
    type: streaming
    location: Databricks Lakehouse
    access_pattern: read
  - name: Third-Party Enrichment Reference
    type: batch
    location: Databricks Lakehouse
    access_pattern: read
  - name: Creative Brief Repository
    type: structured
    location: Databricks Lakehouse
    access_pattern: read/write
  - name: Brand Asset & DCO Template Library
    type: structured/blob
    location: Databricks Lakehouse
    access_pattern: read/write
  - name: Generated / Modified Creative Assets
    type: structured/blob
    location: Databricks Lakehouse
    access_pattern: read/write
  - name: Campaign / Offer Reference
    type: structured
    location: Databricks Lakehouse
    access_pattern: read/write
  - name: Media Plan / Line Item / Placement Catalog
    type: structured
    location: Databricks Lakehouse
    access_pattern: read/write
  - name: External DSPs/Ad Servers
    type: API/batch
    location: External
    access_pattern: read (performance data)
  sinks:
  - name: DSPs (The Trade Desk, DV360, Amazon DSP)
    type: API
    location: External
    access_pattern: write (creative assets, targeting)
  - name: Walled Gardens (Meta, Google Ads, TikTok, Amazon Ads)
    type: API
    location: External
    access_pattern: write (creative assets, targeting)
  - name: DCO Platforms (Celtra, Smartly, Innovid)
    type: API
    location: External
    access_pattern: write (creative assets, DCO templates)
  - name: Ad Servers (CM360, Sizmek)
    type: API
    location: External
    access_pattern: write (creative assets)
  - name: Owned Channels (CDP, ESP, onsite personalization)
    type: API
    location: External
    access_pattern: write (creative assets)
  transformations:
  - Ingest and normalize first-party telemetry (web, app, CRM, loyalty, purchase,
    ad-exposure) and third-party enrichment.
  - Resolve user, household, and device identifiers across web, app, CTV, walled gardens,
    and clean-room partner outputs into a consistent Identity Graph.
  - Engineer per-user features (recency/frequency, intent depth, lifecycle, exposure
    history, content affinity, value tier).
  - Translate natural-language marketing briefs into structured intent (target audience
    definitions, message pillars, KPIs).
  - Basic resizing, reformatting, and editing of generated creative assets.
  - Update campaign trafficking and activation records with performance metrics.
  quality_requirements:
  - 'ID Consistency & Join Keys: Standardized Master_ID, Cohort_ID, Brief_ID, Creative_Asset_ID,
    Line_Item_ID across all MVP tables.'
  - 'Asset & Record Hygiene: De-duplicate base and generated creatives. Every Generated/Modified
    asset references a valid Brief_ID.'
  - 'Timestamp Normalization: All event timestamps in UTC; second-level for events,
    daily for reporting snapshots.'
  - 'Identity & Audience Integrity: Consistent Master_ID resolution across 1P telemetry,
    3P enrichment, and activation.'
  - 'Brief Alignment: Every Generated/Modified asset references a valid Brief_ID.'
  - 'Media Plan & Format Alignment: Every Creative_Asset_ID used in activation has
    a valid Line_Item_ID and Campaign_ID.'
  - 'Activation & Feedback Loop Quality: Activated creatives only reference policy-approved
    assets.'
  - 'Data Freshness SLAs: Near real-time/hourly for telemetry events, generated creatives,
    trafficking status, workflow state changes. Daily for refreshed cohort definitions,
    3P enrichment.'
ml:
  model_type: Generative AI, Natural Language Processing, Classification
  features:
  - 'Telemetry & Enrichment Features (per user/household): Recency_Frequency, Intent,
    Lifecycle, Exposure, Content_Affinity, Enrichment (demographic_bucket, household_composition,
    life_event_flags, third_party_intent_scores)'
  - 'Brief & Concept Features: Brief_Intent_Features'
  - 'Creative Generation Features (Image, Video, DCO, User-Level): Prompt_Features'
  training_data: Telemetry Event Stream, Identity Graph, Third-Party Enrichment Reference,
    Creative Brief Repository, Audience / Cohort Reference, Brand Asset & DCO Template
    Library
  metrics:
  - Brief Translation Accuracy
  - AskCreative Query Relevance
  - Creative Generation Quality (manual evaluation for MVP)
  deployment_target: Databricks MLflow Model Registry, Mosaic AI Endpoints, Genie
    Space
app:
  ui_requirements:
  - 'Home page: Daily command center (briefs in flight, blocked items, key metrics).'
  - 'Briefs page: Submit briefs and review translation into structured audiences,
    messages, KPIs.'
  - 'Audiences page: Define and manage telemetry-driven audiences and cohorts (type,
    size/reach, personalization granularity, last refreshed).'
  - 'Creatives page: Library, generate (segment-level), basic editing (resize, reformat),
    shortlist, review sections.'
  - 'Activations page: Push approved creatives (including DCO templates) to DSPs,
    walled gardens, ad servers, owned channels.'
  - 'Ask (AskCreative) page: Natural-language interface powered by MAS + Genie.'
  - Persistent left-side navigation.
  - Context selector for AskCreative (brief, campaign, audience, creative set, activation).
  api_endpoints:
  - name: Brief Submission API
    description: For submitting new marketing briefs.
  - name: Audience Management API
    description: For defining, updating, and retrieving audiences.
  - name: Creative Generation/Editing API
    description: For initiating creative generation and basic modifications.
  - name: Activation API
    description: For pushing approved creatives to downstream systems.
  - name: AskCreative API
    description: For natural language queries and responses.
  - name: Identity Graph API
    description: For resolving and retrieving user/household identifiers.
  - name: AB Test Configuration API
    description: For defining and managing A/B tests and variants.
  - name: Performance Data Ingestion API
    description: For receiving performance metrics from downstream systems.
  authentication: Standard Databricks authentication (e.g., OAuth, SSO)
  deployment_type: Databricks-native application (e.g., Dashboards, Lakehouse Apps,
    custom web app on Databricks compute)
compute_orchestration:
  compute_type: Databricks Clusters (Photon, Serverless)
  schedule: Near real-time/hourly for telemetry events, generated creatives, evaluations,
    trafficking status, workflow state changes. Daily for refreshed cohort definitions,
    3P enrichment, attribution and outcome data, synthetic audience snapshots, prediction
    calibration logs.
  dependencies:
  - Data ingestion pipelines (1P telemetry, 3P enrichment)
  - Identity resolution pipelines
  - Feature engineering pipelines
  - Brief translation models
  - Creative generation models/services
  - Creative activation jobs
  - Performance data ingestion jobs
  - AskCreative backend services
  retry_policy:
    type: exponential_backoff
    max_retries: 5
    initial_delay_seconds: 30
governance_security:
  data_classification: Highly Sensitive (customer PII, behavioral data, proprietary
    creative assets)
  access_controls:
  - Role-Based Access Control (RBAC) for different user personas (Brand Lead, Creative
    Director, etc.)
  - Unity Catalog for fine-grained table, column, and row-level access.
  - Secure access to external APIs (DSPs, walled gardens) via secrets management.
  audit_requirements:
  - Full lineage and provenance for every generated/modified creative asset through
    Unity Catalog.
  - Audit logs for all user actions (brief submissions, approvals, creative generation,
    activations).
  - Tracking of data transformations and model versions in MLflow.
  compliance_requirements:
  - Adherence to data privacy regulations (e.g., GDPR, CCPA) for customer data.
  - Basic IP rights and usage restrictions for creative assets (managed via 'Rights_Profile_ID').
  - Platform policy compliance checks (manual/external for MVP, automated in V1).
acceptance:
  test_scenarios:
  - Submit a new brief and verify its translation into structured data.
  - Define a new audience segment based on telemetry data.
  - Generate a segment-level creative variant and perform basic edits.
  - Activate an approved creative to a target DSP/ad server.
  - Query AskCreative for a brief's status or audience insights.
  - Configure and launch a basic A/B test with a canary group.
  - Verify that performance metrics (impressions, clicks, conversions) are updated
    for activated creatives.
  acceptance_criteria:
  - All MVP UI pages load correctly and are navigable.
  - Data pipelines for MVP components run without errors and meet freshness SLAs.
  - Identity Graph accurately resolves and links identifiers.
  - Audience definitions are correctly stored and retrievable.
  - Creative assets are stored with correct metadata and tags.
  - Activations successfully send creatives and targeting parameters to mock/integrated
    systems.
  - AskCreative provides relevant and accurate responses for MVP-scoped questions.
  - A/B test configurations are correctly applied during activation.
  - Performance metrics are accurately reflected in the 'Campaign Trafficking & Activation'
    table.
  sign_off_required:
  - User (Requester)
  - Product Owner
  - Technical Lead


## Pod Context

- **Pod ID**: default
- **UC Catalog**: cme_outcomes_uswest
- **UC Schema**: lakefoundry
- **UC Volume**: artifacts

## Working Directory

Files should be created in the current sandbox directory.
