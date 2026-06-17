"""
Campaign Trafficking & Activation Table - DLT Pipeline

Creates the gold_buyside_campaign_activation table with:
- Activation tracking (DSP, placement, trafficking status)
- Performance metrics (impressions, clicks, conversions, cost)
- A/B test references
- ~50 seed activations linked to existing line items and generated creatives
"""

from pyspark import pipelines as dp
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, LongType, DoubleType, TimestampType, BooleanType
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import logging

# Configure logging for pipeline
logger = logging.getLogger(__name__)


@dp.table(name="cme_outcomes_uswest.lakefoundry.gold_buyside_campaign_activation")
def campaign_activation():
    """
    Campaign Trafficking & Activation table with performance metrics.
    
    Grain: One row per activation (creative + line_item + DSP combination)
    """
    
    # Get configuration from pipeline settings
    catalog = spark.conf.get("target_catalog", "cme_outcomes_uswest")
    schema = spark.conf.get("target_schema", "lakefoundry")
    source_catalog = spark.conf.get("source_catalog", "cme_outcomes_uswest")
    source_schema = spark.conf.get("source_schema", "media_demo")
    
    # Read source tables
    line_items_df = spark.read.table(f"{source_catalog}.{source_schema}.gold_media_media_plan_line_items")
    
    # Try to read generated creatives if available, otherwise use empty dataframe
    try:
        creatives_df = spark.read.table(f"{catalog}.{schema}.gold_buyside_generated_creatives")
    except Exception as e:
        # If creatives table doesn't exist yet, we'll generate synthetic data
        logger.warning(f"Generated creatives table not found: {str(e)}. Proceeding with synthetic creative IDs.")
        creatives_df = None
    
    # Collect line items for seeding
    line_items_list = line_items_df.select("line_item_id", "campaign_id", "brief_id").collect()
    
    if len(line_items_list) == 0:
        # Return empty dataframe with correct schema if no line items
        logger.warning("No line items found in source table. Returning empty activation table.")
        return spark.createDataFrame([], schema=_get_activation_schema())
    
    # DSP platforms
    dsps = ["The_Trade_Desk", "DV360", "Amazon_DSP", "Meta", "Google_Ads", "TikTok", "Innovid"]
    
    # Trafficking statuses
    statuses = ["Draft", "Submitted", "Live", "Paused", "Ended"]
    
    # Generate synthetic activations
    activations_data = []
    
    # Use numpy for reproducibility
    np.random.seed(42)
    
    # Generate ~50 activations
    n_activations = 50
    
    # Base timestamps
    end_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    start_date = end_date - timedelta(days=90)
    
    for i in range(n_activations):
        # Pick a random line item
        line_item = line_items_list[i % len(line_items_list)]
        
        # Generate creative_asset_id (synthetic, referencing generated_creatives)
        # Format: CREAT-{6 digits}
        creative_asset_id = f"CREAT-{(i * 7 + 1):06d}"
        
        # Pick a random DSP
        dsp = np.random.choice(dsps)
        
        # Generate placement ID based on DSP
        placement_id = f"{dsp.upper()}-PLCMT-{(i * 3 + 1):05d}"
        
        # Trafficking status with realistic distribution
        # Most are Live, some Draft/Submitted, few Paused/Ended
        status_probs = [0.05, 0.10, 0.70, 0.10, 0.05]
        status = np.random.choice(statuses, p=status_probs)
        
        # Activation timestamp (when activated)
        activation_ts = start_date + timedelta(days=np.random.randint(0, 91))
        
        # Last sync timestamp (more recent than activation)
        days_since_activation = (end_date - activation_ts).days
        last_sync_ts = activation_ts + timedelta(days=np.random.randint(0, max(1, days_since_activation)))
        
        # Performance metrics - realistic ranges
        # impressions: 10K-1M range
        impressions = int(np.random.lognormal(mean=11, sigma=1.5))
        impressions = max(10000, min(1000000, impressions))
        
        # clicks: 0.5-3% of impressions
        click_rate = np.random.uniform(0.005, 0.03)
        clicks = int(impressions * click_rate)
        
        # conversions: 1-10% of clicks
        conversion_rate = np.random.uniform(0.01, 0.10)
        conversions = int(clicks * conversion_rate)
        
        # cost: $0.50-$5.00 CPM
        cpm = np.random.uniform(0.50, 5.00)
        cost = (impressions / 1000.0) * cpm
        
        # Last metrics update timestamp (same or slightly before last_sync)
        last_metrics_update_ts = last_sync_ts - timedelta(hours=np.random.randint(0, 24))
        
        # A/B test references (nullable, ~30% have ab_test)
        has_ab_test = np.random.random() < 0.3
        if has_ab_test:
            ab_test_id = f"ABTEST-{(i * 2 + 1):05d}"
            ab_test_variant_id = f"VARIANT-{np.random.choice(['A', 'B', 'C', 'D'])}"
        else:
            ab_test_id = None
            ab_test_variant_id = None
        
        activations_data.append({
            "activation_id": f"ACT-{i:06d}",
            "creative_asset_id": creative_asset_id,
            "line_item_id": line_item.line_item_id,
            "campaign_id": line_item.campaign_id,
            "brief_id": line_item.brief_id,
            "destination_platform": dsp,
            "destination_placement_id": placement_id,
            "trafficking_status": status,
            "activation_ts": activation_ts,
            "last_sync_ts": last_sync_ts,
            "impressions": impressions,
            "clicks": clicks,
            "conversions": conversions,
            "cost": round(cost, 2),
            "last_metrics_update_ts": last_metrics_update_ts,
            "ab_test_id": ab_test_id,
            "ab_test_variant_id": ab_test_variant_id,
        })
    
    # Convert to Spark DataFrame
    activations_pdf = pd.DataFrame(activations_data)
    
    logger.info(f"Generated {len(activations_data)} campaign activations.")
    return spark.createDataFrame(activations_pdf, schema=_get_activation_schema())


def _get_activation_schema():
    """Define the schema for the campaign activation table."""
    return StructType([
        StructField("activation_id", StringType(), False),
        StructField("creative_asset_id", StringType(), False),
        StructField("line_item_id", StringType(), False),
        StructField("campaign_id", StringType(), False),
        StructField("brief_id", StringType(), False),
        StructField("destination_platform", StringType(), False),
        StructField("destination_placement_id", StringType(), False),
        StructField("trafficking_status", StringType(), False),
        StructField("activation_ts", TimestampType(), False),
        StructField("last_sync_ts", TimestampType(), False),
        StructField("impressions", LongType(), False),
        StructField("clicks", LongType(), False),
        StructField("conversions", LongType(), False),
        StructField("cost", DoubleType(), False),
        StructField("last_metrics_update_ts", TimestampType(), False),
        StructField("ab_test_id", StringType(), True),
        StructField("ab_test_variant_id", StringType(), True),
    ])
