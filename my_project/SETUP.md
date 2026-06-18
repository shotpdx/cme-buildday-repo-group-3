# Creative Command Center - Setup Guide

Complete setup instructions for deploying the Creative Command Center demo from a zip file.

---

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

| Tool | Version | Installation |
|------|---------|--------------|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) or `brew install node` |
| **Python** | 3.9+ | [python.org](https://python.org/) or `brew install python` |
| **Databricks CLI** | 0.299+ | See installation below |

### Install Databricks CLI

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh

# Verify installation
databricks --version
```

---

## Quick Start (5 minutes)

### Step 1: Extract and Navigate

```bash
# Extract the zip file
unzip cme-buildday-repo-group-3.zip
cd cme-buildday-repo-group-3/my_project
```

### Step 2: Create Environment File

Create a `.env` file in the **root directory** (not in `my_project/`):

```bash
cd ..  # Go to root directory
cat > .env << 'EOF'
DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
DATABRICKS_TOKEN=your-personal-access-token
EOF
cd my_project
```

**To get your Databricks token:**
1. Go to your Databricks workspace
2. Click your username (top-right) → **Settings**
3. Go to **Developer** → **Access tokens**
4. Click **Generate new token**
5. Copy the token (you won't see it again!)

### Step 3: Install Dependencies

```bash
npm ci
```

### Step 4: Build the Frontend

```bash
npm run build
```

### Step 5: Deploy to Databricks

```bash
# Load environment variables and deploy
export $(cat ../.env | xargs)
databricks bundle deploy -t dev
```

### Step 6: Run the App

```bash
databricks bundle run creative_command_center -t dev
```

The CLI will output the app URL when deployment is complete:
```
✓ App started successfully
You can access the app at https://creative-command-center-dev-XXXXX.aws.databricksapps.com
```

---

## Local Development

Run the app locally without deploying to Databricks:

```bash
cd my_project
npm ci
npm run dev
```

This starts:
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend**: http://localhost:8000 (FastAPI)

---

## Detailed Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABRICKS_HOST` | Your workspace URL | `https://dbc-xxxxx.cloud.databricks.com` |
| `DATABRICKS_TOKEN` | Personal access token | `dapi612f33ec96f1d7cc...` |

### Custom App Name

If the default app name (`creative-command-center-dev`) already exists:

```bash
# Deploy with custom name
databricks bundle deploy -t dev --var app_name=my-custom-app-name

# Run with custom name
databricks bundle run creative_command_center -t dev --var app_name=my-custom-app-name
```

### Production Deployment

```bash
databricks bundle deploy -t prod
databricks bundle run creative_command_center -t prod
```

---

## Project Structure

```
my_project/
├── app/                    # FastAPI backend
│   └── main.py            # API routes and data loading
├── src/                    # React frontend
│   ├── App.tsx            # Main application component
│   └── main.tsx           # Entry point
├── sample_data/           # CSV data files (deployed with app)
│   ├── audiences.csv
│   ├── creatives.csv
│   ├── activations.csv
│   ├── markets.csv
│   ├── briefs.csv
│   └── ...
├── resources/             # Databricks bundle resources
│   └── creative_command_center.app.yml
├── databricks.yml         # Bundle configuration
├── package.json           # Node.js dependencies
└── requirements.txt       # Python dependencies
```

---

## Troubleshooting

### Error: "Terraform key expired"

Update the Databricks CLI:
```bash
curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh
```

### Error: "resource not found"

Make sure you're in the `my_project/` directory when running bundle commands:
```bash
cd my_project
databricks bundle deploy -t dev
```

### Error: "app name already exists"

Use a custom app name:
```bash
databricks bundle deploy -t dev --var app_name=my-unique-app-name
```

### Port already in use (local dev)

The dev server will automatically try another port. Check the terminal output for the actual URL.

### Python dependencies missing

```bash
pip install -r requirements.txt
```

---

## Demo Walkthrough

### Architecture Menu (for technical audiences)

Access via the **Architecture** button in the sidebar:

1. **Business Flow** - User journey from Plan → Target → Create → Activate → Optimize
2. **Data & ML Pipelines** - End-to-end data architecture with medallion layers
3. **Platform Architecture** - AWS hosting, security zones, authentication flow
4. **Agent Topology** - Multi-agent AI orchestration design

### Main Application Tabs

1. **Overview** - Campaign KPIs, spend trends, quality metrics
2. **Briefs** - Campaign intake and approval workflow
3. **Audiences** - Cohort reach, match rates, LTV analysis
4. **Creatives** - Asset quality scores, predicted CTR
5. **Markets** - Geographic performance and expansion opportunities
6. **Activations** - Platform delivery status and sync health
7. **Ask AI** - Natural language campaign questions
8. **Talk Track** - Presenter guide with deployment details

---

## Support

- **Databricks Documentation**: https://docs.databricks.com/
- **Databricks CLI Reference**: https://docs.databricks.com/dev-tools/cli/
- **Asset Bundles Guide**: https://docs.databricks.com/dev-tools/bundles/

---

## What's Included

This demo is **self-contained** and does not require:
- Pre-existing Unity Catalog tables
- SQL Warehouse
- Genie Space
- Model Serving endpoints
- Any external data sources

All data is bundled as CSV files and served through FastAPI. The architecture views show the production path where these components would connect.
