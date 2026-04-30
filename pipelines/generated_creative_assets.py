"""
Spark Declarative Pipeline: Generated/Modified Creative Assets Table

Creates the gold_buyside_generated_creatives table in cme_outcomes_uswest.lakefoundry
with ~100 seed records of AI-generated or modified creative assets linked to briefs and concepts.

Schema:
- creative_asset_id (PK)
- brief_id (FK to gold_media_creative_briefs)
- concept_id (FK to gold_media_creative_concepts)
- source_asset_id (FK to gold_media_brand_asset_library, nullable)
- asset_name, asset_type, format, width_px, height_px, aspect_ratio, duration_sec
- storage_uri, generation_prompt, generation_model, generation_params (JSON)
- target_segment, target_content_genre, content_tags (comma-separated)
- approval_status, approved_by, approved_ts
- created_ts, updated_ts
"""

from pyspark import pipelines as dp
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType, LongType, BooleanType, TimestampType
import json
from datetime import datetime, timedelta
import random
from pyspark.sql.types import IntegerType

# Get configuration from pipeline settings
CATALOG = spark.conf.get("catalog", "cme_outcomes_uswest")
SCHEMA = spark.conf.get("schema", "lakefoundry")
SOURCE_CATALOG = spark.conf.get("source_catalog", "cme_outcomes_uswest")
SOURCE_SCHEMA = spark.conf.get("source_schema", "media_demo")


@dp.table(name=f"{CATALOG}.{SCHEMA}.gold_buyside_generated_creatives")
def gold_buyside_generated_creatives():
    """
    Generate synthetic creative assets linked to existing briefs and concepts.
    
    Returns a DataFrame with ~100 generated creatives with valid FK references.
    """
    
    # Read source tables to get valid FK values
    briefs_df = spark.read.table(f"{SOURCE_CATALOG}.{SOURCE_SCHEMA}.gold_media_creative_briefs")
    concepts_df = spark.read.table(f"{SOURCE_CATALOG}.{SOURCE_SCHEMA}.gold_media_creative_concepts")
    assets_df = spark.read.table(f"{SOURCE_CATALOG}.{SOURCE_SCHEMA}.gold_media_brand_asset_library")
    
    # Extract lists of valid IDs
    brief_ids = [row.brief_id for row in briefs_df.select("brief_id").collect()]
    concept_ids = [row.concept_id for row in concepts_df.select("concept_id").collect()]
    asset_ids = [row.asset_id for row in assets_df.select("asset_id").collect()]
    
    # Seed for reproducibility
    random.seed(42)
    
    # Define constants
    asset_types = ["Image", "Video", "DCO"]
    formats_by_type = {
        "Image": ["jpg", "png", "webp"],
        "Video": ["mp4", "webm", "mov"],
        "DCO": ["html", "json"]
    }
    
    approval_statuses = ["Draft", "Pending_Review", "Approved", "Rejected"]
    content_genres = ["Entertainment", "News", "Sports", "Business", "Lifestyle", "Tech", "Health"]
    segments = ["Segment_A", "Segment_B", "Segment_C", "Segment_D", "Segment_E"]
    
    generation_models = ["DALL-E-3", "Midjourney-v6", "Stable-Diffusion-XL", "GPT-4-Vision", "Claude-3-Vision"]
    
    # Generate synthetic data
    creatives_data = []
    
    for i in range(100):
        creative_id = f"CREATIVE-{i:06d}"
        brief_id = random.choice(brief_ids)
        concept_id = random.choice(concept_ids)
        
        # 70% of creatives have a source asset, 30% are fully generated
        source_asset_id = random.choice(asset_ids) if random.random() < 0.7 else None
        
        asset_type = random.choice(asset_types)
        asset_format = random.choice(formats_by_type[asset_type])
        
        # Dimensions vary by type
        if asset_type == "Image":
            width_px = random.choice([300, 600, 1200, 1920])
            height_px = random.choice([250, 400, 800, 1080])
            aspect_ratio = f"{width_px}:{height_px}"
            duration_sec = None
        elif asset_type == "Video":
            width_px = random.choice([1280, 1920])
            height_px = random.choice([720, 1080])
            aspect_ratio = f"{width_px}:{height_px}"
            duration_sec = random.choice([6, 15, 30, 60])
        else:  # DCO
            width_px = random.choice([300, 728, 970])
            height_px = random.choice([250, 90, 250])
            aspect_ratio = f"{width_px}:{height_px}"
            duration_sec = None
        
        # Storage URI following volume path pattern
        storage_uri = f"/Volumes/{CATALOG}/{SCHEMA}/artifacts/{creative_id}.{asset_format}"
        
        # Generation details
        generation_prompt = f"Generate a {asset_type.lower()} creative for concept {concept_id} targeting {random.choice(segments)}"
        generation_model = random.choice(generation_models)
        generation_params = {
            "temperature": round(random.uniform(0.5, 0.9), 2),
            "quality": random.choice(["standard", "hd"]),
            "style": random.choice(["photorealistic", "artistic", "minimalist", "bold"]),
            "iterations": random.randint(1, 5)
        }
        
        # Targeting and content
        target_segment = random.choice(segments)
        target_content_genre = random.choice(content_genres)
        content_tags = ",".join(random.sample(
            ["trending", "seasonal", "promotional", "educational", "entertaining", 
             "engaging", "high-impact", "brand-safe", "mobile-optimized", "accessible"],
            k=random.randint(2, 4)
        ))
        
        # Approval workflow
        approval_status = random.choice(approval_statuses)
        if approval_status == "Approved":
            approved_by = f"reviewer_{random.randint(1, 5)}"
            approved_ts = datetime.now() - timedelta(days=random.randint(0, 30))
        else:
            approved_by = None
            approved_ts = None
        
        # Timestamps
        created_ts = datetime.now() - timedelta(days=random.randint(1, 60))
        updated_ts = created_ts + timedelta(days=random.randint(0, 30))
        
        creatives_data.append({
            "creative_asset_id": creative_id,
            "brief_id": brief_id,
            "concept_id": concept_id,
            "source_asset_id": source_asset_id,
            "asset_name": f"{asset_type} Asset {i:03d}",
            "asset_type": asset_type,
            "format": asset_format,
            "width_px": width_px,
            "height_px": height_px,
            "aspect_ratio": aspect_ratio,
            "duration_sec": duration_sec,
            "storage_uri": storage_uri,
            "generation_prompt": generation_prompt,
            "generation_model": generation_model,
            "generation_params": json.dumps(generation_params),
            "target_segment": target_segment,
            "target_content_genre": target_content_genre,
            "content_tags": content_tags,
            "approval_status": approval_status,
            "approved_by": approved_by,
            "approved_ts": approved_ts,
            "created_ts": created_ts,
            "updated_ts": updated_ts,
        })
    
    # Create DataFrame from synthetic data
    df = spark.createDataFrame(creatives_data)
    
    # Ensure correct column types
    df = (df
        .withColumn("width_px", F.col("width_px").cast(IntegerType()))
        .withColumn("height_px", F.col("height_px").cast(IntegerType()))
        .withColumn("duration_sec", F.col("duration_sec").cast(IntegerType()))
        .withColumn("created_ts", F.col("created_ts").cast(TimestampType()))
        .withColumn("updated_ts", F.col("updated_ts").cast(TimestampType()))
        .withColumn("approved_ts", F.col("approved_ts").cast(TimestampType()))
    )
    
    return df
