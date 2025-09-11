// frontend/lib/env.ts
export const ENV = {
  // Client-side envs (set via NEXT_PUBLIC_*). Leave blank to use /api/* rewrites.
  PLANNER_URL: (process.env.NEXT_PUBLIC_PLANNER_URL as string) || "",
  BACKTEST_URL: (process.env.NEXT_PUBLIC_BACKTEST_URL as string) || "",
  INDEXER_URL: (process.env.NEXT_PUBLIC_INDEXER_URL as string) || "",
  EXPLAIN_URL: (process.env.NEXT_PUBLIC_EXPLAIN_URL as string) || "",
};

// If explicit URL is provided, use it; otherwise fall back to a relative /api/* route.
export function endpointOrFallback(
  explicitUrl: string | undefined | null,
  fallback: string
) {
  return explicitUrl && explicitUrl.length > 0 ? explicitUrl : fallback;
}
