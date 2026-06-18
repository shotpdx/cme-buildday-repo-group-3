#!/usr/bin/env python3
"""
Creative Command Center - Full Deployment Script

This script orchestrates the complete deployment of the Creative Command Center:
1. Creates Unity Catalog resources (catalog, schemas, volumes)
2. Uploads CSV seed data to UC Volume
3. Runs the CSV-to-Bronze pipeline
4. Runs the Source Tables Bootstrap pipeline (creates upstream gold tables)
5. Runs the Buyside Data Foundation pipeline (creates gold tables)
6. Sets up Genie Space for Ask AI
7. Sets up Vector Search for asset search
8. Uploads creative assets (images, videos)
9. Builds and deploys the Databricks App

Prerequisites:
- Databricks CLI configured (databricks auth login)
- Node.js 18+ and npm installed
- Python 3.9+ with databricks-sdk installed

Usage:
    python scripts/full_deployment.py [--skip-pipelines] [--skip-genie] [--skip-app]
"""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

# Try to import databricks SDK
try:
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.service.catalog import VolumeType
    HAS_SDK = True
except ImportError:
    HAS_SDK = False
    print("Warning: databricks-sdk not installed. Some features will use CLI fallback.")


# Paths
REPO_ROOT = Path(__file__).parent.parent
MY_PROJECT = REPO_ROOT / "my_project"
SAMPLE_DATA = MY_PROJECT / "sample_data"
SEED_IMAGES = MY_PROJECT / "creative_demo_assets" / "20260531" / "seed_images"
VIDEO_SEEDS = MY_PROJECT / "app" / "video_assets" / "seeds"
ENV_FILE = REPO_ROOT / ".env"
ENV_EXAMPLE = REPO_ROOT / ".env.example"


def load_env_file():
    """Load environment variables from .env file if it exists."""
    if ENV_FILE.exists():
        print(f"Loading configuration from {ENV_FILE}")
        with open(ENV_FILE) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip())
    else:
        print(f"Warning: {ENV_FILE} not found. Using environment variables or defaults.")


def validate_configuration():
    """Validate required configuration before proceeding."""
    print("\n" + "="*70)
    print("CONFIGURATION VALIDATION")
    print("="*70 + "\n")

    errors = []
    warnings = []

    # Check DATABRICKS_HOST
    host = os.getenv("DATABRICKS_HOST", "")
    if not host:
        errors.append("DATABRICKS_HOST is not set")
    elif "<workspace>" in host or host == "https://.cloud.databricks.com":
        errors.append("DATABRICKS_HOST contains placeholder value. Please set your actual workspace URL.")
    else:
        print(f"✓ DATABRICKS_HOST: {host}")

    # Check DATABRICKS_TOKEN (optional if using OAuth)
    token = os.getenv("DATABRICKS_TOKEN", "")
    if not token:
        warnings.append("DATABRICKS_TOKEN is not set. Make sure you're authenticated via 'databricks auth login'")
    elif token.startswith("dapi") and len(token) < 20:
        errors.append("DATABRICKS_TOKEN appears to be incomplete")
    elif "..." in token or token == "dapi...":
        errors.append("DATABRICKS_TOKEN contains placeholder value. Please set your actual token.")
    else:
        print(f"✓ DATABRICKS_TOKEN: {'*' * 10}...{token[-4:]}")

    # Check DATABRICKS_WAREHOUSE_ID
    warehouse_id = os.getenv("DATABRICKS_WAREHOUSE_ID", "")
    if not warehouse_id:
        warnings.append("DATABRICKS_WAREHOUSE_ID is not set. Some SQL operations may fail.")
    elif "<" in warehouse_id or warehouse_id == "your-warehouse-id":
        errors.append("DATABRICKS_WAREHOUSE_ID contains placeholder value. Please set your actual warehouse ID.")
    else:
        print(f"✓ DATABRICKS_WAREHOUSE_ID: {warehouse_id}")

    # Check catalog/schema (these have defaults so just info)
    catalog = os.getenv("PIPELINE_CATALOG", "cme_outcomes_uswest")
    schema = os.getenv("PIPELINE_SCHEMA", "lakefoundry")
    print(f"✓ PIPELINE_CATALOG: {catalog}")
    print(f"✓ PIPELINE_SCHEMA: {schema}")

    # Print warnings
    if warnings:
        print("\n⚠️  WARNINGS:")
        for w in warnings:
            print(f"   - {w}")

    # Print errors and exit if any
    if errors:
        print("\n❌ CONFIGURATION ERRORS:")
        for e in errors:
            print(f"   - {e}")
        print(f"""
╔══════════════════════════════════════════════════════════════════════╗
║                    CONFIGURATION REQUIRED                            ║
╠══════════════════════════════════════════════════════════════════════╣
║  Please update your .env file with the correct values:               ║
║                                                                      ║
║  1. Copy .env.example to .env (if not already done):                 ║
║     cp .env.example .env                                             ║
║                                                                      ║
║  2. Edit .env and fill in your values:                               ║
║     DATABRICKS_HOST=https://your-workspace.cloud.databricks.com      ║
║     DATABRICKS_TOKEN=dapi1234567890abcdef...                         ║
║     DATABRICKS_WAREHOUSE_ID=abc123def456                             ║
║                                                                      ║
║  To find your SQL Warehouse ID:                                      ║
║  - Go to Databricks workspace → SQL → SQL Warehouses                 ║
║  - Click on your warehouse → Copy the ID from the URL or details     ║
╚══════════════════════════════════════════════════════════════════════╝
""")
        sys.exit(1)

    print("\n✓ Configuration validation passed!\n")
    return True


