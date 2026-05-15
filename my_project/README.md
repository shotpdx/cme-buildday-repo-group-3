# Creative Command Center

Self-contained Databricks App demo with a CSV-backed FastAPI backend and Vite/React frontend.

The default app deployment does not require a catalog, schema, SQL warehouse, Genie Space, Lakebase database, or any pre-existing backend tables. FastAPI loads bundled sample data from `sample_data/*.csv`, serves same-origin `/api/*` routes, and exposes backend-table metadata through `/api/backend-tables`.

The Audience lens does not call a real Databricks Model Serving endpoint in this branch. The app verifies that explicitly through `/api/model-status`; a production integration can add a serving endpoint behind the same API boundary later.

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

The bundle deploys only the Databricks App resource in `resources/creative_command_center.app.yml`. The app source path includes `sample_data/`, so the CSV extracts deploy with the app.

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
