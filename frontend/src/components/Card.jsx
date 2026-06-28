import React from "react";
import { Card as MaterialCard, CardBody } from "@material-tailwind/react";

export function Card({ children, className = "" }) {
  return (
    <MaterialCard
      shadow={false}
      className={`rounded-md border border-fuel-line bg-white/95 shadow-soft ${className}`}
    >
      <CardBody className="p-4 text-fuel-ink">{children}</CardBody>
    </MaterialCard>
  );
}
