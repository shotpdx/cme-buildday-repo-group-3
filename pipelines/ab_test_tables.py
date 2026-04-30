"""
A/B Test Configuration and Variant Tables Pipeline

Creates gold-layer A/B test configuration and variant tables for creative activation testing
with canary rollout support.

Source: gold_media_creative_briefs (brief references)
Target: 
  - gold_buyside_ab_test_config (cme_outcomes_uswest.lakefoundry)
  - gold_buyside_ab_test_variant (cme_outcomes_uswest.lakefoundry)

Grain: 
  - Config: One row per A/B test
  - Variant: One row per test variant (control + treatment(s))
"""

from pyspark import pipelines as dp
from pyspark.sql import functions as F
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType, DoubleType, 
    TimestampType, BooleanType, DateType
)
from datetime import datetime, timedelta
import random
import uuid


@dp.table(name="cme_outcomes_uswest.lakefoundry.gold_buyside_ab_test_config")
def gold_buyside_ab_test_config():
    """
    Generate A/B test configurations.
    
    Creates ~10 test configs with:
    - Valid brief references
    - Various test types (Creative, Audience, Message)
    - Success metrics (CTR, Conversion, ROAS)
    - Status distribution (Draft, Running, Completed, Cancelled)
    - Confidence thresholds and sample size requirements
    """
    
    # Read source briefs to get valid brief_ids
    briefs = spark.read.table("cme_outcomes_uswest.media_demo.gold_media_creative_briefs")
    brief_ids = briefs.select("brief_id").distinct().collect()
    brief_id_list = [row.brief_id for row in brief_ids]
    
    if not brief_id_list:
        # Fallback: create synthetic brief IDs if none exist
        brief_id_list = [f"BRIEF-{i:04d}" for i in range(1, 21)]
    
    # Define test configurations
    test_configs = []
    test_types = ["Creative", "Audience", "Message"]
    success_metrics = ["CTR", "Conversion", "ROAS"]
    statuses = ["Draft", "Running", "Completed", "Cancelled"]
    
    base_date = datetime.now()
    
    for i in range(10):
        ab_test_id = f"ABTEST-{i+1:04d}"
        test_type = random.choice(test_types)
        brief_id = random.choice(brief_id_list)
        status = random.choice(statuses)
        success_metric = random.choice(success_metrics)
        
        # Generate dates based on status
        if status == "Draft":
            start_date = (base_date + timedelta(days=random.randint(1, 30))).date()
            end_date = (base_date + timedelta(days=random.randint(1, 30)) + timedelta(days=random.randint(7, 30))).date()
        elif status == "Running":
            start_date = (base_date - timedelta(days=random.randint(1, 30))).date()
            end_date = (base_date + timedelta(days=random.randint(1, 30))).date()
        elif status == "Completed":
            start_date = (base_date - timedelta(days=random.randint(30, 90))).date()
            end_date = (base_date - timedelta(days=random.randint(1, 29))).date()
        else:  # Cancelled
            start_date = (base_date - timedelta(days=random.randint(10, 60))).date()
            end_date = (datetime.combine(start_date, datetime.min.time()) + timedelta(days=random.randint(3, 14))).date()
        
        test_configs.append({
            "ab_test_id": ab_test_id,
            "test_name": f"{test_type} Test - {brief_id}",
            "test_description": f"A/B test for {test_type.lower()} optimization on brief {brief_id}",
            "brief_id": brief_id,
            "test_type": test_type,
            "start_date": start_date,
            "end_date": end_date,
            "status": status,
            "success_metric": success_metric,
            "confidence_threshold": round(random.uniform(0.90, 0.99), 2),
            "min_sample_size": random.choice([100, 500, 1000, 5000]),
            "created_ts": datetime.now(),
            "updated_ts": datetime.now()
        })
    
    # Convert to DataFrame
    df = spark.createDataFrame(test_configs)
    
    return df


