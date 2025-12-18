/**
 * UsageBucketRow is a row in the kb_usage table.
 */
export interface UsageBucketRow {
  bucket_start_ts: number;
  account_id: string;
  endpoint: string;
  request_count: number;
  token_in_count: number;
  token_out_count: number;
}

/**
 * LimitRow is a row in the kb_limits table.
 */
export interface LimitRow {
  plan: string;
  quota_requests_per_min: number;
  quota_storage_bytes: number;
  allow_reasoning: number; // 0 or 1
}
