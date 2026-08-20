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
      if (!result.ok) throw new Error("The server rejected the subscription.");
      setStatus("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not turn reminders on.");
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
      setError("Could not turn reminders off.");
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
          Reminders are not available in this browser. The banner on the picks page still
          shows what is open.
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
          To get reminders on iPhone, tap Share then <strong>Add to Home Screen</strong>, and
          open Pick&apos;em from there.
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
          Notifications are blocked for this site. Re-enable them in your browser settings to
          get reminders.
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
        <p className="text-sm">Pick reminders</p>
        <p className="text-meta text-n1">
          {on
            ? "One nudge a day while you still have games open."
            : "Get one nudge a day while you still have games open."}
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
        {busy ? "Working…" : on ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}
