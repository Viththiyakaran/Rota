import React from "react";

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-fuel-line bg-white px-3 py-3 text-base font-semibold outline-none ring-fuel-green/20 transition focus:border-fuel-green focus:ring-4";
