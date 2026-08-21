/**
 * The shape of a page while its data is in flight.
 *
 * These exist as much for prefetching as for slow requests: Next only
 * prefetches a dynamic route that has a loading boundary, so a route without
 * one of these pays a full round trip on every click. What they draw is
 * deliberately the page's rules and rhythm rather than generic grey blocks —
 * the layout should not jump when the real rows arrive.
 */

export function HeadSkeleton() {
  return (
    <div className="rule-head">
      <span className="skeleton h-6 w-40" />
      <span className="skeleton h-3 w-24" />
    </div>
  );
}

export function RailSkeleton() {
  return (
    <div className="flex gap-px border-b border-rule pb-2" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className="skeleton h-11 w-11 shrink-0" />
      ))}
    </div>
  );
}

export function RowsSkeleton({ count = 8, height = "h-14" }: { count?: number; height?: string }) {
  return (
    <div className="border-t border-rule" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-rule py-2">
          <span className={`skeleton ${height} flex-1`} />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({
  rail = false,
  rows = 8,
  height,
}: {
  rail?: boolean;
  rows?: number;
  height?: string;
}) {
  return (
    <div className="space-y-5" role="status" aria-label="Wird geladen">
      <HeadSkeleton />
      {rail && <RailSkeleton />}
      <RowsSkeleton count={rows} height={height} />
    </div>
  );
}
