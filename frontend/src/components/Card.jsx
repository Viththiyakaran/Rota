import React from "react";

export function Card({ children, className = "" }) {
  return (
    <section className={`rounded-lg border border-fuel-line bg-white/95 p-5 text-fuel-ink shadow-md ${className}`}>
      {children}
    </section>
  );
}
