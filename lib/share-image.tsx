import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ShareCard } from "@/lib/share-card";

/**
 * The week as one PNG, sized for a chat thread.
 *
 * WhatsApp recompresses anything it forwards and shows it first as a thumbnail
 * a few hundred pixels wide, so this is built to survive that: no hairlines
 * below 2px, no type below 22px, and the one thing that must read at thumbnail
 * size — who won — carried by an inverted block rather than by colour.
 *
 * Always drawn on paper, never in the sender's theme. A picture leaves the app
 * and has no theme to inherit; two members sending "the same" week in different
 * colours would look like two different documents.
 */

const WIDTH = 1080;
const PAD = 56;

const PAPER = "#fbfbfa";
const INK = "#111112";
const INK_ON = "#fbfbfa";
const N1 = "#6b6b68";
const N2 = "#8a8a86";
const RULE = "#e2e2de";
const SUNKEN = "#eeeeec";

const FONT_DIR = join(process.cwd(), "assets", "fonts");

/** Read once per warm instance; four files is not worth re-reading per request. */
let fontsPromise: Promise<
  { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700; style: "normal" }[]
> | null = null;

function loadFonts() {
  fontsPromise ??= Promise.all(
    (
      [
        ["Inter-Regular.ttf", "Inter", 400],
        ["Inter-SemiBold.ttf", "Inter", 600],
        ["Inter-Bold.ttf", "Inter", 700],
        ["JetBrainsMono-Medium.ttf", "JetBrains Mono", 500],
        ["JetBrainsMono-Bold.ttf", "JetBrains Mono", 700],
      ] as const
    ).map(async ([file, name, weight]) => {
      const buf = await readFile(join(FONT_DIR, file));
      return {
        name,
        data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
        weight,
        style: "normal" as const,
      };
    }),
  );
  return fontsPromise;
}

/* ------------------------------------------------------------- geometry */

const ROW_H = 74;
const GAME_COLS = 3;
const GAME_ROW_H = 48;
/**
 * A result is drawn at a fixed width and left-aligned in a wider column, so the
 * slack between columns is always larger than the space inside one. Splitting
 * the column evenly instead leaves an identical gap either side of every
 * abbreviation, and "BUF" next to "MIA" reads as a fixture that never happened.
 */
const GAME_CONTENT_W = 224;
const GAME_ABBREV_W = 64;

/**
 * The canvas has to be sized before anything is drawn — Satori lays out into a
 * fixed viewport and reports nothing back — so the height is added up here from
 * the same constants the layout uses.
 *
 * Satori's default line box is 1.2em, which is where the odd-looking numbers
 * come from. The footer holds itself to the bottom with `marginTop: auto`, so
 * over-estimating here only opens a gap while under-estimating would clip the
 * season line off the picture; SLACK keeps the error on the safe side.
 */
const SLACK = 8;
const line = (fontSize: number) => Math.ceil(fontSize * 1.2);

function measure(card: ShareCard) {
  const gameRows = Math.ceil(card.games.length / GAME_COLS);

  const head =
    line(21) + // "PICK'EM" / "SAISON 2025"
    22 +
    line(82) + // the week's name
    20 +
    4; // the heavy rule under it

  const board = 24 + card.rows.length * (ROW_H + 2); // +2 for each row's rule

  const results =
    card.games.length > 0 ? 40 + line(21) + 16 + gameRows * GAME_ROW_H : 0;

  const footer = card.seasonTop.length > 0 ? 26 + 2 + line(26) : 0;

  return { height: PAD * 2 + head + board + results + footer + SLACK, gameRows };
}

/* ---------------------------------------------------------------- pieces */

const Label = ({ children, color = N1 }: { children: string; color?: string }) => (
  <div
    style={{
      display: "flex",
      fontSize: 21,
      fontWeight: 600,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color,
    }}
  >
    {children}
  </div>
);

function BoardRow({
  row,
  best,
  lastLeader,
}: {
  row: ShareCard["rows"][number];
  best: number;
  /** The final row of a shared-win block, which closes it against the next. */
  lastLeader: boolean;
}) {
  const won = row.leader;
  const track = 260;
  const fill = best > 0 ? Math.round((row.correct / best) * track) : 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: ROW_H,
        paddingLeft: 16,
        paddingRight: 16,
        marginLeft: -16,
        marginRight: -16,
        background: won ? INK : "transparent",
        color: won ? INK_ON : INK,
        // Inside a shared win the rule has to be drawn in the inverted colour
        // or two tied members read as one very tall row.
        borderBottom: `2px solid ${won ? (lastLeader ? INK : "rgba(251,251,250,0.28)") : RULE}`,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 56,
          fontFamily: "JetBrains Mono",
          fontWeight: 500,
          fontSize: 30,
          color: won ? "rgba(251,251,250,0.65)" : N2,
        }}
      >
        {row.rank}
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          fontSize: 38,
          fontWeight: won ? 700 : 400,
          letterSpacing: "-0.01em",
          overflow: "hidden",
        }}
      >
        {row.username}
      </div>

      {/* Track is the leader's score, fill is this member's — the same idiom
          the week-by-week bars use in the app. */}
      <div
        style={{
          display: "flex",
          width: track,
          height: 14,
          marginRight: 28,
          background: won ? "rgba(251,251,250,0.22)" : SUNKEN,
        }}
      >
        <div style={{ display: "flex", width: fill, background: won ? INK_ON : INK }} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          width: 128,
          justifyContent: "flex-end",
          fontFamily: "JetBrains Mono",
        }}
      >
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>{row.correct}</div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 500,
            color: won ? "rgba(251,251,250,0.65)" : N2,
          }}
        >
          /{row.decided}
        </div>
      </div>
    </div>
  );
}

