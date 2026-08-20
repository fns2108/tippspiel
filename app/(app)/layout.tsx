import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { currentSeason } from "@/lib/nfl/season";
import { getCurrentWeekOrdinal } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const season = currentSeason();
  const ordinal = (await getCurrentWeekOrdinal(season)) ?? 1;

  return (
    <AppShell
      username={user.username}
      isAdmin={user.isAdmin}
      season={season}
      ordinal={ordinal}
    >
      {children}
    </AppShell>
  );
}
