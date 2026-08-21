import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: { default: "Tippspiel Wedel", template: "%s · Tippspiel Wedel" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Tippspiel", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1917" },
  ],
};

/** Applies the stored theme before first paint so the page never flashes. */
const themeBootstrap = `
try {
  var t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className={`${inter.variable} ${mono.variable}`}>
        {/*
          THESIS: A record book for one group's season, not a betting product. The
          week is a dense ruled ledger; it refuses the card-grid dashboard.
          OWN-WORLD: Near-monochrome paper and ink, hairline rules as the only
          separator, one sans on a fixed 1.2 scale, tracked 11px uppercase labels,
          tabular numerals, square geometry. Team colour is the sole saturated element.
          STORY: A member sees what is still open, picks in seconds on a phone, and
          after kickoff reads the group against itself.
          FIRST VIEWPORT: Week rail across the top, open-picks banner beneath, then
          games grouped by NFL day as full-width two-team rows. The pick is the row.
          FORM: Swiss utility — pinned by the user from three previewed options, so no
          concept roll ran; a brief-pinned direction beats the seed.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the
          finish review, the verdict, DESIGN.md, and every shipping raster carrying
          its provenance
        */}
        {children}
      </body>
    </html>
  );
}
