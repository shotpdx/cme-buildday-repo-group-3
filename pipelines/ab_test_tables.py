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
from pyspark.errors import AnalysisException
import random
import uuid

# Use fixed base timestamp for reproducibility (instead of datetime.now())
BASE_TIMESTAMP = datetime(2024, 1, 15, 10, 0, 0)
BASE_DATE = BASE_TIMESTAMP.date()


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
    
    # Explicit schema definition for type safety
    config_schema = StructType([
        StructField("ab_test_id", StringType(), False),
        StructField("test_name", StringType(), False),
        StructField("test_description", StringType(), False),
        StructField("brief_id", StringType(), False),
        StructField("test_type", StringType(), False),
        StructField("start_date", DateType(), False),
        StructField("end_date", DateType(), False),
        StructField("status", StringType(), False),
        StructField("success_metric", StringType(), False),
        StructField("confidence_threshold", DoubleType(), False),
        StructField("min_sample_size", IntegerType(), False),
        StructField("created_ts", TimestampType(), False),
        StructField("updated_ts", TimestampType(), False),
    ])
    
    # Read source briefs to get valid brief_ids
    try:
        briefs = spark.read.table("cme_outcomes_uswest.media_demo.gold_media_creative_briefs")
        brief_ids = briefs.select("brief_id").distinct().collect()
        brief_id_list = [row.brief_id for row in brief_ids]
    except AnalysisException as e:
        # Fallback: create synthetic brief IDs if table doesn't exist
        brief_id_list = [f"BRIEF-{i:04d}" for i in range(1, 21)]
    
    if not brief_id_list:
        # Fallback: create synthetic brief IDs if none exist
        brief_id_list = [f"BRIEF-{i:04d}" for i in range(1, 21)]
    
    # Define test configurations
    test_configs = []
    test_types = ["Creative", "Audience", "Message"]
    success_metrics = ["CTR", "Conversion", "ROAS"]
    statuses = ["Draft", "Running", "Completed", "Cancelled"]
    
    for i in range(10):
        ab_test_id = f"ABTEST-{i+1:04d}"
        test_type = random.choice(test_types)
        brief_id = random.choice(brief_id_list)
        status = random.choice(statuses)
        success_metric = random.choice(success_metrics)
        
        # Generate dates based on status
        if status == "Draft":
            start_date = (BASE_DATE + timedelta(days=random.randint(1, 30)))
            end_date = (start_date + timedelta(days=random.randint(7, 30)))
        elif status == "Running":
            start_date = (BASE_DATE - timedelta(days=random.randint(1, 30)))
            end_date = (BASE_DATE + timedelta(days=random.randint(1, 30)))
        elif status == "Completed":
            start_date = (BASE_DATE - timedelta(days=random.randint(30, 90)))
            end_date = (BASE_DATE - timedelta(days=random.randint(1, 29)))
        else:  # Cancelled
            start_date = (BASE_DATE - timedelta(days=random.randint(10, 60)))
            end_date = (start_date + timedelta(days=random.randint(3, 14)))
        
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
            "created_ts": BASE_TIMESTAMP,
            "updated_ts": BASE_TIMESTAMP
        })
    
    # Convert to DataFrame with explicit schema
    df = spark.createDataFrame(test_configs, schema=config_schema)
    
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
    
    # Explicit schema definition for type safety
    variant_schema = StructType([
        StructField("variant_id", StringType(), False),
        StructField("ab_test_id", StringType(), False),
        StructField("variant_name", StringType(), False),
        StructField("variant_type", StringType(), False),
        StructField("creative_asset_id", StringType(), True),
        StructField("traffic_allocation_pct", IntegerType(), False),
        StructField("is_canary", BooleanType(), False),
        StructField("canary_pct", IntegerType(), True),  # Nullable IntegerType
        StructField("impressions", IntegerType(), False),
        StructField("clicks", IntegerType(), False),
        StructField("conversions", IntegerType(), False),
        StructField("metric_value", DoubleType(), False),
        StructField("is_winner", BooleanType(), False),
        StructField("created_ts", TimestampType(), False),
        StructField("updated_ts", TimestampType(), False),
    ])
    
    # Read test configs to get test IDs
    test_configs = spark.read.table("cme_outcomes_uswest.lakefoundry.gold_buyside_ab_test_config")
    test_ids = test_configs.select("ab_test_id").collect()
    test_id_list = [row.ab_test_id for row in test_ids]
    
    # Read generated creatives for creative_asset_id references (if available)
    try:
        creatives = spark.read.table("cme_outcomes_uswest.lakefoundry.gold_buyside_generated_creatives")
        creative_ids = creatives.select("creative_asset_id").collect()
        creative_id_list = [row.creative_asset_id for row in creative_ids]
    except AnalysisException as e:
        # Fallback: create synthetic creative IDs if table doesn't exist
        creative_id_list = [f"CREATIVE-{i:05d}" for i in range(1, 101)]
    
    variants = []
    variant_idx = 1
    
    for test_id in test_id_list:
        # Determine number of variants for this test (2-4: 1 control + 1-3 treatments)
        num_variants = random.randint(2, 4)
        
        # Allocate traffic: control gets 40-60%, rest split among treatments
        control_pct = random.randint(40, 60)
        remaining_pct = 100 - control_pct
        
        # Split remaining among treatment variants - with safe allocation logic
        treatment_allocations = []
        if num_variants == 2:
            treatment_allocations = [remaining_pct]
        else:
            # Distribute remaining among treatments safely
            allocations = []
            num_treatments = num_variants - 1
            
            for j in range(num_treatments):
                if j == num_treatments - 1:
                    # Last one gets remainder to ensure sum = 100%
                    allocations.append(remaining_pct - sum(allocations))
                else:
                    # Calculate safe upper bound: ensure remaining treatments get at least 10% each
                    remaining_for_future = (num_treatments - 1 - j) * 10
                    max_alloc = remaining_pct - sum(allocations) - remaining_for_future
                    
                    # Ensure max_alloc is at least 10 to avoid negative randint bounds
                    max_alloc = max(10, max_alloc)
                    alloc = random.randint(10, max_alloc)
                    allocations.append(alloc)
            
            treatment_allocations = allocations
        
        # Validate traffic allocation sums to 100%
        total_allocation = control_pct + sum(treatment_allocations)
        if total_allocation != 100:
            raise ValueError(f"Traffic allocation for test {test_id} sums to {total_allocation}, expected 100")
        
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
            "created_ts": BASE_TIMESTAMP,
            "updated_ts": BASE_TIMESTAMP
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
                "created_ts": BASE_TIMESTAMP,
                "updated_ts": BASE_TIMESTAMP
            })
            variant_idx += 1
    
    # Convert to DataFrame with explicit schema
    if variants:
        df = spark.createDataFrame(variants, schema=variant_schema)
    else:
        # Empty DataFrame with explicit schema if no variants generated
        df = spark.createDataFrame([], schema=variant_schema)
    
    return df
