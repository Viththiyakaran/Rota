import React from "react";

export function Status({ loading, error, empty, children }) {
  if (loading) return <p className="rounded-md bg-white p-4 text-slate-600">Loading...</p>;
  if (error) return <p className="rounded-md bg-red-50 p-4 font-bold text-red-700">{error}</p>;
  if (empty) return <p className="rounded-md bg-white p-4 text-slate-600">Nothing to show yet.</p>;
  return children;
}
