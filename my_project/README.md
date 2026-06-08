# Creative Command Center

Databricks App demo with a FastAPI backend and Vite/React frontend. The backend can read Databricks SQL pipeline tables and falls back to bundled CSV extracts when workspace grants or tables are unavailable.

The dev app deployment sets `APP_DATA_SOURCE=databricks` and targets `fs_dev_gold.creative_command_center` for generated buyside workflow tables, dashboard/reference tables, creative asset volume paths, and source briefs. FastAPI serves same-origin `/api/*` routes and exposes backend-table metadata through `/api/backend-tables`, including any per-table fallback errors.

The Audience lens does not call a real Databricks Model Serving endpoint in this branch. The app verifies that explicitly through `/api/model-status`; a production integration can add a serving endpoint behind the same API boundary later.

## Pipeline And Backend Files

This branch keeps the Databricks backend artifacts from `feat/lf-personalized-creative-activation-command-center` so the backend load path is visible alongside the UI:

- `../databricks.yml`, `../resources/*.yml`, and `../pipelines/*.py` define the root Lakeflow pipeline bundle for the buyside generated tables.
- `resources/campaign_activation_etl.pipeline.yml`, `src/campaign_activation_etl/transformations/campaign_activation.py`, and `pyproject.toml` are the restored app-local ETL package from that branch.
- `app/main.py` is the app data gateway. In Databricks mode it reads `gold_media_creative_briefs` from `cme_outcomes_uswest.media_demo` and the generated `gold_buyside_*` tables from `cme_outcomes_uswest.lakefoundry`.

For the bronze/silver/gold story, the checked-in code creates and serves the gold layer used by the UI. Bronze and silver data are upstream to this repo through the `media_demo` contract and source tables; that source branch did not include separate bronze or silver pipeline files to copy.

## Deploy To Any Databricks Workspace

Authenticate the Databricks CLI to the workspace you want to use, then run:

```bash
cd my_project
npm ci
npm run build
databricks bundle deploy -t dev
databricks bundle run creative_command_center -t dev
```

If the default app name already exists in the target workspace, override it:

```bash
databricks bundle deploy -t dev --var app_name=my-creative-command-center
databricks bundle run creative_command_center -t dev --var app_name=my-creative-command-center
```

The app bundle deploys only the Databricks App resource in `resources/creative_command_center.app.yml`. The app source path includes `sample_data/`, so the CSV extracts deploy with the app. The full buyside pipeline is deployed from the repository root bundle.

## Unity Catalog External Lineage

The app can publish Databricks Bring Your Own Lineage metadata for approved creative variants. When `UC_EXTERNAL_LINEAGE_ENABLED=true`, approval writes an external metadata node such as `creative_generation_job_VAR_000123` and creates lineage relationships:

`base image path -> creative generation job -> final approved image path -> gold_buyside_creative_variant`

This is best-effort and does not block creative approval. If the workspace has not enabled the public preview or the app principal lacks privileges, the approval response includes the lineage error under `approval.uc_external_lineage`.

Required workspace privileges:

- `CREATE EXTERNAL METADATA` on the metastore for the app principal.
- `MODIFY` on the external metadata object for updates or repeated publication.
- `READ_VOLUME` / `WRITE_VOLUME` on `fs_dev_gold.creative_command_center.artifacts`.
- `SELECT` on `fs_dev_gold.creative_command_center.gold_buyside_creative_variant`.

You can re-run lineage publication for an already-approved creative:

```bash
curl -X POST "$APP_URL/api/creative-variants/<creative_asset_id>/uc-external-lineage"
```

## Local Development

```bash
npm ci
npm run dev
```

For a production-style local check:

```bash
npm run build
python -m app.main
```

To run locally against Databricks pipeline tables, load your workspace credentials and set a SQL warehouse:

```bash
set -a; source ../.env; set +a
APP_DATA_SOURCE=databricks DATABRICKS_WAREHOUSE_ID=<warehouse-id> python -m app.main
```
