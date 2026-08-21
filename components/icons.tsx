/**
 * Authored icon set. One 16-unit grid, 1.5 stroke, round caps and joins,
 * currentColor throughout — so an icon inherits whatever text it sits beside.
 *
 * Decorative by default (`aria-hidden`); pass a `title` to make one a labelled
 * graphic for assistive tech.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string; size?: number };

function Icon({ title, size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8.5 6.2 11.7 13 4.9" />
  </Icon>
);

export const CrossIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Icon>
);

export const DashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8h8" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.25" y="7" width="9.5" height="6.5" rx="1.25" />
    <path d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5.75" />
    <path d="M8 4.75V8l2.25 1.5" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 3.5 5.5 8l4.5 4.5" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3.5 10.5 8 6 12.5" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 6 8 10.5 12.5 6" />
  </Icon>
);

export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6.75a4 4 0 1 1 8 0c0 2.4.6 3.6 1.25 4.25H2.75C3.4 10.35 4 9.15 4 6.75Z" />
    <path d="M6.5 13.25a1.75 1.75 0 0 0 3 0" />
  </Icon>
);

export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="5.75" r="2.75" />
    <path d="M2.75 13.5a5.25 5.25 0 0 1 10.5 0" />
  </Icon>
);

/** Picks — a ballot with a mark. */
export const PicksIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="1.5" />
    <path d="M5.5 8.25 7 9.75l3.5-3.5" />
  </Icon>
);

/** The grid — everyone's picks against every game. */
export const GridIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="1.5" />
    <path d="M2.75 6.25h10.5M2.75 9.75h10.5M6.25 2.75v10.5" />
  </Icon>
);

/** Standings — ranked bars, tallest first. */
export const StandingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 13V6.5M8 13V3.25M13 13V9" />
  </Icon>
);

export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 2.25 3.25 4.1v4.05c0 2.7 1.95 4.85 4.75 5.6 2.8-.75 4.75-2.9 4.75-5.6V4.1Z" />
  </Icon>
);

export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.75 3.5h2.5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-2.5" />
    <path d="M7 5.5 9.5 8 7 10.5M9.5 8h-7" />
  </Icon>
);

export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.5v1.75M8 12.75v1.75M14.5 8h-1.75M3.25 8H1.5M12.6 3.4l-1.25 1.25M4.65 11.35 3.4 12.6M12.6 12.6l-1.25-1.25M4.65 4.65 3.4 3.4" />
  </Icon>
);

export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.75 5.75 0 1 0 6.5 6.5Z" />
  </Icon>
);

export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5.75" y="5.75" width="7.5" height="7.5" rx="1.25" />
    <path d="M10.25 5.75v-1.5a1.5 1.5 0 0 0-1.5-1.5h-4.5a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5h1.5" />
  </Icon>
);

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5.75" />
    <path d="M8 5v3.5" />
    <circle cx="8" cy="10.9" r="0.4" fill="currentColor" stroke="none" />
  </Icon>
);

export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.25 8a5.25 5.25 0 1 1-1.6-3.78" />
    <path d="M13.4 2.6v3h-3" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3.5v9M3.5 8h9" />
  </Icon>
);

/** Share — a sheet with an arrow leaving the top, the platform idiom. */
export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 2.5v7.25" />
    <path d="M5.5 5 8 2.5 10.5 5" />
    <path d="M4.25 7.5H3.5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-.75" />
  </Icon>
);

/** Download — the same sheet, arrow pointing in. */
export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 2.5v7.25" />
    <path d="M5.5 7.25 8 9.75l2.5-2.5" />
    <path d="M2.5 11.5v1a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1" />
  </Icon>
);
