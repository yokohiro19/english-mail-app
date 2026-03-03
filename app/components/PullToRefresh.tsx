"use client";

import { useEffect, useRef, useState } from "react";

const THRESHOLD = 72; // px pulled to trigger reload

export default function PullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);

  useEffect(() => {
    // iOSのPWAスタンドアロンモードのみ有効
    const isStandalone =
      ("standalone" in window.navigator && (window.navigator as any).standalone === true) ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (!isStandalone) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startYRef.current = e.touches[0].clientY;
        pullingRef.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || startYRef.current === null) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta > 0) {
        setPullDistance(Math.min(delta * 0.5, THRESHOLD + 20));
      } else {
        pullingRef.current = false;
        setPullDistance(0);
      }
    };

    const onTouchEnd = () => {
      if (pullDistance >= THRESHOLD) {
        window.location.reload();
      }
      pullingRef.current = false;
      startYRef.current = null;
      setPullDistance(0);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullDistance]);

  if (pullDistance === 0) return null;

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const ready = pullDistance >= THRESHOLD;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        paddingTop: `${pullDistance - 36}px`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: progress,
          transform: `rotate(${progress * 360}deg)`,
          transition: ready ? "none" : "opacity 0.1s",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ready ? "#0ea5e9" : "#94a3b8"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      </div>
    </div>
  );
}
