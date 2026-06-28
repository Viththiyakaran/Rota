import React from "react";
import { Card as MaterialCard, CardBody } from "@material-tailwind/react";

export function Card({ children, className = "" }) {
  return (
    <MaterialCard
      shadow
      className={`rounded-lg border border-fuel-line bg-white/95 shadow-md ${className}`}
    >
      <CardBody className="p-5 text-fuel-ink">{children}</CardBody>
    </MaterialCard>
  );
}