def check_prerequisites():
    """Check that required tools are installed."""
    print("\n" + "="*70)
    print("CHECKING PREREQUISITES")
    print("="*70 + "\n")

    errors = []

    # Check Databricks CLI
    result = subprocess.run(["databricks", "--version"], capture_output=True, text=True)
    if result.returncode == 0:
        print(f"✓ Databricks CLI: {result.stdout.strip()}")
    else:
        errors.append("Databricks CLI not found. Install with: curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh")

    # Check Node.js
    result = subprocess.run(["node", "--version"], capture_output=True, text=True)
    if result.returncode == 0:
        print(f"✓ Node.js: {result.stdout.strip()}")
    else:
        errors.append("Node.js not found. Install from https://nodejs.org/")

    # Check npm
    result = subprocess.run(["npm", "--version"], capture_output=True, text=True)
    if result.returncode == 0:
        print(f"✓ npm: {result.stdout.strip()}")
    else:
        errors.append("npm not found. Install Node.js which includes npm.")

    # Check Python
    print(f"✓ Python: {sys.version.split()[0]}")

    if errors:
        print("\n❌ MISSING PREREQUISITES:")
        for e in errors:
            print(f"   - {e}")
        sys.exit(1)

    print("\n✓ All prerequisites met!\n")
    return True


# Configuration (loaded after env file)
def get_config():
    """Get configuration after loading .env file."""
    return {
        "CATALOG": os.getenv("PIPELINE_CATALOG", "cme_outcomes_uswest"),
        "SCHEMA": os.getenv("PIPELINE_SCHEMA", "lakefoundry"),
        "SOURCE_SCHEMA": "media_demo",
        "APP_NAME": os.getenv("APP_NAME", "creative-command-center-dev"),
        "TARGET": os.getenv("DATABRICKS_TARGET", "dev"),
        "SQL_WAREHOUSE_ID": os.getenv("DATABRICKS_WAREHOUSE_ID", ""),
    }


# Global config - will be set after validation
CATALOG = None
SCHEMA = None
SOURCE_SCHEMA = None
APP_NAME = None
TARGET = None
SQL_WAREHOUSE_ID = None


def init_config():
    """Initialize global configuration."""
    global CATALOG, SCHEMA, SOURCE_SCHEMA, APP_NAME, TARGET, SQL_WAREHOUSE_ID
    config = get_config()
    CATALOG = config["CATALOG"]
    SCHEMA = config["SCHEMA"]
    SOURCE_SCHEMA = config["SOURCE_SCHEMA"]
    APP_NAME = config["APP_NAME"]
    TARGET = config["TARGET"]
    SQL_WAREHOUSE_ID = config["SQL_WAREHOUSE_ID"]


