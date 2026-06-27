import React from "react";

export function Card({ children, className = "" }) {
  return (
    <section className={`rounded-md border border-fuel-line bg-white/95 p-4 shadow-soft ${className}`}>
      {children}
    </section>
  );
}