function GameCell({ game }: { game: ShareCard["games"][number] }) {
  const awayWon = game.won === "away";
  const homeWon = game.won === "home";

  const side = (won: boolean, color: string) => ({
    display: "flex",
    fontFamily: "JetBrains Mono",
    fontSize: 27,
    fontWeight: won ? (700 as const) : (500 as const),
    color: game.final ? (won ? color : N2) : N1,
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        height: GAME_ROW_H,
        width: GAME_CONTENT_W,
      }}
    >
      <div style={{ ...side(awayWon, game.colorAway), width: GAME_ABBREV_W }}>{game.away}</div>
      <div
        style={{
          display: "flex",
          flex: 1,
          justifyContent: "center",
          fontFamily: "JetBrains Mono",
          fontSize: 27,
          fontWeight: 500,
          color: game.final ? INK : N2,
        }}
      >
        {game.final ? `${game.awayScore}–${game.homeScore}` : game.neutral ? "vs" : "@"}
      </div>
      <div
        style={{
          ...side(homeWon, game.colorHome),
          width: GAME_ABBREV_W,
          justifyContent: "flex-end",
        }}
      >
        {game.home}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- draw */

/**
 * Pure: a card in, a PNG out. No cookies, no params, no database — which is
 * what lets `scripts/share-preview.ts` render the exact production image to a
 * file, instead of the layout being verifiable only through a logged-in
 * browser.
 */
export function renderShareCard(
  card: ShareCard,
  fonts: Awaited<ReturnType<typeof loadFonts>>,
): ImageResponse {
  const { height, gameRows } = measure(card);

  const best = card.rows[0]?.correct ?? 0;
  const cellWidth = Math.floor((WIDTH - PAD * 2) / GAME_COLS);

  // Column-major, so a column reads top to bottom the way the games are listed.
  const columns = Array.from({ length: GAME_COLS }, (_, c) =>
    card.games.slice(c * gameRows, (c + 1) * gameRows),
  );

  const status = card.complete
    ? `Endstand \u00b7 ${card.totalGames} ${card.totalGames === 1 ? "Spiel" : "Spiele"}`
    : card.started
      ? `L\u00e4uft \u00b7 ${card.finalGames}/${card.totalGames} beendet`
      : "Noch nicht angepfiffen";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: WIDTH,
          height,
          background: PAPER,
          color: INK,
          fontFamily: "Inter",
          padding: PAD,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label>Pick&apos;em</Label>
          <Label color={N2}>{`Saison ${card.season}`}</Label>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginTop: 22,
            paddingBottom: 20,
            borderBottom: `4px solid ${INK}`,
          }}
        >
          <div style={{ display: "flex", fontSize: 82, fontWeight: 700, letterSpacing: "-0.03em" }}>
            {card.ref.label}
          </div>
          <div style={{ display: "flex", fontSize: 27, color: N1 }}>{status}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 24 }}>
          {card.rows.map((row, i) => (
            <BoardRow
              key={row.username}
              row={row}
              best={best}
              lastLeader={row.leader && !card.rows[i + 1]?.leader}
            />
          ))}
        </div>

        {card.games.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
            <Label>Ergebnisse</Label>
            <div style={{ display: "flex", marginTop: 16 }}>
              {columns.map((column, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: cellWidth,
                    alignItems: "flex-start",
                  }}
                >
                  {column.map((game) => (
                    <GameCell key={`${game.away}${game.home}`} game={game} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {card.seasonTop.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: "auto",
              paddingTop: 26,
              borderTop: `2px solid ${RULE}`,
            }}
          >
            <Label>Saison</Label>
            <div
              style={{
                display: "flex",
                marginLeft: 24,
                fontFamily: "JetBrains Mono",
                fontSize: 26,
                color: N1,
              }}
            >
              {card.seasonTop.map((s, i) => `${i + 1}. ${s.username} ${s.correct}`).join("   \u00b7   ")}
            </div>
          </div>
        )}
      </div>
    ),
    {
      width: WIDTH,
      height,
      fonts,
      headers: {
        // Members re-open this page during a live week; the picture must not be
        // a minute stale when it is the thing being sent to everyone.
        "Cache-Control": "private, no-store",
      },
    },
  );
}

export { loadFonts };
