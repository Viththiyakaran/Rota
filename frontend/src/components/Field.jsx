import React from "react";

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-fuel-line bg-white px-3 py-3 text-base font-semibold text-fuel-ink outline-none ring-fuel-green/15 transition placeholder:text-slate-400 focus:border-fuel-green focus:ring-4";
