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
from datetime import datetime, timedelta
import json


@dp.table(name="gold_buyside_campaign_activation")
def campaign_activation():
    """
    Create campaign activation table with realistic seed data.
    
    Columns:
    - activation_id: Unique identifier for each activation
    - creative_asset_id: FK to generated creatives
    - line_item_id: FK to media plan line items
    - campaign_id: Campaign identifier
    - brief_id: Brief identifier
    - destination_platform: DSP name (The_Trade_Desk, DV360, Amazon_DSP, Meta, Google_Ads, TikTok, Innovid)
    - destination_placement_id: Placement ID in DSP
    - trafficking_status: Draft/Submitted/Live/Paused/Ended
    - activation_ts: When the activation was created
    - last_sync_ts: Last sync with DSP
    - impressions: Number of impressions (bigint)
    - clicks: Number of clicks (bigint)
    - conversions: Number of conversions (bigint)
    - cost: Total cost (double)
    - last_metrics_update_ts: Last metrics update timestamp
    - ab_test_id: Optional FK to A/B test
    - ab_test_variant_id: Optional FK to variant
    """
    
    # Set seed for reproducibility
    np.random.seed(42)
    
    # DSP platforms available
    platforms = ["The_Trade_Desk", "DV360", "Amazon_DSP", "Meta", "Google_Ads", "TikTok", "Innovid"]
    
    # Trafficking status distribution (realistic)
    # Most activations are Live, some Paused, few Draft/Submitted/Ended
    trafficking_statuses = ["Draft", "Submitted", "Live", "Paused", "Ended"]
    trafficking_weights = [0.05, 0.05, 0.70, 0.15, 0.05]
    
    # Read existing line items from media_demo schema
    try:
        line_items_df = spark.read.table("cme_outcomes_uswest.media_demo.gold_media_media_plan_line_items")
        line_items = line_items_df.select("line_item_id", "campaign_id", "brief_id").collect()
        
        if len(line_items) == 0:
            # Fallback: generate synthetic line items if none exist
            line_items = [
                {"line_item_id": f"LI-{i:06d}", "campaign_id": f"CAMP-{i//5:04d}", "brief_id": f"BRIEF-{i//10:03d}"}
                for i in range(50)
            ]
        else:
            line_items = [row.asDict() for row in line_items[:50]]  # Use first 50
    except Exception as e:
        # Fallback: generate synthetic line items
        print(f"Warning: Could not read line items from media_demo: {e}")
        line_items = [
            {"line_item_id": f"LI-{i:06d}", "campaign_id": f"CAMP-{i//5:04d}", "brief_id": f"BRIEF-{i//10:03d}"}
            for i in range(50)
        ]
    
    # Read existing generated creatives
    try:
        creatives_df = spark.read.table("cme_outcomes_uswest.lakefoundry.gold_buyside_generated_creatives")
        creatives = creatives_df.select("creative_asset_id").collect()
        
        if len(creatives) == 0:
            # Fallback: generate synthetic creative IDs
            creatives = [{"creative_asset_id": f"CREAT-{i:06d}"} for i in range(100)]
        else:
            creatives = [row.asDict() for row in creatives]
    except Exception as e:
        # Fallback: generate synthetic creative IDs
        print(f"Warning: Could not read creatives: {e}")
        creatives = [{"creative_asset_id": f"CREAT-{i:06d}"} for i in range(100)]
    
    # Generate ~50 activations
    activations = []
    base_date = datetime.now() - timedelta(days=90)
    
    for i in range(50):
        line_item = line_items[i % len(line_items)]
        creative = creatives[i % len(creatives)]
        
        # Activation timestamp (within last 90 days)
        days_ago = np.random.randint(0, 90)
        activation_ts = base_date + timedelta(days=days_ago)
        
        # Last sync (within last 7 days for Live activations, older for others)
        trafficking_status = np.random.choice(trafficking_statuses, p=trafficking_weights)
        if trafficking_status == "Live":
            last_sync_days_ago = np.random.randint(0, 7)
        elif trafficking_status == "Paused":
            last_sync_days_ago = np.random.randint(7, 30)
        else:
            last_sync_days_ago = np.random.randint(30, 90)
        
        last_sync_ts = datetime.now() - timedelta(days=last_sync_days_ago)
        
        # Performance metrics (realistic ranges)
        # impressions: 10K-1M range
        impressions = int(np.random.lognormal(mean=11, sigma=1.5))
        
        # clicks: 0.5-3% of impressions
        click_rate = np.random.uniform(0.005, 0.03)
        clicks = int(impressions * click_rate)
        
        # conversions: 1-10% of clicks
        conversion_rate = np.random.uniform(0.01, 0.10)
        conversions = int(clicks * conversion_rate)
        
        # cost: $0.50-$5.00 CPM
        cpm = np.random.uniform(0.50, 5.00)
        cost = (impressions / 1000) * cpm
        
        # Last metrics update (recent for Live, older for others)
        if trafficking_status == "Live":
            metrics_update_hours_ago = np.random.randint(0, 24)
        else:
            metrics_update_hours_ago = np.random.randint(24, 168)
        
        last_metrics_update_ts = datetime.now() - timedelta(hours=metrics_update_hours_ago)
        
        # A/B test (30% of activations are in A/B tests)
        if np.random.random() < 0.3:
            ab_test_id = f"ABTEST-{i//5:03d}"
            ab_test_variant_id = f"VAR-{i % 3:02d}"  # 3 variants per test
        else:
            ab_test_id = None
            ab_test_variant_id = None
        
        activation = {
            "activation_id": f"ACT-{i:06d}",
            "creative_asset_id": creative["creative_asset_id"],
            "line_item_id": line_item["line_item_id"],
            "campaign_id": line_item["campaign_id"],
            "brief_id": line_item["brief_id"],
            "destination_platform": np.random.choice(platforms),
            "destination_placement_id": f"PLAC-{i:06d}",
            "trafficking_status": trafficking_status,
            "activation_ts": activation_ts,
            "last_sync_ts": last_sync_ts,
            "impressions": impressions,
            "clicks": clicks,
            "conversions": conversions,
            "cost": round(cost, 2),
            "last_metrics_update_ts": last_metrics_update_ts,
            "ab_test_id": ab_test_id,
            "ab_test_variant_id": ab_test_variant_id,
        }
        
        activations.append(activation)
    
    # Define schema explicitly to avoid type inference issues
    schema = StructType([
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
    
    # Convert to Spark DataFrame with explicit schema
    activations_df = spark.createDataFrame(activations, schema=schema)
    
    return activations_df
