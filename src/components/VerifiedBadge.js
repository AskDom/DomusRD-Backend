import React from "react";

export default function VerifiedBadge({ size = "sm" }) {
  if (size === "lg") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700 px-3 py-1 rounded-full text-xs font-bold">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Verificado
      </span>
    );
  }
  return (
    <span
      title="Propiedad verificada por DomusRD"
      className="inline-flex items-center justify-center bg-green-500 text-white w-5 h-5 rounded-full shadow-sm"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </span>
  );
}