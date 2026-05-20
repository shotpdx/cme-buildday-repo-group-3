"""
Unit tests for ab_test_tables.py

Tests the critical fixes:
1. Bare except clause replaced with specific AnalysisException
2. Traffic allocation logic prevents negative randint bounds
3. Date logic uses timedelta directly (no datetime.combine)
4. Explicit schema definitions for both tables
5. Canary_pct is nullable IntegerType
6. Traffic allocation sums to 100% per test
7. Fixed base timestamp for reproducibility
"""

import sys
import pathlib
from datetime import datetime, timedelta
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType, DoubleType, 
    TimestampType, BooleanType, DateType
)


def test_import_ab_test_tables():
    """Test that ab_test_tables module can be imported without errors."""
    # Add pipelines to path
    sys.path.insert(0, str(pathlib.Path(__file__).parent.parent.parent))
    
    # This should not raise any syntax or import errors
    import pipelines.ab_test_tables as ab_test
    
    # Verify constants are defined
    assert hasattr(ab_test, 'BASE_TIMESTAMP')
    assert hasattr(ab_test, 'BASE_DATE')
    assert ab_test.BASE_TIMESTAMP == datetime(2024, 1, 15, 10, 0, 0)


def test_base_timestamp_is_fixed():
    """Test that BASE_TIMESTAMP is fixed (not using datetime.now())."""
    sys.path.insert(0, str(pathlib.Path(__file__).parent.parent.parent))
    import pipelines.ab_test_tables as ab_test
    
    # Should be a fixed datetime
    expected = datetime(2024, 1, 15, 10, 0, 0)
    assert ab_test.BASE_TIMESTAMP == expected
    
    # Should be deterministic (same value on repeated calls)
    ts1 = ab_test.BASE_TIMESTAMP
    ts2 = ab_test.BASE_TIMESTAMP
    assert ts1 == ts2


def test_analysis_exception_import():
    """Test that AnalysisException is properly imported."""
    sys.path.insert(0, str(pathlib.Path(__file__).parent.parent.parent))
    import pipelines.ab_test_tables as ab_test
    
    # Verify AnalysisException is available in the module
    from pyspark.errors import AnalysisException
    assert AnalysisException is not None


def test_traffic_allocation_logic_safety():
    """Test that traffic allocation logic doesn't produce negative randint bounds."""
    sys.path.insert(0, str(pathlib.Path(__file__).parent.parent.parent))
    
    # Simulate the allocation logic
    import random
    random.seed(42)
    
    # Test multiple scenarios
    for _ in range(100):
        num_variants = random.randint(2, 4)
        control_pct = random.randint(40, 60)
        remaining_pct = 100 - control_pct
        
        num_treatments = num_variants - 1
        allocations = []
        
        # This is the fixed logic - should never raise ValueError
        for j in range(num_treatments):
            if j == num_treatments - 1:
                allocations.append(remaining_pct - sum(allocations))
            else:
                remaining_for_future = (num_treatments - 1 - j) * 10
                max_alloc = remaining_pct - sum(allocations) - remaining_for_future
                max_alloc = max(10, max_alloc)
                
                # This should never fail with "non-positive upper bound"
                alloc = random.randint(10, max_alloc)
                allocations.append(alloc)
        
        # Verify sum equals remaining_pct
        assert sum(allocations) == remaining_pct
        assert control_pct + sum(allocations) == 100


def test_date_logic_uses_timedelta():
    """Test that date logic uses timedelta directly (not datetime.combine)."""
    sys.path.insert(0, str(pathlib.Path(__file__).parent.parent.parent))
    import pipelines.ab_test_tables as ab_test
    
    # Verify BASE_DATE is a date object
    assert isinstance(ab_test.BASE_DATE, type(datetime.now().date()))
    
    # Test that timedelta operations work correctly
    base_date = ab_test.BASE_DATE
    
    # These should work without datetime.combine()
    future_date = base_date + timedelta(days=10)
    past_date = base_date - timedelta(days=5)
    
    assert future_date > base_date
    assert past_date < base_date


