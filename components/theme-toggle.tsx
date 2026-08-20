"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";

type Mode = "light" | "dark" | "system";

/**
 * Three states, cycled: system → light → dark. "System" is the default because
 * this pool is watched both on a Sunday afternoon and at 02:00 on a Tuesday,
 * and the phone already knows which.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    setMode(stored === "light" || stored === "dark" ? stored : "system");
    setMounted(true);
  }, []);

  function cycle() {
    const next: Mode = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
    setMode(next);
    if (next === "system") {
      localStorage.removeItem("theme");
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem("theme", next);
      document.documentElement.dataset.theme = next;
    }
  }

  const label =
    mode === "system" ? "Theme: follow system" : mode === "light" ? "Theme: light" : "Theme: dark";

  return (
    <button
      type="button"
      onClick={cycle}
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-[3px] text-n1 transition-colors duration-150 hover:bg-sunken hover:text-ink ${className}`}
    >
      {/* Before mount the stored value is unknown, so show a neutral icon
          rather than guessing and flipping. */}
      {!mounted || mode === "system" ? (
        <span className="relative block h-4 w-4">
          <SunIcon className="absolute inset-0" />
          <span className="absolute -right-px -bottom-px block h-1.5 w-1.5 rounded-full bg-n2" />
        </span>
      ) : mode === "light" ? (
        <SunIcon />
      ) : (
        <MoonIcon />
      )}
    </button>
  );
}
