"""
Source Tables Bootstrap Pipeline

Creates the missing gold_media_* tables in the media_demo schema that are
required by the buyside_data_foundation pipeline.

These tables simulate the upstream data that would normally come from
the Customer 360 data platform.

Tables created:
- gold_media_customer_360
- gold_media_creative_concepts
- gold_media_brand_asset_library
- gold_media_media_plan_line_items
- gold_media_audience_segments
"""

from pyspark.sql import functions as F
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType, DoubleType,
    LongType, BooleanType, TimestampType, DateType
)
from pyspark import pipelines as dlt
from datetime import datetime, timedelta
import random

# Configuration
CATALOG = spark.conf.get("catalog", "cme_outcomes_uswest")
SCHEMA = spark.conf.get("schema", "media_demo")

# Seed for reproducibility
random.seed(42)


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.gold_media_customer_360",
    comment="Unified customer profile - synthetic data for demo"
)
def gold_media_customer_360():
    personas = ["Sports Fan", "News Junkie", "Entertainment Binge Watcher", "Casual Viewer", "Cord Cutter"]
    tiers = ["basic", "standard", "premium", "family", None]
    customers = []
    for i in range(500):
        canonical_id = f"CID-{i:06d}"
        customers.append({
            "canonical_id": canonical_id,
            "email": f"user{i}@example.com",
            "first_name": f"First{i}",
            "last_name": f"Last{i}",
            "phone": f"555{i:07d}",
            "zip_code": f"{10000 + (i % 90000):05d}",
            "persona": random.choice(personas),
            "customer_since": (datetime.now() - timedelta(days=random.randint(30, 1000))).isoformat(),
            "total_events": random.randint(10, 5000),
            "platforms_used": random.randint(1, 4),
            "unique_content_viewed": random.randint(5, 500),
            "total_watch_seconds": random.randint(1000, 500000),
            "last_engagement_ts": (datetime.now() - timedelta(days=random.randint(0, 60))).isoformat(),
            "total_transactions": random.randint(0, 20),
            "total_spend": round(random.uniform(0, 500), 2),
            "current_subscription_tier": random.choice(tiers),
            "days_since_last_engagement": random.randint(0, 60),
            "is_multi_platform": random.choice([True, False]),
            "has_subscription": random.choice([True, False, True]),
            "created_ts": datetime.now().isoformat(),
        })
    return spark.createDataFrame(customers)


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.gold_media_creative_concepts",
    comment="Creative concepts linked to briefs - synthetic data for demo"
)
def gold_media_creative_concepts():
    concept_types = ["Hero Banner", "Social Square", "Vertical Story", "Email Header", "Display Banner"]
    themes = ["Premium Sports", "Family Entertainment", "Breaking News", "Binge-worthy Drama", "Live Events"]
    concepts = []
    for i in range(50):
        concept_id = f"CONCEPT-{i+1:04d}"
        brief_id = f"BRIEF-{(i % 20) + 1:03d}"
        concepts.append({
            "concept_id": concept_id,
            "brief_id": brief_id,
            "concept_name": f"{random.choice(themes)} - {random.choice(concept_types)}",
            "concept_type": random.choice(concept_types),
            "theme": random.choice(themes),
            "description": f"Creative concept {i+1}",
            "status": random.choice(["Draft", "Approved", "In Review"]),
            "created_ts": (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            "updated_ts": datetime.now().isoformat(),
        })
    return spark.createDataFrame(concepts)


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.gold_media_brand_asset_library",
    comment="Brand asset library - synthetic data for demo"
)
def gold_media_brand_asset_library():
    asset_types = ["Image", "Video", "Logo", "Icon", "Template"]
    formats_map = {"Image": ["jpg", "png"], "Video": ["mp4"], "Logo": ["svg", "png"], "Icon": ["svg"], "Template": ["html"]}
    categories = ["Sports", "Entertainment", "News", "Lifestyle", "Promo", "Brand"]
    assets = []
    for i in range(100):
        asset_id = f"ASSET-{i+1:05d}"
        asset_type = random.choice(asset_types)
        assets.append({
            "asset_id": asset_id,
            "asset_name": f"{random.choice(categories)} {asset_type} {i+1}",
            "asset_type": asset_type,
            "format": random.choice(formats_map[asset_type]),
            "category": random.choice(categories),
            "width_px": random.choice([300, 600, 1200, 1920]),
            "height_px": random.choice([250, 400, 800, 1080]),
            "file_size_bytes": random.randint(10000, 5000000),
            "storage_uri": f"/Volumes/{CATALOG}/lakefoundry/artifacts/assets/{asset_id}",
            "rights_status": random.choice(["Owned", "Licensed", "Royalty-Free"]),
            "tags": "hero,social,display",
            "created_ts": (datetime.now() - timedelta(days=random.randint(1, 180))).isoformat(),
            "status": random.choice(["active", "archived", "pending"]),
        })
    return spark.createDataFrame(assets)


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.gold_media_media_plan_line_items",
    comment="Media plan line items - synthetic data for demo"
)
def gold_media_media_plan_line_items():
    platforms = ["The Trade Desk", "DV360", "Meta", "Google Ads", "Amazon DSP"]
    placements = ["homepage_hero", "feed_unit", "pre_roll", "mid_roll", "display_banner"]
    line_items = []
    for i in range(75):
        line_item_id = f"LI-{i+1:05d}"
        campaign_id = f"CAMP-{1000 + (i % 20)}"
        brief_id = f"BRIEF-{(i % 20) + 1:03d}"
        line_items.append({
            "line_item_id": line_item_id,
            "campaign_id": campaign_id,
            "brief_id": brief_id,
            "line_item_name": f"Line Item {i+1}",
            "platform": random.choice(platforms),
            "placement": random.choice(placements),
            "budget": random.randint(5000, 100000),
            "start_date": (datetime.now() - timedelta(days=random.randint(0, 30))).strftime("%Y-%m-%d"),
            "end_date": (datetime.now() + timedelta(days=random.randint(7, 60))).strftime("%Y-%m-%d"),
            "target_impressions": random.randint(100000, 5000000),
            "target_cpm": round(random.uniform(2, 15), 2),
            "status": random.choice(["Active", "Paused", "Completed", "Draft"]),
            "created_ts": (datetime.now() - timedelta(days=random.randint(1, 60))).isoformat(),
        })
    return spark.createDataFrame(line_items)


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.gold_media_audience_segments",
    comment="Audience segments - synthetic data for demo"
)
def gold_media_audience_segments():
    segment_types = ["Behavioral", "Demographic", "Lookalike", "Contextual", "First-Party"]
    primary_segments = ["Sports Fan", "News Junkie", "Entertainment Binge Watcher", "Casual Viewer", "Cord Cutter"]
    value_segments = ["High Value", "Medium Value", "Standard", "At Risk", "New"]
    segments = []
    for i in range(30):
        segment_id = f"SEG-{i+1:04d}"
        segments.append({
            "segment_id": segment_id,
            "segment_name": f"Segment {i+1} - {random.choice(segment_types)}",
            "segment_type": random.choice(segment_types),
            "primary_segment": random.choice(primary_segments),
            "value_segment": random.choice(value_segments),
            "description": f"Target audience segment {i+1}",
            "estimated_size": random.randint(10000, 500000),
            "match_rate": round(random.uniform(0.6, 0.95), 2),
            "refresh_frequency": random.choice(["Daily", "Weekly", "Monthly"]),
            "data_source": random.choice(["First-Party", "Second-Party", "Third-Party"]),
            "is_active": random.choice([True, True, True, False]),
            "created_ts": (datetime.now() - timedelta(days=random.randint(1, 180))).isoformat(),
            "updated_ts": datetime.now().isoformat(),
        })
    return spark.createDataFrame(segments)
