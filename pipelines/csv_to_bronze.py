"""
CSV to Bronze Layer Pipeline

Loads CSV seed files from UC Volume into bronze tables in the media_demo schema.
This is the first step in the medallion architecture, creating the foundation
for silver and gold layer transformations.

Source: /Volumes/{catalog}/{schema}/seed_data/*.csv
Target: {catalog}.media_demo.bronze_*

Run this pipeline first to bootstrap the data foundation before running
the buyside_data_foundation pipeline.
"""

from pyspark.sql import functions as F
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType, DoubleType,
    LongType, BooleanType, TimestampType, DateType
)
from pyspark import pipelines as dlt
from datetime import datetime
import json

# Configuration - these come from pipeline settings
CATALOG = spark.conf.get("catalog", "cme_outcomes_uswest")
SCHEMA = spark.conf.get("schema", "media_demo")
SEED_VOLUME_PATH = spark.conf.get("seed_volume_path", f"/Volumes/{CATALOG}/lakefoundry/seed_data")


# ============================================================================
# BRONZE TABLES - Direct CSV ingestion with minimal transformation
# ============================================================================

@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.bronze_media_creative_briefs",
    comment="Bronze layer: Campaign briefs loaded from CSV seed data"
)
def bronze_briefs():
    """Load briefs from CSV with schema inference."""
    return (
        spark.read
        .option("header", "true")
        .option("inferSchema", "true")
        .csv(f"{SEED_VOLUME_PATH}/briefs.csv")
        .withColumn("_loaded_ts", F.current_timestamp())
        .withColumn("_source_file", F.lit("briefs.csv"))
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.bronze_audience_cohorts",
    comment="Bronze layer: Audience cohorts loaded from CSV seed data"
)
def bronze_audiences():
    """Load audience cohorts from CSV."""
    return (
        spark.read
        .option("header", "true")
        .option("inferSchema", "true")
        .csv(f"{SEED_VOLUME_PATH}/audiences.csv")
        .withColumn("_loaded_ts", F.current_timestamp())
        .withColumn("_source_file", F.lit("audiences.csv"))
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.bronze_generated_creatives",
    comment="Bronze layer: Creative assets loaded from CSV seed data"
)
def bronze_creatives():
    """Load creative assets from CSV."""
    return (
        spark.read
        .option("header", "true")
        .option("inferSchema", "true")
        .csv(f"{SEED_VOLUME_PATH}/creatives.csv")
        .withColumn("_loaded_ts", F.current_timestamp())
        .withColumn("_source_file", F.lit("creatives.csv"))
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.bronze_campaign_activations",
    comment="Bronze layer: Campaign activations loaded from CSV seed data"
)
def bronze_activations():
    """Load activations from CSV."""
    return (
        spark.read
        .option("header", "true")
        .option("inferSchema", "true")
        .csv(f"{SEED_VOLUME_PATH}/activations.csv")
        .withColumn("_loaded_ts", F.current_timestamp())
        .withColumn("_source_file", F.lit("activations.csv"))
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.bronze_market_regions",
    comment="Bronze layer: Market regions loaded from CSV seed data"
)
def bronze_markets():
    """Load market regions from CSV."""
    return (
        spark.read
        .option("header", "true")
        .option("inferSchema", "true")
        .csv(f"{SEED_VOLUME_PATH}/markets.csv")
        .withColumn("_loaded_ts", F.current_timestamp())
        .withColumn("_source_file", F.lit("markets.csv"))
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.bronze_market_cities",
    comment="Bronze layer: Market cities loaded from CSV seed data"
)
def bronze_market_cities():
    """Load market cities from CSV."""
    return (
        spark.read
        .option("header", "true")
        .option("inferSchema", "true")
        .csv(f"{SEED_VOLUME_PATH}/market_cities.csv")
        .withColumn("_loaded_ts", F.current_timestamp())
        .withColumn("_source_file", F.lit("market_cities.csv"))
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.bronze_market_audience_mix",
    comment="Bronze layer: Market audience mix loaded from CSV seed data"
)
def bronze_market_audience_mix():
    """Load market audience mix from CSV."""
    return (
        spark.read
        .option("header", "true")
        .option("inferSchema", "true")
        .csv(f"{SEED_VOLUME_PATH}/market_audience_mix.csv")
        .withColumn("_loaded_ts", F.current_timestamp())
        .withColumn("_source_file", F.lit("market_audience_mix.csv"))
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.bronze_market_trend",
    comment="Bronze layer: Market trend data loaded from CSV seed data"
)
def bronze_market_trend():
    """Load market trend from CSV."""
    return (
        spark.read
        .option("header", "true")
        .option("inferSchema", "true")
        .csv(f"{SEED_VOLUME_PATH}/market_trend.csv")
        .withColumn("_loaded_ts", F.current_timestamp())
        .withColumn("_source_file", F.lit("market_trend.csv"))
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.bronze_performance_trend",
    comment="Bronze layer: Performance trend loaded from CSV seed data"
)
def bronze_performance_trend():
    """Load performance trend from CSV."""
    return (
        spark.read
        .option("header", "true")
        .option("inferSchema", "true")
        .csv(f"{SEED_VOLUME_PATH}/performance_trend.csv")
        .withColumn("_loaded_ts", F.current_timestamp())
        .withColumn("_source_file", F.lit("performance_trend.csv"))
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.bronze_channel_mix",
    comment="Bronze layer: Channel mix loaded from CSV seed data"
)
def bronze_channel_mix():
    """Load channel mix from CSV."""
    return (
        spark.read
        .option("header", "true")
        .option("inferSchema", "true")
        .csv(f"{SEED_VOLUME_PATH}/channel_mix.csv")
        .withColumn("_loaded_ts", F.current_timestamp())
        .withColumn("_source_file", F.lit("channel_mix.csv"))
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.bronze_quality_radar",
    comment="Bronze layer: Quality radar metrics loaded from CSV seed data"
)
def bronze_quality_radar():
    """Load quality radar from CSV."""
    return (
        spark.read
        .option("header", "true")
        .option("inferSchema", "true")
        .csv(f"{SEED_VOLUME_PATH}/quality_radar.csv")
        .withColumn("_loaded_ts", F.current_timestamp())
        .withColumn("_source_file", F.lit("quality_radar.csv"))
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.bronze_activity",
    comment="Bronze layer: Activity log loaded from CSV seed data"
)
def bronze_activity():
    """Load activity from CSV."""
    return (
        spark.read
        .option("header", "true")
        .option("inferSchema", "true")
        .csv(f"{SEED_VOLUME_PATH}/activity.csv")
        .withColumn("_loaded_ts", F.current_timestamp())
        .withColumn("_source_file", F.lit("activity.csv"))
    )


