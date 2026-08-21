"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription } from "@/app/actions/push";
import { BellIcon } from "@/components/icons";

type Status = "checking" | "unsupported" | "needs-install" | "denied" | "off" | "on" | "working";

/** VAPID keys travel as base64url; the Push API wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!publicKey) {
      setStatus("unsupported");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // iOS only exposes the Push API to installed web apps.
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true;
      setStatus(isIos && !standalone ? "needs-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "on" : "off"))
      .catch(() => setStatus("unsupported"));
  }, [publicKey]);

  async function enable() {
    setStatus("working");
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey!) as BufferSource,
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: Record<string, string> };
      const result = await savePushSubscription({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      });
      if (!result.ok) throw new Error("Der Server hat die Anmeldung abgelehnt.");
      setStatus("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erinnerungen konnten nicht aktiviert werden.");
      setStatus("off");
    }
  }

  async function disable() {
    setStatus("working");
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError("Erinnerungen konnten nicht deaktiviert werden.");
      setStatus("on");
    }
  }

  const shell = "flex flex-wrap items-center gap-x-3 gap-y-2 border border-rule px-3 py-2.5";

  if (status === "checking") {
    return (
      <div className={shell}>
        <span className="skeleton h-4 w-40" />
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <div className={shell}>
        <span aria-hidden className="text-n2">
          <BellIcon />
        </span>
        <p className="text-sm text-n1">
          Erinnerungen sind in diesem Browser nicht verfügbar. Das Banner auf der Picks-Seite
          zeigt trotzdem, was noch offen ist.
        </p>
      </div>
    );
  }

  if (status === "needs-install") {
    return (
      <div className={shell}>
        <span aria-hidden className="text-n2">
          <BellIcon />
        </span>
        <p className="text-sm text-n1">
          Für Erinnerungen auf dem iPhone: auf Teilen tippen, dann <strong>Zum Home-Bildschirm</strong>,
          und Tippspiel Wedel von dort öffnen.
        </p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className={shell}>
        <span aria-hidden className="text-n2">
          <BellIcon />
        </span>
        <p className="text-sm text-n1">
          Benachrichtigungen sind für diese Seite blockiert. Aktiviere sie in den
          Browser-Einstellungen wieder, um Erinnerungen zu bekommen.
        </p>
      </div>
    );
  }

  const on = status === "on";
  const busy = status === "working";

  return (
    <div className={shell}>
      <span aria-hidden className={on ? "text-ink" : "text-n2"}>
        <BellIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">Pick-Erinnerungen</p>
        <p className="text-meta text-n1">
          {on
            ? "Ein Hinweis pro Tag, solange du noch offene Spiele hast."
            : "Bekomme einen Hinweis pro Tag, solange du noch offene Spiele hast."}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-meta text-wrong">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={on ? disable : enable}
        disabled={busy}
        className={`btn ${on ? "btn-secondary" : "btn-primary"}`}
      >
        {busy ? "Moment…" : on ? "Ausschalten" : "Einschalten"}
      </button>
    </div>
  );
}
