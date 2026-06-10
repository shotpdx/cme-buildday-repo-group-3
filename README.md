# Creative Command Center

A complete Databricks-native solution for personalized creative activation, featuring a medallion architecture pipeline, AI-powered creative generation, and a React + FastAPI application deployed as a Databricks App.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Creative Command Center                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────────────┐  │
│   │  Bronze  │───▶│  Silver  │───▶│   Gold   │───▶│  Databricks App + Genie  │  │
│   │  (CSV)   │    │(cleaned) │    │(enriched)│    │   (React + FastAPI)      │  │
│   └──────────┘    └──────────┘    └──────────┘    └──────────────────────────┘  │
│        │                                                      │                  │
│        ▼                                                      ▼                  │
│   UC Volume                                            SQL Warehouse             │
│   (seed assets)                                        (table reads)             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Databricks workspace with Unity Catalog enabled
- Databricks CLI v0.200+ configured (`databricks auth login`)
- Node.js 18+ and npm
- Python 3.9+
- Access to a SQL Warehouse
- Model Serving endpoints (or use fallback mode)

## Quick Start

### Option 1: Automated Full Deployment (Recommended)

```bash
# Clone and configure
git clone <repo-url>
cd cme-buildday-repo-group-3
cp .env.example .env  # Edit with your workspace details

# Run the full deployment script
python3 scripts/full_deployment.py
```

