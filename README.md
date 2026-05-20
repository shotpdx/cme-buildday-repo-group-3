# CME Build Day

Participant-facing contract for the CME Build Day creative-generation workstream. The goal on Build Day is for every team to ship a working, personalized creative experience on top of the `cme_outcomes_uswest.media_demo` Customer 360.

This repo contains the shared data contract, track briefs, NBA gold table DDL/seed scripts (`sql/nba/`), the buyside Lakeflow pipeline bundle (`databricks.yml`, `resources/`, `pipelines/`), and the Creative Command Center app (`my_project/`).

## What we're building

Three parallel tracks, all grounded in the same Customer 360:

**Sell-side — D2C home-screen hero.** A signed-in customer hits the streaming home page and the hero (image, tagline, CTA, subtitle) is personalized from their `(primary_segment, value_segment, top_genre_1)`. P95 under 500 ms, never 5xx, HyperFrames animation, graceful persona fallback on any upstream hiccup.

**Buy-side — Campaign Studio.** A marketing manager picks a target segment and, in under 30 seconds, sees a cross-format creative package (social square, vertical story, display banner, email header) stream in tile by tile via SSE. Per-tile regenerate + quality toggle, campaign-level approve, ZIP export, state persisted in Lakebase.

**Next Best Action (NBA) — Intelligent Decisioning.** The NBA engine is the intelligence and orchestration layer on top of the Customer 360. It consumes gold tables (churn predictions, LTV, content affinity, audience segments), applies rules-based decisioning logic, and outputs a prioritized action per customer routed to the right channel at the right time. Three NBA gold tables provide the foundation: an **Action Library** (~50 actions across 8 types — content, upsell, retention, re-engagement, win-back, loyalty, service, do-nothing), **Recommendations** (~10K scored and ranked action recommendations with explainability), and **Orchestration State** (~10K per-customer journey positions, frequency caps, channel fatigue, and delivery history). The engine operates as a maturity progression — rules-based triggers first, propensity models second, real-time signals third.

## The data contract

Everything participants can rely on — gold tables, silver support tables, enum vocabularies, grain, and the `_sync` Lakebase mirrors — is in [`build-day-data-dictionary.md`](build-day-data-dictionary.md). If it isn't documented there, treat it as undefined.

Key joins: all gold tables share `canonical_id`. The campaign funnel (`gold_media_campaign_engagement`) additionally keys on `campaign_id` and pitches a specific `content_id`. The NBA tables link to the action library via `recommended_action_id` → `action_id`, and to the asset library via `creative_template_id`.

## Environment

- **Catalog / schema:** `cme_outcomes_uswest.media_demo`
- **Lakebase mirrors:** same table names with `_sync` suffix
- **Volumes:** `/Volumes/cme_outcomes_uswest/media_demo/creatives/` for generated imagery

Anything not listed above (secret scopes, endpoint names, SP grants) is distributed per team on the morning of Build Day.

## Creative Command Center Demo

The `my_project/` directory contains a self-contained **Creative Command Center** demo app that showcases the buy-side campaign management experience.

### Quick Start

```bash
cd my_project
npm ci
npm run build
databricks bundle deploy -t dev
databricks bundle run creative_command_center -t dev
```

**For detailed setup instructions, see [`my_project/SETUP.md`](my_project/SETUP.md).**

### What's Included

- React + FastAPI application deployed as a Databricks App
- Databricks pipeline files under `pipelines/` and `resources/` that generate the buyside gold backend tables
- CSV-backed sample data (no external dependencies required)
- Campaign overview, audience targeting, creative scoring, market analysis
- Architecture diagrams for Business, Platform, Data & ML, and Agent views
- Ask AI natural language interface

### Backend Loading Path

The root bundle runs the Lakeflow pipeline resources that create the `cme_outcomes_uswest.lakefoundry.gold_buyside_*` tables from upstream `cme_outcomes_uswest.media_demo` gold tables. The app backend in `my_project/app/main.py` reads those generated gold tables through a SQL warehouse when `APP_DATA_SOURCE=databricks`, and falls back to the bundled CSV extracts if a table or grant is unavailable.

The restored branch artifacts include concrete gold-layer pipeline code. Bronze and silver inputs are upstream to this repo and are represented by the shared data contract and existing `media_demo` source tables, not by separate checked-in bronze/silver pipeline files in this branch.
