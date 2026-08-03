export type CanonicalPosition = {
  block_height: number;
  block_hash: string;
  transaction_id: string;
  transaction_index: number;
  inscription_index: number;
};

export type ResolverResult = {
  schema: string;
  version: string;
  status: "experimental";
  scope: string;
  resolver: "same_sat_latest_v0.1";
  district: number;
  district_name: string;
  original_inscription_id: string;
  sat: number;
  selected_inscription_id: string;
  selected_content_sha256: string;
  selected_position: CanonicalPosition;
  snapshot_height: number;
  snapshot_block_hash: string;
  candidate_count: number;
  excluded_after_snapshot: number;
  provenance: string[];
  source_manifest: {
    opi: {
      implementation: string;
      commit: string;
      api_source_sha256: string;
      query: string;
      observed_at: string;
      response_sha256: string | null;
      response_status: string;
    };
    ord: {
      implementation: string;
      version: string;
      observed_at: string;
      enumeration_response_sha256: string;
    };
  };
  warnings: string[];
};

export function compareCanonicalPosition(
  left: CanonicalPosition,
  right: CanonicalPosition,
): number;

export function resolveSameSatLatestV01(fixture: unknown): ResolverResult;
