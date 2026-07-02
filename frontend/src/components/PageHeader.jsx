import React from "react";

export function PageHeader({ eyebrow, title, description, action, meta }) {
  return (
    <section className="rounded-lg border border-fuel-line bg-white/95 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-black uppercase tracking-[0.16em] text-fuel-green">{eyebrow}</p>
          )}
          <h2 className="mt-1 truncate text-2xl font-black leading-tight text-fuel-ink sm:text-3xl">{title}</h2>
          {description && <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-600">{description}</p>}
        </div>
        {(action || meta) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {meta}
            {action}
          </div>
        )}
      </div>
    </section>
  );
}

export const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-fuel-green px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-fuel-deep disabled:cursor-not-allowed disabled:opacity-60";

export const darkButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-fuel-ink px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-fuel-deep disabled:cursor-not-allowed disabled:opacity-60";

export const softButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-fuel-mist px-4 py-2.5 text-sm font-black text-fuel-green transition hover:bg-fuel-line disabled:cursor-not-allowed disabled:opacity-60";

export const dangerButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60";

export function Pill({ children, tone = "green" }) {
  const tones = {
    green: "bg-fuel-mist text-fuel-green",
    lime: "bg-fuel-lime text-fuel-ink",
    slate: "bg-slate-100 text-slate-600",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-800"
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${tones[tone] || tones.green}`}>
      {children}
    </span>
  );
}
