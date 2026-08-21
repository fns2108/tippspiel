import { ImageResponse } from "next/og";
import { getCurrentUser } from "@/lib/auth";
import { isValidOrdinal } from "@/lib/nfl/season";
import { loadShareCard } from "@/lib/share-card";
import { loadFonts, renderShareCard } from "@/lib/share-image";

/** Auth, params, and nothing else — the drawing lives in lib/share-image.tsx. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ season: string; ordinal: string }> },
): Promise<ImageResponse | Response> {
  // The picks in this image are only visible to members; the PNG is not a way
  // around that.
  if (!(await getCurrentUser())) {
    return new Response("Nicht angemeldet.", { status: 401 });
  }

  const { season: seasonParam, ordinal: ordinalParam } = await params;
  const season = Number(seasonParam);
  const ordinal = Number(ordinalParam);
  if (!Number.isInteger(season) || !isValidOrdinal(ordinal)) {
    return new Response("Diese Woche gibt es nicht.", { status: 404 });
  }

  const [card, fonts] = await Promise.all([loadShareCard(season, ordinal), loadFonts()]);
  return renderShareCard(card, fonts);
}
