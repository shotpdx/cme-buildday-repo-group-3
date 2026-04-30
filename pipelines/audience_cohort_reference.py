"""
Audience/Cohort Reference Gold Table Pipeline

Creates a gold-layer audience cohort reference table that stores marketing-defined
audience segments for targeting creatives. This table serves as a master reference
for all audience cohorts used in the Buy Side MVP.

Source: gold_media_audience_segments (segment combinations)
Target: gold_buyside_audience_cohort (cme_outcomes_uswest.lakefoundry)

Grain: One row per audience cohort (marketing-defined segment combination)
"""

from pyspark import pipelines as dp
from pyspark.sql import functions as F
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType, DoubleType,
    TimestampType, BooleanType, MapType
)
from datetime import datetime, timedelta
import json
import random
import logging
import uuid

# Configure logging
logger = logging.getLogger(__name__)


@dp.table(name="cme_outcomes_uswest.lakefoundry.gold_buyside_audience_cohort")
def gold_buyside_audience_cohort():
    """
    Generate audience cohort reference table with ~20 seed cohorts.
    
    Creates cohorts based on combinations of primary_segment and value_segment
    from gold_media_audience_segments, with:
    - Unique cohort_id and cohort_name
    - Definition type (rule_based, ml_model, lookalike, manual)
    - Definition value as JSON with rules/model references
    - Feature summary text describing the cohort
    - Eligibility flags (region_allowed, channel_allowed, frequency_capped)
    - Personalization granularity (Segment, Micro_Cohort, One_to_One)
    - Estimated reach, timestamps, and status
    """
    
    # Set random seed for reproducibility
    random.seed(42)
    
    # Read source segments to get valid combinations with error handling
    try:
        segments = spark.read.table("cme_outcomes_uswest.media_demo.gold_media_audience_segments")
        logger.info("Successfully read source table: gold_media_audience_segments")
    except Exception as e:
        logger.warning(f"Failed to read source table: {e}. Using empty segments list.")
        segments = None
    
    # Get distinct segment combinations or use empty list if source unavailable
    if segments is not None:
        segment_combos = segments.select(
            "primary_segment", "value_segment"
        ).distinct().collect()
    else:
        segment_combos = []
    
    # Create seed cohorts from segment combinations
    cohorts = []
    
    # Define cohort templates based on segment combinations
    definition_types = ["rule_based", "ml_model", "lookalike", "manual"]
    granularities = ["Segment", "Micro_Cohort", "One_to_One"]
    statuses = ["Active", "Archived"]
    
    base_date = datetime.now()
    
    # Create cohorts from segment combinations (should be ~15 combinations)
    for idx, combo in enumerate(segment_combos[:20]):  # Limit to ~20
        cohort_id = f"COHORT-{idx+1:04d}"
        primary_seg = combo.primary_segment
        value_seg = combo.value_segment
        
        # Create cohort name from segments
        cohort_name = f"{primary_seg} - {value_seg}"
        
        # Create description
        cohort_description = (
            f"Audience cohort targeting {primary_seg.lower()} users "
            f"with {value_seg.lower()} value characteristics. "
            f"Suitable for personalized creative activation campaigns."
        )
        
        # Determine definition type based on value segment
        if value_seg == "Churned":
            definition_type = "ml_model"
        elif value_seg == "At Risk":
            definition_type = "rule_based"
        elif primary_seg == "Digital Native":
            definition_type = "lookalike"
        else:
            definition_type = random.choice(definition_types)
        
        # Create definition value as JSON
        if definition_type == "rule_based":
            definition_value = json.dumps({
                "rule_type": "segment_based",
                "primary_segment": primary_seg,
                "value_segment": value_seg,
                "conditions": [
                    {"field": "primary_segment", "operator": "equals", "value": primary_seg},
                    {"field": "value_segment", "operator": "equals", "value": value_seg}
                ]
            })
        elif definition_type == "ml_model":
            definition_value = json.dumps({
                "model_type": "churn_prediction",
                "model_id": f"model_{idx+1:03d}",
                "model_version": "1.0",
                "threshold": round(random.uniform(0.5, 0.9), 2),
                "features": ["engagement_level", "ltv_category", "churn_risk_category"]
            })
        elif definition_type == "lookalike":
            definition_value = json.dumps({
                "lookalike_type": "seed_based",
                "seed_segment": primary_seg,
                "similarity_threshold": round(random.uniform(0.7, 0.95), 2),
                "expansion_factor": random.choice([1.5, 2.0, 2.5])
            })
        else:  # manual
            definition_value = json.dumps({
                "manual_type": "curator_defined",
                "curator_id": f"curator_{random.randint(1, 10):02d}",
                "notes": f"Manually curated cohort for {primary_seg} targeting"
            })
        
        # Create feature summary text
        feature_summary = (
            f"Primary Segment: {primary_seg}. "
            f"Value Tier: {value_seg}. "
            f"Definition Type: {definition_type}. "
            f"Suitable for {random.choice(['brand awareness', 'conversion', 'retention', 'reactivation'])} campaigns."
        )
        
        # Eligibility flags - vary based on segment
        is_region_allowed = random.choice([True, True, False])  # 2/3 true
        is_channel_allowed = random.choice([True, True, True, False])  # 3/4 true
        is_frequency_capped = random.choice([True, False])  # 50/50
        
        # Personalization granularity
        if value_seg == "Premium Engaged" or value_seg == "High Value":
            personalization_granularity = "One_to_One"
        elif value_seg == "At Risk" or value_seg == "Churned":
            personalization_granularity = "Micro_Cohort"
        else:
            personalization_granularity = random.choice(granularities)
        
        # Estimated reach - varies by segment size
        estimated_reach = random.randint(5000, 500000)
        
        # Status - mostly active, some archived
        status = random.choice(["Active"] * 8 + ["Archived"] * 2)
        
        # Timestamps - convert to proper datetime objects
        created_ts = base_date - timedelta(days=random.randint(1, 180))
        updated_ts = base_date - timedelta(days=random.randint(0, 30))
        last_refreshed_ts = base_date - timedelta(days=random.randint(0, 7))
        
        cohorts.append({
            "cohort_id": cohort_id,
            "cohort_name": cohort_name,
            "cohort_description": cohort_description,
            "definition_type": definition_type,
            "definition_value": definition_value,
            "feature_summary_text": feature_summary,
            "is_region_allowed": is_region_allowed,
            "is_channel_allowed": is_channel_allowed,
            "is_frequency_capped": is_frequency_capped,
            "personalization_granularity": personalization_granularity,
            "estimated_reach": estimated_reach,
            "last_refreshed_ts": last_refreshed_ts,
            "created_ts": created_ts,
            "updated_ts": updated_ts,
            "status": status
        })
    
    # If we have fewer than 20 combinations, add some synthetic cohorts
    while len(cohorts) < 20:
        idx = len(cohorts)
        cohort_id = f"COHORT-{idx+1:04d}"
        
        # Create synthetic cohort names
        synthetic_names = [
            "High-Value Engaged Professionals",
            "Budget-Conscious Shoppers",
            "Entertainment Enthusiasts",
            "Tech-Savvy Millennials",
            "Premium Sports Fans",
            "News-Focused Professionals",
            "Family-Oriented Viewers",
            "Casual Entertainment Seekers",
            "Digital-First Adopters",
            "Value-Conscious Families",
            "Premium Content Consumers",
            "Mobile-First Audience",
            "Streaming Natives",
            "Cross-Platform Viewers",
            "Niche Interest Communities"
        ]
        
        cohort_name = synthetic_names[idx % len(synthetic_names)]
        cohort_description = f"Synthetic audience cohort: {cohort_name}. Designed for targeted creative activation."
        
        definition_type = random.choice(definition_types)
        
        # Create definition value
        if definition_type == "rule_based":
            definition_value = json.dumps({
                "rule_type": "behavior_based",
                "behaviors": ["high_engagement", "frequent_visits"],
                "min_engagement_score": round(random.uniform(0.6, 0.9), 2)
            })
        elif definition_type == "ml_model":
            definition_value = json.dumps({
                "model_type": "propensity",
                "model_id": f"model_{idx+1:03d}",
                "model_version": "2.0",
                "threshold": round(random.uniform(0.5, 0.85), 2)
            })
        elif definition_type == "lookalike":
            definition_value = json.dumps({
                "lookalike_type": "conversion_based",
                "seed_cohort": f"COHORT-{random.randint(1, idx):04d}",
                "similarity_threshold": round(random.uniform(0.75, 0.95), 2)
            })
        else:  # manual
            definition_value = json.dumps({
                "manual_type": "campaign_specific",
                "campaign_id": f"CAMP-{random.randint(1000, 9999):04d}",
                "notes": "Campaign-specific audience targeting"
            })
        
        feature_summary = f"Synthetic cohort for {random.choice(['awareness', 'conversion', 'retention'])} campaigns."
        
        is_region_allowed = random.choice([True, True, False])
        is_channel_allowed = random.choice([True, True, True, False])
        is_frequency_capped = random.choice([True, False])
        personalization_granularity = random.choice(granularities)
        estimated_reach = random.randint(10000, 1000000)
        status = random.choice(["Active"] * 8 + ["Archived"] * 2)
        
        # Timestamps - convert to proper datetime objects
        created_ts = base_date - timedelta(days=random.randint(1, 180))
        updated_ts = base_date - timedelta(days=random.randint(0, 30))
        last_refreshed_ts = base_date - timedelta(days=random.randint(0, 7))
        
        cohorts.append({
            "cohort_id": cohort_id,
            "cohort_name": cohort_name,
            "cohort_description": cohort_description,
            "definition_type": definition_type,
            "definition_value": definition_value,
            "feature_summary_text": feature_summary,
            "is_region_allowed": is_region_allowed,
            "is_channel_allowed": is_channel_allowed,
            "is_frequency_capped": is_frequency_capped,
            "personalization_granularity": personalization_granularity,
            "estimated_reach": estimated_reach,
            "last_refreshed_ts": last_refreshed_ts,
            "created_ts": created_ts,
            "updated_ts": updated_ts,
            "status": status
        })
    
    # Define explicit schema with proper types for all columns
    schema = StructType([
        StructField("cohort_id", StringType(), False),
        StructField("cohort_name", StringType(), False),
        StructField("cohort_description", StringType(), False),
        StructField("definition_type", StringType(), False),
        StructField("definition_value", StringType(), False),
        StructField("feature_summary_text", StringType(), False),
        StructField("is_region_allowed", BooleanType(), False),
        StructField("is_channel_allowed", BooleanType(), False),
        StructField("is_frequency_capped", BooleanType(), False),
        StructField("personalization_granularity", StringType(), False),
        StructField("estimated_reach", IntegerType(), False),
        StructField("last_refreshed_ts", TimestampType(), False),
        StructField("created_ts", TimestampType(), False),
        StructField("updated_ts", TimestampType(), False),
        StructField("status", StringType(), False)
    ])
    
    # Convert to DataFrame with explicit schema
    df = spark.createDataFrame(cohorts, schema=schema)
    
    return df
