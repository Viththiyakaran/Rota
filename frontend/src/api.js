const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:5000" : "");

let authToken = "";

export function setAuthToken(token) {
  authToken = token || "";
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.error || "Request failed";
    if (message === "Please change your temporary password before using the rota.") {
      window.dispatchEvent(new CustomEvent("fuelops:password-change-required"));
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  login: (payload) => request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/api/auth/me"),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  changePassword: (payload) => request("/api/auth/change-password", { method: "POST", body: JSON.stringify(payload) }),
  branding: () => request("/api/settings/branding"),
  updateBranding: (payload) => request("/api/settings/branding", { method: "PUT", body: JSON.stringify(payload) }),
  openingHours: () => request("/api/settings/opening-hours"),
  updateOpeningHours: (payload) => request("/api/settings/opening-hours", { method: "PUT", body: JSON.stringify(payload) }),
  ukRotaRules: () => request("/api/settings/uk-rules"),
  updateUkRotaRules: (payload) => request("/api/settings/uk-rules", { method: "PUT", body: JSON.stringify(payload) }),
  users: () => request("/api/users"),
  createUser: (payload) => request("/api/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (id, payload) => request(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  resetPassword: (id, payload) => request(`/api/users/${id}/reset-password`, { method: "POST", body: JSON.stringify(payload) }),
  availability: (staffId) => request(`/api/availability${staffId ? `?staffId=${staffId}` : ""}`),
  createAvailability: (payload) => request("/api/availability", { method: "POST", body: JSON.stringify(payload) }),
  deleteAvailability: (id) => request(`/api/availability/${id}`, { method: "DELETE" }),
  timeOff: () => request("/api/time-off"),
  createTimeOff: (payload) => request("/api/time-off", { method: "POST", body: JSON.stringify(payload) }),
  updateTimeOff: (id, payload) => request(`/api/time-off/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  tasks: () => request("/api/tasks"),
  createTask: (payload) => request("/api/tasks", { method: "POST", body: JSON.stringify(payload) }),
  updateTask: (id, payload) => request(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: "DELETE" }),
  audit: () => request("/api/audit"),
  staff: () => request("/api/staff"),
  createStaff: (payload) => request("/api/staff", { method: "POST", body: JSON.stringify(payload) }),
  updateStaff: (id, payload) => request(`/api/staff/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  week: (startDate) => request(`/api/shifts/week?startDate=${startDate}`),
  myShifts: () => request("/api/shifts/my"),
  copyWeek: (payload) => request("/api/shifts/copy-week", { method: "POST", body: JSON.stringify(payload) }),
  generateRotaPattern: (payload) => request("/api/rota-patterns/generate", { method: "POST", body: JSON.stringify(payload) }),
  createShift: (payload) => request("/api/shifts", { method: "POST", body: JSON.stringify(payload) }),
  updateShift: (id, payload) => request(`/api/shifts/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteShift: (id) => request(`/api/shifts/${id}`, { method: "DELETE" }),
  notifications: () => request("/api/notifications"),
  readNotifications: () => request("/api/notifications/read-all", { method: "POST" }),
  reminders: () => request("/api/reminders/upcoming"),
  pushPublicKey: () => request("/api/push/public-key"),
  pushStatus: () => request("/api/push/status"),
  subscribePush: (payload) => request("/api/push/subscribe", { method: "POST", body: JSON.stringify(payload) }),
  testPush: () => request("/api/push/test", { method: "POST" }),
  calendarFeed: () => request("/api/calendar/my-feed"),
  seedDemoData: (payload = { count: 20 }) => request("/api/demo/seed", { method: "POST", body: JSON.stringify(payload) })
};