def run_command(cmd: list[str], cwd: Path = None, check: bool = True) -> subprocess.CompletedProcess:
    """Run a shell command and return the result."""
    print(f"\n{'='*60}")
    print(f"Running: {' '.join(cmd)}")
    print(f"{'='*60}")

    result = subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True
    )

    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

    if check and result.returncode != 0:
        print(f"Command failed with exit code {result.returncode}")
        sys.exit(1)

    return result


def step_header(step_num: int, title: str):
    """Print a step header."""
    print(f"\n{'#'*70}")
    print(f"# Step {step_num}: {title}")
    print(f"{'#'*70}\n")


def create_uc_resources():
    """Create Unity Catalog resources using SQL."""
    step_header(1, "Creating Unity Catalog Resources")

    print("""
NOTE: Unity Catalog resources (catalog, schemas, volumes) must be created manually
or by a user with appropriate permissions. Run these SQL commands in a Databricks
SQL editor or notebook:

    CREATE CATALOG IF NOT EXISTS {catalog};
    CREATE SCHEMA IF NOT EXISTS {catalog}.{schema};
    CREATE SCHEMA IF NOT EXISTS {catalog}.{source_schema};
    CREATE VOLUME IF NOT EXISTS {catalog}.{schema}.artifacts;
    CREATE VOLUME IF NOT EXISTS {catalog}.{schema}.seed_data;

If the resources already exist, you can skip this step with --skip-uc
""".format(catalog=CATALOG, schema=SCHEMA, source_schema=SOURCE_SCHEMA))

    # Try using the Databricks SDK if available
    if HAS_SDK:
        try:
            print("Attempting to create resources using Databricks SDK...")
            w = WorkspaceClient()

            # Check if catalog exists
            try:
                w.catalogs.get(CATALOG)
                print(f"Catalog {CATALOG} already exists.")
            except Exception:
                print(f"Catalog {CATALOG} does not exist. Please create it manually.")

            # Check if schemas exist
            for schema_name in [SCHEMA, SOURCE_SCHEMA]:
                try:
                    w.schemas.get(f"{CATALOG}.{schema_name}")
                    print(f"Schema {CATALOG}.{schema_name} already exists.")
                except Exception:
                    print(f"Schema {CATALOG}.{schema_name} does not exist. Please create it manually.")

            print("SDK check complete.")
        except Exception as e:
            print(f"SDK check failed: {e}")
            print("Please ensure Unity Catalog resources exist before proceeding.")
    else:
        print("Databricks SDK not available. Please verify UC resources exist manually.")


def upload_seed_data():
    """Upload CSV seed data to UC Volume."""
    step_header(2, "Uploading CSV Seed Data to UC Volume")

    volume_path = f"dbfs:/Volumes/{CATALOG}/{SCHEMA}/seed_data"

    # Check if sample_data exists
    if not SAMPLE_DATA.exists():
        print(f"Warning: {SAMPLE_DATA} not found. Skipping CSV upload.")
        return

    # Upload each CSV file
    for csv_file in SAMPLE_DATA.glob("*.csv"):
        print(f"Uploading {csv_file.name}...")
        run_command([
            "databricks", "fs", "cp",
            str(csv_file),
            f"{volume_path}/{csv_file.name}",
            "--overwrite"
        ])

    print("CSV seed data uploaded successfully.")


def run_csv_bronze_pipeline():
    """Run the CSV to Bronze pipeline."""
    step_header(3, "Running CSV to Bronze/Silver/Gold Pipeline")

    # Deploy the pipeline
    run_command([
        "databricks", "bundle", "deploy",
        "-t", TARGET
    ], cwd=REPO_ROOT)

    # Run the pipeline
    run_command([
        "databricks", "bundle", "run",
        "csv_bronze_pipeline",
        "-t", TARGET
    ], cwd=REPO_ROOT)

    print("CSV to Bronze pipeline completed.")


