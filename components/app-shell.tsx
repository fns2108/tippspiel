"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GridIcon, PicksIcon, ShareIcon, ShieldIcon, StandingsIcon, UserIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = {
  href: string;
  label: string;
  match: (path: string) => boolean;
  Icon: typeof PicksIcon;
};

/**
 * Every destination is `force-dynamic`, which Next never prefetches on its own
 * — so the three or four links a member actually uses ask for it explicitly.
 * Paired with `experimental.staleTimes.dynamic` in next.config.ts, which is
 * what keeps a prefetched page alive long enough to be clicked.
 */
function navItems(season: number, ordinal: number): NavItem[] {
  return [
    {
      href: "/picks",
      label: "Picks",
      match: (p) => p === "/picks" || p.startsWith("/picks/"),
      Icon: PicksIcon,
    },
    {
      href: `/week/${season}/${ordinal}`,
      label: "Grid",
      match: (p) => p.startsWith("/week/"),
      Icon: GridIcon,
    },
    {
      href: "/standings",
      label: "Standings",
      match: (p) => p.startsWith("/standings") || p.startsWith("/u/"),
      Icon: StandingsIcon,
    },
    {
      href: "/share",
      label: "Teilen",
      match: (p) => p.startsWith("/share"),
      Icon: ShareIcon,
    },
  ];
}

export function AppShell({
  username,
  isAdmin,
  season,
  ordinal,
  children,
}: {
  username: string;
  isAdmin: boolean;
  season: number;
  ordinal: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const items = navItems(season, ordinal);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-ink-on"
      >
        Zum Inhalt springen
      </a>

      <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur-[2px]">
        <div className="shell flex h-14 items-center gap-4">
          <Link
            href="/picks"
            className="text-md font-semibold tracking-[-0.03em] no-underline"
          >
            Pick&apos;em
          </Link>

          <span aria-hidden className="hidden h-4 w-px bg-rule md:block" />

          {/* Desktop navigation. On mobile this lives in the bottom bar. */}
          <nav aria-label="Hauptnavigation" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {items.map((item) => {
                const active = item.match(pathname);
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      prefetch
                      aria-current={active ? "page" : undefined}
                      className={`-mb-px inline-flex h-14 items-center border-b-2 px-3 text-sm no-underline transition-colors duration-150 ${
                        active
                          ? "border-ink font-medium text-ink"
                          : "border-transparent text-n1 hover:text-ink"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <span className="label hidden sm:block" data-numeric>
              {season}
            </span>
            <ThemeToggle />
            {isAdmin && (
              <Link
                href="/admin"
                title="Admin"
                aria-label="Admin"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-[3px] no-underline transition-colors duration-150 hover:bg-sunken ${
                  pathname.startsWith("/admin") ? "text-ink" : "text-n1 hover:text-ink"
                }`}
              >
                <ShieldIcon />
              </Link>
            )}
            <Link
              href={`/u/${encodeURIComponent(username)}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-[3px] pl-1.5 pr-2 text-sm text-n1 no-underline transition-colors duration-150 hover:bg-sunken hover:text-ink"
            >
              <UserIcon />
              <span className="hidden max-w-28 truncate sm:block">{username}</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="shell pb-24 pt-6 md:pb-16">
        {children}
      </main>

      {/* Mobile tab bar. Fixed, thumb-reachable, clear of the home indicator. */}
      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper/95 backdrop-blur-[2px] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((item) => {
            const active = item.match(pathname);
            const Icon = item.Icon;
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  prefetch
                  aria-current={active ? "page" : undefined}
                  className={`flex h-[56px] flex-col items-center justify-center gap-1 no-underline transition-colors duration-150 ${
                    active ? "text-ink" : "text-n2"
                  }`}
                >
                  <Icon size={18} />
                  <span
                    className={`text-micro tracking-[0.06em] uppercase ${active ? "font-semibold" : "font-medium"}`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
