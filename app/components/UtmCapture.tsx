"use client";

import { useEffect } from "react";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ad_id"] as const;
const STORAGE_KEY = "utm_data";

export default function UtmCapture() {
  useEffect(() => {
    try {
      // 既に保存済みなら上書きしない（最初の流入元を保持）
      if (localStorage.getItem(STORAGE_KEY)) return;

      const params = new URLSearchParams(window.location.search);
      const data: Record<string, string> = {};
      let hasAny = false;
      for (const key of UTM_KEYS) {
        const val = params.get(key);
        if (val) {
          data[key] = val;
          hasAny = true;
        }
      }
      if (hasAny) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch {}
  }, []);

  return null;
}
