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
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });

  await api.subscribePush(subscription.toJSON());
  await api.testPush();
  return true;
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
