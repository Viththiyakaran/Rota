import React from "react";

export function Status({ loading, error, empty, children }) {
  if (loading) return <p className="rounded-lg border border-fuel-line bg-white p-4 text-sm font-bold text-slate-600 shadow-sm">Loading...</p>;
  if (error) return <p className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700 shadow-sm">{error}</p>;
  if (empty) return <p className="rounded-lg border border-fuel-line bg-white p-4 text-sm font-bold text-slate-600 shadow-sm">Nothing to show yet.</p>;
  return children;
}