def run_source_tables_bootstrap():
    """Run the Source Tables Bootstrap pipeline to create upstream gold tables."""
    step_header(4, "Running Source Tables Bootstrap Pipeline")

    run_command([
        "databricks", "bundle", "run",
        "source_tables_bootstrap",
        "-t", TARGET
    ], cwd=REPO_ROOT)

    print("Source Tables Bootstrap pipeline completed.")


def run_buyside_pipeline():
    """Run the Buyside Data Foundation pipeline."""
    step_header(5, "Running Buyside Data Foundation Pipeline")

    run_command([
        "databricks", "bundle", "run",
        "buyside_data_foundation",
        "-t", TARGET
    ], cwd=REPO_ROOT)

    print("Buyside Data Foundation pipeline completed.")


def setup_genie_space():
    """Set up Genie Space for Ask AI."""
    step_header(6, "Setting Up Genie Space")

    genie_script = REPO_ROOT / "scripts" / "setup_creative_genie_space.py"
    if genie_script.exists():
        run_command([sys.executable, str(genie_script)])
    else:
        print(f"Warning: {genie_script} not found. Skipping Genie setup.")


def setup_vector_search():
    """Set up Vector Search for asset search."""
    step_header(7, "Setting Up Vector Search")

    vs_script = REPO_ROOT / "scripts" / "setup_creative_vector_search.py"
    if vs_script.exists():
        run_command([sys.executable, str(vs_script)], check=False)
    else:
        print(f"Warning: {vs_script} not found. Skipping Vector Search setup.")


def upload_creative_assets():
    """Upload seed images and videos to UC Volume."""
    step_header(8, "Uploading Creative Assets to UC Volume")

    assets_base = f"dbfs:/Volumes/{CATALOG}/{SCHEMA}/artifacts/creative_assets"

    # Create directories
    run_command([
        "databricks", "fs", "mkdirs",
        f"{assets_base}/seed_images"
    ], check=False)

    run_command([
        "databricks", "fs", "mkdirs",
        f"{assets_base}/video_seeds"
    ], check=False)

    # Upload seed images if they exist
    if SEED_IMAGES.exists() and any(SEED_IMAGES.iterdir()):
        print("Uploading seed images...")
        run_command([
            "databricks", "fs", "cp", "-r",
            str(SEED_IMAGES),
            f"{assets_base}/seed_images",
            "--overwrite"
        ])
    else:
        print(f"Warning: No seed images found at {SEED_IMAGES}")

    # Upload video seeds if they exist
    if VIDEO_SEEDS.exists() and any(VIDEO_SEEDS.iterdir()):
        print("Uploading video seeds...")
        run_command([
            "databricks", "fs", "cp", "-r",
            str(VIDEO_SEEDS),
            f"{assets_base}/video_seeds",
            "--overwrite"
        ])
    else:
        print(f"Warning: No video seeds found at {VIDEO_SEEDS}")

    print("Creative assets uploaded.")


def build_frontend():
    """Build the React frontend."""
    step_header(9, "Building Frontend")

    # Install dependencies
    run_command(["npm", "ci"], cwd=MY_PROJECT)

    # Build
    run_command(["npm", "run", "build"], cwd=MY_PROJECT)

    print("Frontend built successfully.")


def deploy_app():
    """Deploy the Databricks App."""
    step_header(10, "Deploying Databricks App")

    # Deploy the app bundle
    run_command([
        "databricks", "bundle", "deploy",
        "-t", TARGET
    ], cwd=MY_PROJECT)

    print(f"\nApp deployed successfully!")
    print(f"Access your app at: https://{APP_NAME}-<workspace-id>.aws.databricksapps.com")


