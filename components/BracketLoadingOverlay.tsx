"use client";

import { useEffect } from "react";
import { useBracketLoading } from "@/components/BracketLoadingProvider";

export default function BracketLoadingOverlay() {
  const { isBracketLoading } = useBracketLoading();

  useEffect(() => {
    if (isBracketLoading) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isBracketLoading]);

  if (!isBracketLoading) return null;

  return (
    <div className="bracket-list__loading-overlay">
      <span className="bracket-list__spinner" />
      <span className="bracket-list__loading-text">Mengacak bagan...</span>
    </div>
  );
}
