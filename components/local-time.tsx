"use client";

import { useEffect, useState } from "react";
import { formatDayAndTime, formatTime } from "@/lib/format";

/**
 * Renders a kickoff in the viewer's own timezone.
 *
 * The server render uses DISPLAY_TZ (Europe/Berlin by default), which is where
 * this pool actually lives, so the swap on mount is usually a no-op and there is
 * no visible flash. `suppressHydrationWarning` covers the case where someone is
 * travelling and the two genuinely differ.
 */
export function LocalTime({
  iso,
  fallback,
  mode = "time",
  className,
}: {
  iso: string;
  fallback: string;
  mode?: "time" | "full";
  className?: string;
}) {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const d = new Date(iso);
    setLocal(mode === "full" ? formatDayAndTime(d, tz) : formatTime(d, tz));
  }, [iso, mode]);

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {local ?? fallback}
    </time>
  );
}