# ============================================================================
# SILVER TABLES - Cleaned and typed data
# ============================================================================

@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.silver_media_creative_briefs",
    comment="Silver layer: Cleaned and typed creative briefs"
)
def silver_briefs():
    """Clean and type briefs data."""
    bronze = dlt.read(f"{CATALOG}.{SCHEMA}.bronze_media_creative_briefs")
    return (
        bronze
        .withColumn("budget", F.col("budget").cast(DoubleType()))
        .withColumn("status", F.upper(F.trim(F.col("status"))))
        .withColumn("created_ts", F.coalesce(
            F.to_timestamp(F.col("created_ts")),
            F.current_timestamp()
        ))
        .dropDuplicates(["brief_id"])
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.silver_audience_cohorts",
    comment="Silver layer: Cleaned and typed audience cohorts"
)
def silver_audiences():
    """Clean and type audience data."""
    bronze = dlt.read(f"{CATALOG}.{SCHEMA}.bronze_audience_cohorts")
    return (
        bronze
        .withColumn("reach", F.col("reach").cast(LongType()))
        .withColumn("match_rate", F.col("match_rate").cast(DoubleType()))
        .withColumn("avg_ltv", F.col("avg_ltv").cast(DoubleType()))
        .dropDuplicates(["cohort_id"])
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.silver_generated_creatives",
    comment="Silver layer: Cleaned and typed creative assets"
)
def silver_creatives():
    """Clean and type creatives data."""
    bronze = dlt.read(f"{CATALOG}.{SCHEMA}.bronze_generated_creatives")
    return (
        bronze
        .withColumn("width_px", F.col("width_px").cast(IntegerType()))
        .withColumn("height_px", F.col("height_px").cast(IntegerType()))
        .withColumn("approval_status", F.coalesce(
            F.col("approval_status"),
            F.lit("Pending_Review")
        ))
        .dropDuplicates(["creative_asset_id"])
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.silver_campaign_activations",
    comment="Silver layer: Cleaned and typed campaign activations"
)
def silver_activations():
    """Clean and type activations data."""
    bronze = dlt.read(f"{CATALOG}.{SCHEMA}.bronze_campaign_activations")
    return (
        bronze
        .withColumn("impressions", F.col("impressions").cast(LongType()))
        .withColumn("clicks", F.col("clicks").cast(LongType()))
        .withColumn("conversions", F.col("conversions").cast(LongType()))
        .withColumn("cost", F.col("cost").cast(DoubleType()))
        .dropDuplicates(["activation_id"])
    )


# ============================================================================
# GOLD TABLES - Business-ready aggregations
# ============================================================================

@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.gold_media_creative_briefs",
    comment="Gold layer: Business-ready creative briefs with enrichments"
)
def gold_briefs():
    """Create gold briefs table with business logic."""
    silver = dlt.read(f"{CATALOG}.{SCHEMA}.silver_media_creative_briefs")
    return (
        silver
        .withColumn("is_active", F.col("status").isin("ACTIVE", "IN_PROGRESS", "LIVE"))
        .withColumn("budget_tier", F.when(F.col("budget") >= 100000, "High")
                                    .when(F.col("budget") >= 50000, "Medium")
                                    .otherwise("Low"))
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.gold_buyside_audience_cohort",
    comment="Gold layer: Business-ready audience cohorts"
)
def gold_audiences():
    """Create gold audience cohorts table."""
    silver = dlt.read(f"{CATALOG}.{SCHEMA}.silver_audience_cohorts")
    return (
        silver
        .withColumn("reach_tier", F.when(F.col("reach") >= 1000000, "Large")
                                   .when(F.col("reach") >= 100000, "Medium")
                                   .otherwise("Small"))
        .withColumn("value_tier", F.when(F.col("avg_ltv") >= 500, "High Value")
                                   .when(F.col("avg_ltv") >= 200, "Medium Value")
                                   .otherwise("Standard"))
    )


@dlt.table(
    name=f"{CATALOG}.{SCHEMA}.gold_buyside_campaign_activation",
    comment="Gold layer: Business-ready campaign activations with metrics"
)
def gold_activations():
    """Create gold activations table with calculated metrics."""
    silver = dlt.read(f"{CATALOG}.{SCHEMA}.silver_campaign_activations")
    return (
        silver
        .withColumn("ctr", F.when(F.col("impressions") > 0,
                                   F.col("clicks") / F.col("impressions") * 100)
                           .otherwise(0.0))
        .withColumn("cpa", F.when(F.col("conversions") > 0,
                                   F.col("cost") / F.col("conversions"))
                           .otherwise(0.0))
        .withColumn("cvr", F.when(F.col("clicks") > 0,
                                   F.col("conversions") / F.col("clicks") * 100)
                           .otherwise(0.0))
    )
