# Creative Command Center

Self-contained Databricks App demo with a FastAPI backend and Vite/React frontend.

The default app deployment does not require a catalog, schema, SQL warehouse, Genie Space, Lakebase database, or any pre-existing backend tables. FastAPI serves mock API responses from `app/main.py`, and the React app calls those same-origin `/api/*` routes.

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

The bundle deploys only the Databricks App resource in `resources/creative_command_center.app.yml`.

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
