import type { TeamView } from "@/lib/queries";

/**
 * ESPN publishes a light and a dark rendering of every mark. Both ship; CSS
 * picks the one that belongs to the current ground (see globals.css), which
 * keeps it correct under an explicit theme toggle as well as the system setting.
 *
 * Decorative by default — the team's name is always adjacent in the markup, so
 * announcing the logo too would just double up for a screen reader.
 */
export function TeamLogo({
  team,
  size = 28,
  className = "",
  onInverted = false,
}: {
  team: Pick<TeamView, "abbrev" | "displayName">;
  size?: number;
  className?: string;
  /** True when the logo sits on an --ink fill, which inverts locally. */
  onInverted?: boolean;
}) {
  const slug = team.abbrev.toLowerCase();
  const dims = { width: size, height: size };
  return (
    <span
      data-invert={onInverted ? "true" : undefined}
      className={`logo relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        {...dims}
        src={`/teams/${slug}.png`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="logo-light block h-full w-full object-contain"
      />
      <img
        {...dims}
        src={`/teams/${slug}-dark.png`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="logo-dark absolute inset-0 h-full w-full object-contain"
      />
    </span>
  );
}
