import React from "react";

export function Card({ children, className = "" }) {
  return (
    <section className={`rounded-lg border border-fuel-line bg-white/95 p-4 text-fuel-ink shadow-sm sm:p-5 ${className}`}>
      {children}
    </section>
  );
}