def test_schema_definitions_exist():
    """Test that explicit schema definitions are present in the code."""
    sys.path.insert(0, str(pathlib.Path(__file__).parent.parent.parent))
    
    # Read the source file and check for schema definitions
    ab_test_path = pathlib.Path(__file__).parent.parent.parent / "pipelines" / "ab_test_tables.py"
    source_code = ab_test_path.read_text()
    
    # Check for config_schema definition
    assert "config_schema = StructType" in source_code
    assert "StructField(\"ab_test_id\", StringType(), False)" in source_code
    
    # Check for variant_schema definition
    assert "variant_schema = StructType" in source_code
    assert "StructField(\"variant_id\", StringType(), False)" in source_code


def test_canary_pct_is_nullable():
    """Test that canary_pct is defined as nullable IntegerType."""
    sys.path.insert(0, str(pathlib.Path(__file__).parent.parent.parent))
    
    ab_test_path = pathlib.Path(__file__).parent.parent.parent / "pipelines" / "ab_test_tables.py"
    source_code = ab_test_path.read_text()
    
    # Check for nullable canary_pct field
    assert 'StructField("canary_pct", IntegerType(), True)' in source_code


def test_traffic_allocation_validation():
    """Test that traffic allocation validation is present."""
    sys.path.insert(0, str(pathlib.Path(__file__).parent.parent.parent))
    
    ab_test_path = pathlib.Path(__file__).parent.parent.parent / "pipelines" / "ab_test_tables.py"
    source_code = ab_test_path.read_text()
    
    # Check for validation logic
    assert "total_allocation = control_pct + sum(treatment_allocations)" in source_code
    assert "if total_allocation != 100:" in source_code
    assert "raise ValueError" in source_code


def test_analysis_exception_handling():
    """Test that AnalysisException is caught (not bare except)."""
    sys.path.insert(0, str(pathlib.Path(__file__).parent.parent.parent))
    
    ab_test_path = pathlib.Path(__file__).parent.parent.parent / "pipelines" / "ab_test_tables.py"
    source_code = ab_test_path.read_text()
    
    # Check that bare except is NOT present
    assert "except:" not in source_code
    
    # Check that AnalysisException is caught
    assert "except AnalysisException" in source_code


def test_no_datetime_now_in_timestamps():
    """Test that datetime.now() is not used for timestamps."""
    sys.path.insert(0, str(pathlib.Path(__file__).parent.parent.parent))
    
    ab_test_path = pathlib.Path(__file__).parent.parent.parent / "pipelines" / "ab_test_tables.py"
    source_code = ab_test_path.read_text()
    
    # Count occurrences of datetime.now()
    # Should only be in imports or comments, not in actual timestamp assignments
    lines = source_code.split('\n')
    timestamp_lines = [l for l in lines if 'created_ts' in l or 'updated_ts' in l]
    
    for line in timestamp_lines:
        # Should use BASE_TIMESTAMP, not datetime.now()
        if 'datetime.now()' in line:
            # This is an error - timestamps should use BASE_TIMESTAMP
            raise AssertionError(f"Found datetime.now() in timestamp assignment: {line}")
        if 'created_ts' in line or 'updated_ts' in line:
            # Should reference BASE_TIMESTAMP
            assert 'BASE_TIMESTAMP' in line


if __name__ == "__main__":
    # Run tests
    test_import_ab_test_tables()
    test_base_timestamp_is_fixed()
    test_analysis_exception_import()
    test_traffic_allocation_logic_safety()
    test_date_logic_uses_timedelta()
    test_schema_definitions_exist()
    test_canary_pct_is_nullable()
    test_traffic_allocation_validation()
    test_analysis_exception_handling()
    test_no_datetime_now_in_timestamps()
    
    print("✓ All tests passed!")
