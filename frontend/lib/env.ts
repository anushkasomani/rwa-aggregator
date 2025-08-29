export const ENV = {
  PLANNER_URL: process.env.NEXT_PUBLIC_PLANNER_URL || process.env.PLANNER_URL || "",
  BACKTEST_URL: process.env.NEXT_PUBLIC_BACKTEST_URL || process.env.BACKTEST_URL || "",
  INDEXER_URL: process.env.NEXT_PUBLIC_INDEXER_URL || process.env.INDEXER_URL || "",
  EXPLAIN_URL: process.env.NEXT_PUBLIC_EXPLAIN_URL || process.env.EXPLAIN_URL || "",
};

export function endpointOrFallback(primary: string | undefined, fallback: string) {
  return primary && primary.length > 0 ? primary : fallback;
}
