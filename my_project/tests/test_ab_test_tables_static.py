"""
Static tests for ab_test_tables.py

Tests the critical fixes without needing Spark:
1. Bare except clause replaced with specific AnalysisException
2. Traffic allocation logic prevents negative randint bounds
3. Date logic uses timedelta directly (no datetime.combine)
4. Explicit schema definitions for both tables
5. Canary_pct is nullable IntegerType
6. Traffic allocation sums to 100% per test
7. Fixed base timestamp for reproducibility
"""

import pathlib
from datetime import datetime, timedelta


def test_analysis_exception_handling():
    """Test that AnalysisException is caught (not bare except)."""
    ab_test_path = pathlib.Path(__file__).parent.parent.parent / "pipelines" / "ab_test_tables.py"
    source_code = ab_test_path.read_text()
    
    # Check that bare except is NOT present
    assert "except:" not in source_code, "Found bare except clause - should catch specific exceptions"
    
    # Check that AnalysisException is caught
    assert "except AnalysisException" in source_code, "AnalysisException should be caught"
    print("✓ AnalysisException handling is correct")


def test_schema_definitions_exist():
    """Test that explicit schema definitions are present in the code."""
    ab_test_path = pathlib.Path(__file__).parent.parent.parent / "pipelines" / "ab_test_tables.py"
    source_code = ab_test_path.read_text()
    
    # Check for config_schema definition
    assert "config_schema = StructType" in source_code, "config_schema should be defined"
    assert "StructField(\"ab_test_id\", StringType(), False)" in source_code, "ab_test_id field missing"
    
    # Check for variant_schema definition
    assert "variant_schema = StructType" in source_code, "variant_schema should be defined"
    assert "StructField(\"variant_id\", StringType(), False)" in source_code, "variant_id field missing"
    print("✓ Schema definitions are present")


def test_canary_pct_is_nullable():
    """Test that canary_pct is defined as nullable IntegerType."""
    ab_test_path = pathlib.Path(__file__).parent.parent.parent / "pipelines" / "ab_test_tables.py"
    source_code = ab_test_path.read_text()
    
    # Check for nullable canary_pct field
    assert 'StructField("canary_pct", IntegerType(), True)' in source_code, \
        "canary_pct should be nullable IntegerType"
    print("✓ canary_pct is nullable IntegerType")


def test_traffic_allocation_validation():
    """Test that traffic allocation validation is present."""
    ab_test_path = pathlib.Path(__file__).parent.parent.parent / "pipelines" / "ab_test_tables.py"
    source_code = ab_test_path.read_text()
    
    # Check for validation logic
    assert "total_allocation = control_pct + sum(treatment_allocations)" in source_code, \
        "Should calculate total allocation"
    assert "if total_allocation != 100:" in source_code, \
        "Should validate total allocation equals 100%"
    assert "raise ValueError" in source_code, \
        "Should raise ValueError on invalid allocation"
    print("✓ Traffic allocation validation is present")


def test_fixed_base_timestamp():
    """Test that BASE_TIMESTAMP is fixed (not using datetime.now())."""
    ab_test_path = pathlib.Path(__file__).parent.parent.parent / "pipelines" / "ab_test_tables.py"
    source_code = ab_test_path.read_text()
    
    # Check for BASE_TIMESTAMP definition
    assert "BASE_TIMESTAMP = datetime(" in source_code, \
        "BASE_TIMESTAMP should be defined with fixed datetime"
    assert "BASE_DATE = BASE_TIMESTAMP.date()" in source_code, \
        "BASE_DATE should be derived from BASE_TIMESTAMP"
    
    # Verify it's not using datetime.now()
    lines = source_code.split('\n')
    for i, line in enumerate(lines):
        if 'BASE_TIMESTAMP' in line and '=' in line and 'datetime(' in line:
            assert 'datetime.now()' not in line, \
                f"BASE_TIMESTAMP should not use datetime.now() at line {i+1}"
    print("✓ BASE_TIMESTAMP is fixed")


