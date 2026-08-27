import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareImage } from "@/components/share-image";
import { WeekRail } from "@/components/week-rail";
import { requireUser } from "@/lib/auth";
import { currentSeason, isValidOrdinal, weekRef } from "@/lib/nfl/season";
import { loadShareCard } from "@/lib/share-card";
import { buildWeekRail } from "@/lib/week-view";

export const dynamic = "force-dynamic";

type Params = { ordinal?: string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { ordinal } = await params;
  const n = Number(ordinal?.[0]);
  return { title: isValidOrdinal(n) ? `${weekRef(n).label} teilen` : "Teilen" };
}

/** "Wild Card" → "wild-card", so the saved file has a name worth reading. */
function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default async function SharePage({ params }: { params: Promise<Params> }) {
  await requireUser();
  const season = currentSeason();
  const { ordinal: segments } = await params;

  // No week in the url means "the one I came here to send": loadShareCard
  // resolves null to the last week that was actually played.
  const requested = segments?.[0];
  let asked: number | null = null;
  if (requested !== undefined) {
    asked = Number(requested);
    if (!isValidOrdinal(asked)) notFound();
  }

  const card = await loadShareCard(season, asked);
  const ordinal = card.ref.ordinal;
  const rail = await buildWeekRail(season, ordinal);

  return (
    <div className="space-y-5">
      <header className="rule-head">
        <h1>{card.ref.label} teilen</h1>
        <p className="label" data-numeric>
          {card.complete
            ? "Endstand"
            : card.started
              ? `${card.finalGames}/${card.totalGames} beendet`
              : "Nicht gestartet"}
        </p>
      </header>

      <WeekRail weeks={rail} current={ordinal} hrefBase="/share" />

      <div className="space-y-4">
        {!card.complete && card.started && (
          <p className="border border-rule bg-panel px-3 py-2.5 text-sm text-n1">
            Diese Woche läuft noch. Das Bild zeigt den Stand von jetzt, nicht den Endstand.
          </p>
        )}

        <ShareImage
          src={`/api/share/${season}/${ordinal}`}
          filename={`tippspiel-${slug(card.ref.label)}-${season}.png`}
          title={`Tippspiel Wedel — ${card.ref.label}`}
        />

        <p className="max-w-[34rem] text-meta text-n2">
          Im Bild: die Tabelle der Woche, alle Ergebnisse und die Top&nbsp;3 der Saison. Es
          wird immer auf hellem Grund gezeichnet, damit es bei allen gleich aussieht.
        </p>
      </div>
    </div>
  );
}
