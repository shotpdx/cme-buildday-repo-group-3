"""
Identity Graph Gold Table Pipeline

Creates a gold-layer identity graph table that bridges 1P customer data with various
device/channel identifiers (email, MAID, CTV, household, cookies).

Source: gold_media_customer_360 (canonical_id as master_id)
Target: gold_buyside_identity_graph (cme_outcomes_uswest.lakefoundry)

Grain: One row per master_id (canonical_id)
"""

from pyspark import pipelines as dp
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType
import hashlib
import uuid
from datetime import datetime


@dp.table(name="gold_buyside_identity_graph")
def gold_buyside_identity_graph():
    """
    Generate identity graph entries for all customers in gold_media_customer_360.
    
    For each customer (master_id = canonical_id), generate:
    - Hashed email ID from existing email
    - Synthetic MAID (Mobile Advertising ID)
    - Synthetic CTV ID
    - Synthetic Household ID
    - Synthetic Cookie ID
    - Resolution confidence score
    - Timestamps
    """
    
    # Read source customer data from external catalog
    customers = spark.read.table("cme_outcomes_uswest.media_demo.gold_media_customer_360")
    
    # Define UDFs for ID generation
    def hash_email(email):
        """Generate SHA256 hash of email."""
        if email is None:
            return None
        return hashlib.sha256(email.encode()).hexdigest()
    
    def generate_maid():
        """Generate a synthetic Mobile Advertising ID (UUID format)."""
        return str(uuid.uuid4())
    
    def generate_ctv_id():
        """Generate a synthetic CTV ID."""
        return f"ctv_{uuid.uuid4().hex[:16]}"
    
    def generate_household_id():
        """Generate a synthetic Household ID."""
        return f"hh_{uuid.uuid4().hex[:16]}"
    
    def generate_cookie_id():
        """Generate a synthetic Cookie ID."""
        return f"cookie_{uuid.uuid4().hex[:20]}"
    
    # Register UDFs
    hash_email_udf = F.udf(hash_email, StringType())
    generate_maid_udf = F.udf(generate_maid, StringType())
    generate_ctv_id_udf = F.udf(generate_ctv_id, StringType())
    generate_household_id_udf = F.udf(generate_household_id, StringType())
    generate_cookie_id_udf = F.udf(generate_cookie_id, StringType())
    
    # Generate identity graph with synthetic linked IDs
    identity_graph = (
        customers
        .select(
            F.col("canonical_id").alias("master_id"),
            hash_email_udf(F.col("email")).alias("hashed_email_id"),
            generate_maid_udf().alias("maid_id"),
            generate_ctv_id_udf().alias("ctv_id"),
            generate_household_id_udf().alias("household_id"),
            generate_cookie_id_udf().alias("cookie_id"),
            # Resolution confidence: higher for customers with email, lower otherwise
            F.when(
                F.col("email").isNotNull(),
                F.lit(0.95)  # High confidence when email present
            ).otherwise(
                F.lit(0.75)  # Lower confidence for email-less records
            ).alias("id_resolution_confidence"),
            F.col("last_engagement_ts").alias("last_resolved_ts"),
            F.current_timestamp().alias("created_ts")
        )
    )
    
    return identity_graph
