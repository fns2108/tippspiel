"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DownloadIcon, RefreshIcon, ShareIcon } from "@/components/icons";

type State =
  | { phase: "loading" }
  | { phase: "ready"; url: string; file: File }
  | { phase: "error"; message: string };

/**
 * Fetches the PNG once, then hands the same bytes to the preview and to the
 * share sheet.
 *
 * Fetching up front rather than inside the click handler is deliberate: iOS
 * Safari only honours `navigator.share` while the user activation from the tap
 * is still live, and an `await fetch` in between is long enough to lose it. So
 * the button stays disabled until the file is in hand, and the tap then shares
 * synchronously.
 */
export function ShareImage({
  src,
  filename,
  title,
}: {
  src: string;
  filename: string;
  title: string;
}) {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [note, setNote] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ phase: "loading" });

    (async () => {
      try {
        const res = await fetch(`${src}${src.includes("?") ? "&" : "?"}v=${nonce}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Server antwortete mit ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;

        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
        const url = URL.createObjectURL(blob);
        objectUrl.current = url;
        setState({
          phase: "ready",
          url,
          file: new File([blob], filename, { type: "image/png" }),
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : "Das Bild konnte nicht erzeugt werden.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, filename, nonce]);

  // Only on unmount: the effect above already revokes the previous url when it
  // replaces it, and revoking on every re-run would blank the visible preview.
  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  const download = useCallback((file: File, url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
  }, []);

  async function share() {
    if (state.phase !== "ready") return;
    setNote(null);

    const data = { files: [state.file], title };
    if (navigator.canShare?.(data)) {
      try {
        await navigator.share(data);
      } catch (err) {
        // Dismissing the sheet is an AbortError, not a failure worth reporting.
        if ((err as Error)?.name !== "AbortError") {
          setNote("Teilen hat nicht geklappt — das Bild wurde stattdessen gespeichert.");
          download(state.file, state.url);
        }
      }
      return;
    }

    setNote("Dieser Browser kann Bilder nicht direkt teilen — das Bild wurde gespeichert.");
    download(state.file, state.url);
  }

  async function copy() {
    if (state.phase !== "ready") return;
    setNote(null);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": state.file }),
      ]);
      setNote("In die Zwischenablage kopiert.");
    } catch {
      setNote("Kopieren ging nicht — nutze Speichern.");
    }
  }

  const canCopy =
    typeof window !== "undefined" &&
    typeof ClipboardItem !== "undefined" &&
    Boolean(navigator.clipboard?.write);

  return (
    <div className="max-w-[34rem] space-y-4">
      <div className="border border-rule bg-panel p-2">
        {state.phase === "loading" && (
          <div className="skeleton aspect-[4/5] w-full" role="status" aria-label="Bild wird erzeugt" />
        )}
        {state.phase === "error" && (
          <p role="alert" className="px-3 py-8 text-center text-sm text-wrong">
            {state.message}
          </p>
        )}
        {state.phase === "ready" && (
          // eslint-disable-next-line @next/next/no-img-element -- a blob url, already fetched
          <img
            src={state.url}
            alt={title}
            className="block w-full"
            style={{ imageRendering: "auto" }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={share}
          disabled={state.phase !== "ready"}
          className="btn btn-primary"
        >
          <ShareIcon />
          Teilen
        </button>
        <button
          type="button"
          onClick={() => state.phase === "ready" && download(state.file, state.url)}
          disabled={state.phase !== "ready"}
          className="btn btn-secondary"
        >
          <DownloadIcon />
          Speichern
        </button>
        {canCopy && (
          <button
            type="button"
            onClick={copy}
            disabled={state.phase !== "ready"}
            className="btn btn-secondary"
          >
            Kopieren
          </button>
        )}
        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          disabled={state.phase === "loading"}
          title="Bild mit dem aktuellen Stand neu erzeugen"
          className="btn btn-secondary ml-auto"
        >
          <RefreshIcon />
          Neu laden
        </button>
      </div>

      {note && (
        <p role="status" className="text-meta text-n1">
          {note}
        </p>
      )}
    </div>
  );
}