> **Important:** After the Genie Space is created, update `my_project/databricks.yml` with the new Genie Space ID and SQL Warehouse ID before deploying the app. See [Workspace-Specific Configuration](#workspace-specific-configuration) below.

This single command will:
1. Create Unity Catalog resources (catalog, schemas, volumes)
2. Upload CSV seed data to UC Volume
3. Run CSV → Bronze → Silver → Gold pipeline
4. Run Buyside Data Foundation pipeline
5. Set up Genie Space for Ask AI
6. Set up Vector Search for asset search
7. Upload creative assets (images, videos)
8. Build and deploy the Databricks App

### Option 2: Step-by-Step Manual Deployment

```bash
# 1. Clone and configure
git clone <repo-url>
cd cme-buildday-repo-group-3
cp .env.example .env  # Edit with your workspace details

# 2. Upload CSV seed data
databricks fs cp -r my_project/sample_data \
  dbfs:/Volumes/cme_outcomes_uswest/lakefoundry/seed_data/

# 3. Deploy and run pipelines
databricks bundle deploy -t dev
databricks bundle run csv_bronze_pipeline -t dev      # CSV → Bronze → Silver → Gold
databricks bundle run buyside_data_foundation -t dev  # Creates gold_buyside_* tables

# 4. Set up Genie Space (optional - for Ask AI)
python scripts/setup_creative_genie_space.py

# 5. Set up Vector Search (optional - for asset search)
python scripts/setup_creative_vector_search.py

# 6. Upload seed assets to UC Volume
databricks fs cp -r my_project/creative_demo_assets/seed_images \
  dbfs:/Volumes/cme_outcomes_uswest/lakefoundry/artifacts/creative_assets/seed_images
databricks fs cp -r my_project/creative_demo_assets/video_seeds \
  dbfs:/Volumes/cme_outcomes_uswest/lakefoundry/artifacts/creative_assets/video_seeds

# 7. Build and deploy the app
cd my_project
npm ci
npm run build
databricks bundle deploy -t dev
```

The app will be available at: `https://<app-name>-<workspace-id>.aws.databricksapps.com`

### Deployment Script Options

```bash
# Full deployment (all steps)
python scripts/full_deployment.py

# Skip specific steps
python scripts/full_deployment.py --skip-genie --skip-vector-search

# Pipelines only (no app deployment)
python scripts/full_deployment.py --pipelines-only

# App only (assumes pipelines already ran)
python scripts/full_deployment.py --app-only
```

---

## Workspace-Specific Configuration

When deploying to a **new workspace**, you must update the following IDs after running the initial setup:

### 1. SQL Warehouse ID

Find your SQL Warehouse ID in the Databricks UI:
- Go to **SQL** → **SQL Warehouses**
- Click on your warehouse
- Copy the ID from the URL or warehouse details page

Update in **two places**:

**`.env`** (for deployment scripts):
```bash
DATABRICKS_WAREHOUSE_ID=<your-warehouse-id>
```

**`my_project/databricks.yml`** (for the app):
```yaml
variables:
  creative_workflow_sql_warehouse_id:
    default: <your-warehouse-id>

targets:
  dev:
    variables:
      creative_workflow_sql_warehouse_id: <your-warehouse-id>
```

### 2. Genie Space ID

After running `python3 scripts/setup_creative_genie_space.py`, the script outputs a JSON with the `space_id`:

```json
{
  "space_id": "01f1647c7fdd1fa6b6a9751077c50d1d",
  ...
}
```

Update in **`my_project/databricks.yml`**:
```yaml
variables:
  creative_workflow_genie_space_id:
    default: <your-genie-space-id>

targets:
  dev:
    variables:
      creative_workflow_genie_space_id: <your-genie-space-id>
```

### 3. Complete Checklist for New Workspace Deployment

1. ☐ Update `.env` with new `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`
2. ☐ Run `python3 scripts/full_deployment.py --skip-app` (runs pipelines and creates Genie Space)
3. ☐ Note the Genie Space ID from the output
4. ☐ Update `my_project/databricks.yml` with:
   - `creative_workflow_sql_warehouse_id` (from step 1)
   - `creative_workflow_genie_space_id` (from step 3)
5. ☐ Deploy the app: `cd my_project && databricks bundle deploy -t dev`

---

## Step-by-Step Deployment Guide

### Step 1: Environment Setup

1. **Configure Databricks CLI**
   ```bash
   databricks auth login --host https://<workspace>.cloud.databricks.com
   ```

2. **Create `.env` file** (for local development)
   ```bash
   DATABRICKS_HOST=https://<workspace>.cloud.databricks.com
   DATABRICKS_TOKEN=<your-token>  # Optional if using OAuth
   ```

3. **Verify workspace access**
   ```bash
   databricks workspace list /
   databricks catalogs list
   ```

### Step 2: Create Unity Catalog Resources

The pipeline requires these Unity Catalog resources:

```sql
-- Create catalog (if not exists)
CREATE CATALOG IF NOT EXISTS cme_outcomes_uswest;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS cme_outcomes_uswest.lakefoundry;
CREATE SCHEMA IF NOT EXISTS cme_outcomes_uswest.media_demo;

-- Create volume for creative assets
CREATE VOLUME IF NOT EXISTS cme_outcomes_uswest.lakefoundry.artifacts;
```

### Step 3: Upload CSV Seed Data

The `my_project/sample_data/` directory contains CSV seed files:

| CSV File | Description |
|----------|-------------|
| `briefs.csv` | Campaign briefs with objectives and budgets |
| `audiences.csv` | Audience cohorts with reach and LTV |
| `creatives.csv` | Creative assets metadata |
| `activations.csv` | Campaign activations with performance |
| `markets.csv` | Market regions |
| `performance_trend.csv` | Daily performance metrics |
| `channel_mix.csv` | Channel budget allocation |

Upload to UC Volume:
```bash
# Create volume for seed data
databricks fs mkdirs dbfs:/Volumes/cme_outcomes_uswest/lakefoundry/seed_data

# Upload all CSV files
databricks fs cp -r my_project/sample_data/ dbfs:/Volumes/cme_outcomes_uswest/lakefoundry/seed_data/
```

### Step 4: Run Medallion Pipelines

Two pipelines transform the data:

**Pipeline 1: CSV → Bronze → Silver → Gold** (`csv_bronze_pipeline`)
- Loads CSV files from UC Volume into bronze tables
- Cleans and types data in silver layer
- Creates business-ready gold tables in `media_demo` schema

**Pipeline 2: Buyside Data Foundation** (`buyside_data_foundation`)
- Reads from `media_demo` gold tables
- Creates `gold_buyside_*` tables in `lakefoundry` schema
- Generates synthetic creative workflow data

```bash
# Deploy all pipeline definitions
databricks bundle deploy -t dev

# Run Pipeline 1: CSV to Bronze/Silver/Gold
databricks bundle run csv_bronze_pipeline -t dev

# Run Pipeline 2: Buyside gold tables
databricks bundle run buyside_data_foundation -t dev
```

**Pipeline outputs** (in `cme_outcomes_uswest.lakefoundry`):
- `gold_buyside_creative_variant`
- `gold_buyside_creative_generation_request`
- `gold_buyside_audience_cohort`
- `gold_buyside_audience_trait_profile`
- `gold_buyside_base_creative_asset`
- `gold_buyside_creative_policy_check`
- `gold_buyside_synthetic_audience_eval`
- `gold_buyside_activation_export`
- `gold_buyside_campaign_activation`
- `gold_buyside_creative_transformation`
- `gold_buyside_creative_lineage_edge`

### Step 5: Upload Creative Assets to UC Volume

The app serves images and videos from Unity Catalog Volumes:

```bash
# Create directory structure
databricks fs mkdirs dbfs:/Volumes/cme_outcomes_uswest/lakefoundry/artifacts/creative_assets/seed_images
databricks fs mkdirs dbfs:/Volumes/cme_outcomes_uswest/lakefoundry/artifacts/creative_assets/video_seeds

# Upload seed images (if you have them locally)
databricks fs cp -r ./seed_images/ \
  dbfs:/Volumes/cme_outcomes_uswest/lakefoundry/artifacts/creative_assets/seed_images/

# Upload video seeds
databricks fs cp -r ./video_seeds/ \
  dbfs:/Volumes/cme_outcomes_uswest/lakefoundry/artifacts/creative_assets/video_seeds/
```

### Step 6: Set Up Genie Space (for Ask AI)

The Genie Space enables natural language queries:

```bash
python scripts/setup_creative_genie_space.py
```

This creates a Genie Space with access to all gold tables. Note the `space_id` in the output and update `my_project/app.yaml`:

```yaml
- name: GENIE_SPACE_ID
  value: "<your-space-id>"
```

### Step 7: Set Up Vector Search (Optional)

For semantic asset search in Creative Studio:

```bash
python scripts/setup_creative_vector_search.py
```

Update `my_project/app.yaml` with the endpoint and index names.

### Step 8: Build and Deploy the App

```bash
cd my_project

# Install dependencies
npm ci

# Build frontend
npm run build

# Deploy to Databricks Apps
databricks bundle deploy -t dev
```

### Step 9: Verify Deployment

1. **Check app status**
   ```bash
   databricks apps get creative-command-center-dev
   ```

2. **View app logs**
   ```bash
   databricks apps logs creative-command-center-dev
   ```

3. **Access the app**
   Open the URL from the app status (e.g., `https://creative-command-center-dev-<id>.aws.databricksapps.com`)

---

## Configuration Reference

### Root Bundle (`databricks.yml`)

```yaml
variables:
  catalog: "cme_outcomes_uswest"      # Target catalog for gold tables
  schema: "lakefoundry"               # Target schema
  source_catalog: "cme_outcomes_uswest"  # Source catalog (bronze/silver)
  source_schema: "media_demo"         # Source schema
```

### App Configuration (`my_project/app.yaml`)

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_DATA_SOURCE` | `databricks` or `csv` | `databricks` |
| `PIPELINE_CATALOG` | Catalog for gold tables | `cme_outcomes_uswest` |
| `PIPELINE_SCHEMA` | Schema for gold tables | `lakefoundry` |
| `DATABRICKS_WAREHOUSE_ID` | SQL Warehouse ID | Required |
| `GENIE_SPACE_ID` | Genie Space for Ask AI | Optional |
| `CREATIVE_SEED_IMAGE_PATH` | UC Volume path for images | `/Volumes/.../seed_images` |
| `CREATIVE_VIDEO_SEED_PATH` | UC Volume path for videos | `/Volumes/.../video_seeds` |

### Fallback Mode

If pipeline data isn't available, the app falls back to CSV files in `my_project/sample_data/`. Set:
```yaml
- name: APP_DATA_SOURCE
  value: csv
```

---

## Directory Structure

```
cme-buildday-repo-group-3/
├── databricks.yml              # Root bundle configuration
├── .env.example                # Environment template
├── resources/                  # Pipeline and resource definitions
│   ├── buyside_data_foundation.yml   # Gold buyside tables pipeline
│   ├── csv_bronze_pipeline.yml       # CSV → Bronze → Silver → Gold pipeline
│   └── buyside_genie_space.yml       # Genie Space configuration
├── pipelines/                  # Lakeflow DLT pipeline code
│   ├── csv_to_bronze.py              # CSV ingestion + medallion layers
│   ├── audience_cohort_reference.py  # Audience cohort processing
│   ├── campaign_activation.py        # Campaign activation data
│   ├── generated_creative_assets.py  # Creative asset generation
│   └── ...
├── scripts/                    # Setup and deployment utilities
│   ├── full_deployment.py            # Orchestrates complete deployment
│   ├── generate_synthetic_creative_workflow.py
│   ├── setup_creative_genie_space.py
│   └── setup_creative_vector_search.py
├── my_project/                 # Databricks App
│   ├── app/main.py            # FastAPI backend (7700+ lines)
│   ├── src/App.tsx            # React frontend (5500+ lines)
│   ├── sample_data/           # CSV seed/fallback data
│   ├── creative_demo_assets/  # Seed images and videos
│   ├── databricks.yml         # App bundle config
│   └── app.yaml               # App environment config
├── docs/                       # Documentation
│   └── agents/                # Agent configuration docs
└── build-day-data-dictionary.md  # Complete data contract
```

---

## Troubleshooting

### App deploy fails with "Invalid SQL warehouse resource"
- The SQL Warehouse ID in `my_project/databricks.yml` doesn't exist in your workspace
- Update `creative_workflow_sql_warehouse_id` with your workspace's SQL Warehouse ID
- See [Workspace-Specific Configuration](#workspace-specific-configuration)

### Pipeline fails with "table already managed by another pipeline"
- Tables in Unity Catalog can only be owned by one pipeline at a time
- Drop the existing tables before running the new pipeline:
  ```sql
  DROP TABLE IF EXISTS cme_outcomes_uswest.media_demo.gold_media_creative_briefs;
  -- Drop other conflicting tables as needed
  ```
- Or delete the old pipeline from the Databricks UI to release table ownership

### Pipeline fails with "workspace_id mismatch"
- Bundle was previously deployed to a different workspace
- Remove the local Terraform state and redeploy:
  ```bash
  rm -rf .databricks
  databricks bundle deploy -t dev --force-lock
  ```

### Pipeline fails with "Unity Catalog credential scope missing"
- Serverless pipelines may have network/credential issues in some workspaces
- Try switching to a classic cluster by updating the pipeline YAML:
  ```yaml
  serverless: false
  clusters:
    - label: default
      autoscale:
        min_workers: 1
        max_workers: 4
  ```

### Pipeline fails with "table not found"
- Ensure source tables exist in `cme_outcomes_uswest.media_demo`
- Run the `source_tables_bootstrap` pipeline first if upstream tables are missing
- Check catalog/schema grants: `GRANT USE CATALOG ON CATALOG cme_outcomes_uswest TO <principal>`

### App shows CSV fallback data
- Verify `APP_DATA_SOURCE=databricks` in `app.yaml`
- Check SQL Warehouse is running and accessible
- Verify gold tables exist: `SHOW TABLES IN cme_outcomes_uswest.lakefoundry`

### Images/videos not loading
- Verify UC Volume exists and has files:
  ```bash
  databricks fs ls dbfs:/Volumes/cme_outcomes_uswest/lakefoundry/artifacts/creative_assets/
  ```
- Check app has `READ_VOLUME` permission in `resources/creative_command_center.app.yml`

### Genie/Ask AI not working
- Verify `GENIE_SPACE_ID` is set correctly in `my_project/databricks.yml`
- Ensure the Genie Space ID matches what was created in your workspace
- Check Genie Space has table access
- Fallback mode uses table summaries if Genie is unavailable

---

## Development

### Local Frontend Development

```bash
cd my_project
npm ci
npm run dev  # Starts Vite dev server on localhost:5173
```

### Local Backend Development

```bash
cd my_project
pip install -r requirements.txt
python -m app.main  # Starts FastAPI on localhost:8000
```

### Run Tests

```bash
cd my_project
pytest tests/
```

---

## What's Included

- **Overview Dashboard** - KPIs, pacing trends, channel mix, quality radar
- **Briefs Management** - Campaign briefs with objectives and budgets
- **Audience Targeting** - Segment traits, reach analysis, cohort selection
- **Creative Studio** - Asset search, variant generation, video treatments, approval workflow
- **Evaluation** - Policy checks, synthetic audience scoring, activation readiness
- **Activations** - Multi-channel submission, lineage tracing, delivery status
- **Ask AI** - Natural language queries via Genie or governed fallback
- **Architecture Views** - Business, Platform, Data & ML diagrams
- **Talk Track** - Presenter guide for demos

---

## License

Internal use only. See LICENSE file for details.
