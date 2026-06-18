from __future__ import annotations

import argparse
import json
import time

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.vectorsearch import (
    DeltaSyncVectorIndexSpecRequest,
    EmbeddingSourceColumn,
    EndpointType,
    PipelineType,
    VectorIndexType,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create Databricks Vector Search endpoint and creative asset index.")
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--index", required=True)
    parser.add_argument("--recreate-index", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    client = WorkspaceClient()
    source_table = f"{args.catalog}.{args.schema}.gold_buyside_asset_search_corpus"
    spark.sql(f"ALTER TABLE {source_table} SET TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true')")  # noqa: F821

    endpoint_names = {endpoint.name for endpoint in client.vector_search_endpoints.list_endpoints()}
    if args.endpoint not in endpoint_names:
        client.vector_search_endpoints.create_endpoint(name=args.endpoint, endpoint_type=EndpointType.STANDARD)

    deadline = time.time() + 900
    while time.time() < deadline:
        endpoint = client.vector_search_endpoints.get_endpoint(args.endpoint)
        state = getattr(getattr(endpoint, "endpoint_status", None), "state", None)
        state_value = getattr(state, "value", str(state))
        if state_value.upper() in {"ONLINE", "READY"}:
            break
        time.sleep(15)

    columns_to_sync = [
        "asset_id",
        "asset_name",
        "description",
        "search_text",
        "asset_type",
        "content_tags",
        "approved_regions",
        "approved_channels",
        "placement_contexts",
        "rights_profile_id",
        "thumbnail_uri",
        "storage_uri",
        "status",
    ]

    try:
        client.vector_search_indexes.get_index(index_name=args.index)
        if args.recreate_index:
            client.vector_search_indexes.delete_index(index_name=args.index)
            for _ in range(60):
                try:
                    client.vector_search_indexes.get_index(index_name=args.index)
                    time.sleep(5)
                except Exception:
                    break
            exists = False
        else:
            exists = True
    except Exception:
        exists = False

    if exists:
        created = False
    else:
        client.vector_search_indexes.create_index(
            name=args.index,
            endpoint_name=args.endpoint,
            primary_key="asset_id",
            index_type=VectorIndexType.DELTA_SYNC,
            delta_sync_index_spec=DeltaSyncVectorIndexSpecRequest(
                source_table=source_table,
                columns_to_sync=columns_to_sync,
                embedding_source_columns=[
                    EmbeddingSourceColumn(
                        name="search_text",
                        embedding_model_endpoint_name="databricks-gte-large-en",
                    )
                ],
                pipeline_type=PipelineType.TRIGGERED,
            ),
        )
        created = True

    print(json.dumps({"endpoint": args.endpoint, "index": args.index, "source_table": source_table, "created": created}, indent=2))


if __name__ == "__main__":
    main()
