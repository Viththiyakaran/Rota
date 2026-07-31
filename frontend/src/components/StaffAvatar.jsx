import React from "react";

export function StaffAvatar({ avatarDataUrl = "", className = "h-10 w-10", name = "Staff", rounded = "rounded-full" }) {
  const initial = String(name || "S").trim().charAt(0).toUpperCase() || "S";

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-fuel-deep font-black text-white shadow-sm ring-1 ring-slate-200 ${rounded} ${className}`}
      aria-label={`${name || "Staff"} profile photo`}
    >
      {avatarDataUrl ? <img src={avatarDataUrl} alt="" className="h-full w-full object-cover" /> : initial}
    </span>
  );
}
