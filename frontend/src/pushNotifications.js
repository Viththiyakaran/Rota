import { api } from "./api.js";

export function canUsePushNotifications() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function enablePushNotifications() {
  if (!canUsePushNotifications()) {
    throw new Error("Push notifications are not supported on this device.");
  }

  if (Notification.permission === "denied") {
    throw new Error("Notifications are blocked in this browser. Allow them in browser settings first.");
  }

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not allowed.");
  }

  const { publicKey, enabled } = await api.pushPublicKey();
  if (!enabled || !publicKey) {
    throw new Error("Push notifications are not ready on the server.");
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  const subscription = existing && subscriptionUsesKey(existing, publicKey)
    ? existing
    : await resubscribe(registration, existing, applicationServerKey);

  await api.subscribePush(subscription.toJSON());
  const testResult = await api.testPush();
  if (testResult?.sent === 0 && testResult?.subscriptions === 0) {
    throw new Error("No device subscription was saved. Please try enabling notifications again.");
  }
  if (testResult?.sent === 0 && testResult?.failed > 0) {
    throw new Error("The test notification could not be delivered. Browser notification permission or device push service may be blocking it.");
  }
  return true;
}

async function resubscribe(registration, existing, applicationServerKey) {
  if (existing) {
    await existing.unsubscribe().catch(() => {});
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function subscriptionUsesKey(subscription, publicKey) {
  const existingKey = subscription.options?.applicationServerKey;
  if (!existingKey) return true;
  return arrayBufferToBase64Url(existingKey) === publicKey;
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
