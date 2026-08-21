"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Keeps a page current while games are in progress.
 *
 * There is no websocket and no paid cron here: the server refreshes its ESPN
 * data when a request finds it stale, so simply re-rendering on an interval is
 * the whole live-scoring mechanism. It pauses on a hidden tab — a phone in a
 * pocket should not poll — and refreshes once immediately on return.
 */
export function LiveRefresh({
  active,
  intervalMs = 30_000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [stale, setStale] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;

    const stop = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };

    const start = () => {
      stop();
      timer.current = setInterval(() => {
        setStale(true);
        router.refresh();
        // The refresh resolves on the server; clear the hint shortly after.
        setTimeout(() => setStale(false), 1200);
      }, intervalMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, intervalMs, router]);

  if (!active) return null;

  return (
    <span
      aria-live="polite"
      className="inline-flex items-center gap-1.5 text-micro font-semibold uppercase tracking-[0.08em] text-live"
    >
      <span aria-hidden className="live-dot h-1.5 w-1.5 rounded-full bg-live" />
      {stale ? "Aktualisiert" : "Live"}
    </span>
  );
}
