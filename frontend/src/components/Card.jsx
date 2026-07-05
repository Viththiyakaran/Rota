import React from "react";

export function Card({ children, className = "" }) {
  return (
    <section className={`rounded-xl border border-fuel-line bg-white p-4 text-fuel-ink shadow-soft sm:p-5 ${className}`}>
      {children}
    </section>
  );
}
