"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const STORAGE_KEY = "canopy.notifications.enabled";
const SW_FILE = "sw.js";

function appBasePath(): string {
  if (typeof window === "undefined") return "";

  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (manifest?.href) {
    try {
      const url = new URL(manifest.href);
      const path = url.pathname.replace(/\/manifest(?:\.webmanifest)?$/, "");
      if (url.origin === window.location.origin && path !== "/") return path.replace(/\/$/, "");
    } catch {
      // Fall back to the pathname heuristic below.
    }
  }

  return window.location.pathname.startsWith("/canopy") ? "/canopy" : "";
}

function serviceWorkerPath(): string {
  return `${appBasePath()}/${SW_FILE}`.replace(/\/{2,}/g, "/");
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer.slice(
    outputArray.byteOffset,
    outputArray.byteOffset + outputArray.byteLength,
  ) as ArrayBuffer;
}

function subscriptionToPayload(sub: PushSubscription) {
  const json = sub.toJSON();
  const keys = json.keys;
  if (!json.endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error("Browser did not return a complete push subscription");
  }
  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    device_name: navigator.userAgent.includes("Mobile") ? "Mobile PWA" : "Desktop browser",
    platform: navigator.platform || "web",
  };
}

async function getRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported in this browser");
  }
  try {
    return await navigator.serviceWorker.register(serviceWorkerPath());
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `Unable to register notification service worker: ${err.message}`
        : "Unable to register notification service worker",
    );
  }
}

async function getExistingSubscription() {
  const registration = await getRegistration();
  return registration.pushManager.getSubscription();
}

export function useNotificationToggle() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canPush =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      window.isSecureContext;
    setSupported(canPush);
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError("Notifications require HTTPS or localhost");
    }
    if (!canPush) {
      setReady(true);
      return;
    }
    setPermission(Notification.permission);
    getExistingSubscription()
      .then((sub) => {
        setEnabled(Notification.permission === "granted" && !!sub && localStorage.getItem(STORAGE_KEY) === "true");
      })
      .catch(() => setEnabled(false))
      .finally(() => setReady(true));
  }, []);

  async function enable() {
    if (!supported || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setError("Notification permission was not granted.");
        return;
      }
      const registration = await getRegistration();
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer((await api.getVapidPublicKey()).public_key),
      });
      await api.subscribeNotifications(subscriptionToPayload(subscription));
      const reminderSettings = await api.getReminderSettings();
      if (!reminderSettings.enabled) {
        await api.setReminderSettings({ ...reminderSettings, enabled: true });
      }
      localStorage.setItem(STORAGE_KEY, "true");
      setEnabled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to enable notifications");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!supported || busy) return;
    setBusy(true);
    setError(null);
    try {
      const existing = await getExistingSubscription();
      if (existing) {
        await api.unsubscribeNotifications(existing.endpoint).catch(() => undefined);
        await existing.unsubscribe().catch(() => false);
      }
      localStorage.setItem(STORAGE_KEY, "false");
      setEnabled(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to disable notifications");
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    if (enabled) {
      void disable();
    } else {
      void enable();
    }
  }

  return { permission, enabled, supported, ready, busy, error, enable, disable, toggle };
}
