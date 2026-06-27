const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Request failed");
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  staff: () => request("/api/staff"),
  createStaff: (payload) => request("/api/staff", { method: "POST", body: JSON.stringify(payload) }),
  updateStaff: (id, payload) => request(`/api/staff/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  week: (startDate) => request(`/api/shifts/week?startDate=${startDate}`),
  createShift: (payload) => request("/api/shifts", { method: "POST", body: JSON.stringify(payload) }),
  updateShift: (id, payload) => request(`/api/shifts/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteShift: (id) => request(`/api/shifts/${id}`, { method: "DELETE" }),
  reminders: () => request("/api/reminders/upcoming")
};