def verify_deployment():
    """Verify the deployment."""
    step_header(11, "Verifying Deployment")

    # Check app status
    result = run_command([
        "databricks", "apps", "get", APP_NAME
    ], check=False)

    # List tables
    print("\nVerifying gold tables...")
    run_command([
        "databricks", "sql", "execute",
        "--statement", f"SHOW TABLES IN {CATALOG}.{SCHEMA} LIKE 'gold_*'"
    ], check=False)

    print("\n" + "="*70)
    print("DEPLOYMENT COMPLETE!")
    print("="*70)
    print(f"""
Next steps:
1. Open the app URL shown above
2. If you see CSV fallback data, check that pipelines completed successfully
3. For Ask AI, ensure Genie Space ID is configured in app.yaml
4. For asset search, ensure Vector Search endpoint is configured

Troubleshooting:
- View app logs: databricks apps logs {APP_NAME}
- Check pipeline status in Databricks workspace UI
- Verify table grants: GRANT SELECT ON CATALOG {CATALOG} TO <principal>
""")


def main():
    parser = argparse.ArgumentParser(
        description="Deploy the Creative Command Center end-to-end"
    )
    parser.add_argument(
        "--skip-uc",
        action="store_true",
        help="Skip Unity Catalog resource creation"
    )
    parser.add_argument(
        "--skip-csv",
        action="store_true",
        help="Skip CSV seed data upload"
    )
    parser.add_argument(
        "--skip-pipelines",
        action="store_true",
        help="Skip running DLT pipelines"
    )
    parser.add_argument(
        "--skip-bootstrap",
        action="store_true",
        help="Skip running Source Tables Bootstrap pipeline"
    )
    parser.add_argument(
        "--skip-genie",
        action="store_true",
        help="Skip Genie Space setup"
    )
    parser.add_argument(
        "--skip-vector-search",
        action="store_true",
        help="Skip Vector Search setup"
    )
    parser.add_argument(
        "--skip-assets",
        action="store_true",
        help="Skip creative asset upload"
    )
    parser.add_argument(
        "--skip-app",
        action="store_true",
        help="Skip app build and deployment"
    )
    parser.add_argument(
        "--pipelines-only",
        action="store_true",
        help="Only run pipelines (skip everything else)"
    )
    parser.add_argument(
        "--app-only",
        action="store_true",
        help="Only build and deploy app (skip everything else)"
    )

    args = parser.parse_args()

    print("""
    ╔═══════════════════════════════════════════════════════════════════╗
    ║         CREATIVE COMMAND CENTER - FULL DEPLOYMENT                 ║
    ╠═══════════════════════════════════════════════════════════════════╣
    ║  This script will:                                                ║
    ║  1. Create Unity Catalog resources                                ║
    ║  2. Upload CSV seed data                                          ║
    ║  3. Run CSV to Bronze/Silver/Gold pipeline                        ║
    ║  4. Run Source Tables Bootstrap pipeline                          ║
    ║  5. Run Buyside Data Foundation pipeline                          ║
    ║  6. Set up Genie Space                                            ║
    ║  7. Set up Vector Search                                          ║
    ║  8. Upload creative assets                                        ║
    ║  9. Build and deploy the app                                      ║
    ╚═══════════════════════════════════════════════════════════════════╝
    """)

    # Load .env file and validate configuration
    load_env_file()
    validate_configuration()
    check_prerequisites()
    init_config()

    # Handle --pipelines-only
    if args.pipelines_only:
        run_csv_bronze_pipeline()
        run_source_tables_bootstrap()
        run_buyside_pipeline()
        return

    # Handle --app-only
    if args.app_only:
        build_frontend()
        deploy_app()
        verify_deployment()
        return

    # Full deployment
    if not args.skip_uc:
        create_uc_resources()

    if not args.skip_csv:
        upload_seed_data()

    if not args.skip_pipelines:
        run_csv_bronze_pipeline()
        if not args.skip_bootstrap:
            run_source_tables_bootstrap()
        run_buyside_pipeline()

    if not args.skip_genie:
        setup_genie_space()

    if not args.skip_vector_search:
        setup_vector_search()

    if not args.skip_assets:
        upload_creative_assets()

    if not args.skip_app:
        build_frontend()
        deploy_app()

    verify_deployment()


if __name__ == "__main__":
    main()