@dp.table(name="cme_outcomes_uswest.lakefoundry.gold_buyside_ab_test_variant")
def gold_buyside_ab_test_variant():
    """
    Generate A/B test variants with proper allocation and canary support.
    
    Creates ~30 variants across the ~10 tests with:
    - Control and treatment variants
    - Traffic allocation percentages summing to 100% per test
    - Canary rollout flags and percentages
    - Performance metrics (impressions, clicks, conversions)
    - Winner determination
    """
    
    # Read test configs to get test IDs
    test_configs = spark.read.table("cme_outcomes_uswest.lakefoundry.gold_buyside_ab_test_config")
    test_ids = test_configs.select("ab_test_id").collect()
    test_id_list = [row.ab_test_id for row in test_ids]
    
    # Read generated creatives for creative_asset_id references (if available)
    try:
        creatives = spark.read.table("cme_outcomes_uswest.lakefoundry.gold_buyside_generated_creatives")
        creative_ids = creatives.select("creative_asset_id").collect()
        creative_id_list = [row.creative_asset_id for row in creative_ids]
    except:
        # Fallback: create synthetic creative IDs
        creative_id_list = [f"CREATIVE-{i:05d}" for i in range(1, 101)]
    
    variants = []
    variant_idx = 1
    
    for test_id in test_id_list:
        # Determine number of variants for this test (2-4: 1 control + 1-3 treatments)
        num_variants = random.randint(2, 4)
        
        # Allocate traffic: control gets 40-60%, rest split among treatments
        control_pct = random.randint(40, 60)
        remaining_pct = 100 - control_pct
        
        # Split remaining among treatment variants
        treatment_allocations = []
        if num_variants == 2:
            treatment_allocations = [remaining_pct]
        else:
            # Distribute remaining among treatments
            allocations = []
            for j in range(num_variants - 1):
                if j == num_variants - 2:
                    # Last one gets remainder
                    allocations.append(remaining_pct - sum(allocations))
                else:
                    alloc = random.randint(10, remaining_pct - (num_variants - 2 - j) * 10)
                    allocations.append(alloc)
            treatment_allocations = allocations
        
        # Create control variant
        is_canary = random.random() < 0.3  # 30% chance of canary
        canary_pct = random.randint(5, 10) if is_canary else None
        
        # Generate performance metrics
        base_impressions = random.randint(10000, 100000)
        ctr = random.uniform(0.01, 0.05)
        conversion_rate = random.uniform(0.001, 0.01)
        
        control_impressions = base_impressions
        control_clicks = int(control_impressions * ctr)
        control_conversions = int(control_clicks * conversion_rate)
        
        variants.append({
            "variant_id": f"VAR-{variant_idx:06d}",
            "ab_test_id": test_id,
            "variant_name": f"{test_id}_control",
            "variant_type": "Control",
            "creative_asset_id": random.choice(creative_id_list) if random.random() > 0.3 else None,
            "traffic_allocation_pct": control_pct,
            "is_canary": is_canary,
            "canary_pct": canary_pct,
            "impressions": control_impressions,
            "clicks": control_clicks,
            "conversions": control_conversions,
            "metric_value": round(control_clicks / control_impressions if control_impressions > 0 else 0, 4),
            "is_winner": False,
            "created_ts": datetime.now(),
            "updated_ts": datetime.now()
        })
        variant_idx += 1
        
        # Create treatment variants
        for t_idx, treatment_pct in enumerate(treatment_allocations, 1):
            # Treatment variants typically perform slightly better or worse
            treatment_impressions = int(base_impressions * (treatment_pct / control_pct))
            treatment_ctr = ctr * random.uniform(0.8, 1.2)  # Vary performance
            treatment_clicks = int(treatment_impressions * treatment_ctr)
            treatment_conversions = int(treatment_clicks * conversion_rate)
            
            # Determine if this is the winner (only for completed tests)
            is_winner = random.random() < 0.3  # 30% chance per treatment
            
            variants.append({
                "variant_id": f"VAR-{variant_idx:06d}",
                "ab_test_id": test_id,
                "variant_name": f"{test_id}_treatment_{t_idx}",
                "variant_type": "Treatment",
                "creative_asset_id": random.choice(creative_id_list) if random.random() > 0.2 else None,
                "traffic_allocation_pct": treatment_pct,
                "is_canary": False,
                "canary_pct": None,
                "impressions": treatment_impressions,
                "clicks": treatment_clicks,
                "conversions": treatment_conversions,
                "metric_value": round(treatment_clicks / treatment_impressions if treatment_impressions > 0 else 0, 4),
                "is_winner": is_winner,
                "created_ts": datetime.now(),
                "updated_ts": datetime.now()
            })
            variant_idx += 1
    
    # Convert to DataFrame
    df = spark.createDataFrame(variants)
    
    return df