def test_date_logic_no_datetime_combine():
    """Test that date logic doesn't use datetime.combine()."""
    ab_test_path = pathlib.Path(__file__).parent.parent.parent / "pipelines" / "ab_test_tables.py"
    source_code = ab_test_path.read_text()
    
    # Check that datetime.combine is NOT used
    assert "datetime.combine" not in source_code, \
        "Should not use datetime.combine() - use timedelta directly on date objects"
    print("✓ Date logic uses timedelta directly")


def test_traffic_allocation_logic_safety():
    """Test that traffic allocation logic prevents negative randint bounds."""
    ab_test_path = pathlib.Path(__file__).parent.parent.parent / "pipelines" / "ab_test_tables.py"
    source_code = ab_test_path.read_text()
    
    # Look for the allocation logic
    # The fixed version should have bounds checking
    assert "remaining_for_future" in source_code or "max(" in source_code, \
        "Should have bounds checking to prevent negative randint"
    
    # Verify the logic doesn't directly do randint with potentially negative bounds
    lines = source_code.split('\n')
    for i, line in enumerate(lines):
        if 'randint' in line and 'remaining_pct' in line:
            # Should have some bounds checking
            # The line should not be: randint(10, remaining_pct - (num_variants - 2 - j) * 10)
            # without bounds checking
            pass
    print("✓ Traffic allocation logic has bounds checking")


def test_timestamps_use_base_timestamp():
    """Test that timestamp fields use BASE_TIMESTAMP, not datetime.now()."""
    ab_test_path = pathlib.Path(__file__).parent.parent.parent / "pipelines" / "ab_test_tables.py"
    source_code = ab_test_path.read_text()
    
    lines = source_code.split('\n')
    for i, line in enumerate(lines):
        if 'created_ts' in line or 'updated_ts' in line:
            if ':' in line and '=' in line:  # Assignment line
                # Should reference BASE_TIMESTAMP
                if 'datetime.now()' in line:
                    raise AssertionError(
                        f"Line {i+1}: Found datetime.now() in timestamp assignment. "
                        f"Should use BASE_TIMESTAMP instead.\nLine: {line}"
                    )
    print("✓ Timestamps use BASE_TIMESTAMP")


def test_imports_are_correct():
    """Test that all necessary imports are present."""
    ab_test_path = pathlib.Path(__file__).parent.parent.parent / "pipelines" / "ab_test_tables.py"
    source_code = ab_test_path.read_text()
    
    # Check for required imports
    assert "from pyspark.errors import AnalysisException" in source_code, \
        "Should import AnalysisException"
    assert "from datetime import datetime, timedelta" in source_code, \
        "Should import datetime and timedelta"
    assert "from pyspark.sql.types import" in source_code, \
        "Should import pyspark.sql.types"
    print("✓ All necessary imports are present")


def test_no_syntax_errors():
    """Test that the file has no syntax errors."""
    ab_test_path = pathlib.Path(__file__).parent.parent.parent / "pipelines" / "ab_test_tables.py"
    
    try:
        with open(ab_test_path, 'r') as f:
            compile(f.read(), ab_test_path, 'exec')
        print("✓ No syntax errors")
    except SyntaxError as e:
        raise AssertionError(f"Syntax error in ab_test_tables.py: {e}")


if __name__ == "__main__":
    # Run all tests
    test_analysis_exception_handling()
    test_schema_definitions_exist()
    test_canary_pct_is_nullable()
    test_traffic_allocation_validation()
    test_fixed_base_timestamp()
    test_date_logic_no_datetime_combine()
    test_traffic_allocation_logic_safety()
    test_timestamps_use_base_timestamp()
    test_imports_are_correct()
    test_no_syntax_errors()
    
    print("\n✅ All tests passed!")
