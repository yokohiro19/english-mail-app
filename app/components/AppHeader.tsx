"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/src/lib/firebase";

type Props = {
  variant?: "app" | "auth";
};

export default function AppHeader({ variant = "app" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOut(auth);
    router.push("/login");
  };

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  if (variant === "auth") {
    const isLogin = pathname === "/login";
    return (
      <header className="auth-header">
        <div className="auth-header-inner">
          <a href="/" className="app-header-logo">
            <img src="/images/logo.png" alt="TapSmart English" />
          </a>
          <a href={isLogin ? "/signup" : "/login"} className="auth-header-link">
            {isLogin ? "アカウント作成" : "ログイン"}
          </a>
        </div>
      </header>
    );
  }

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <a href="/" className="app-header-logo">
          <img src="/images/logo.png" alt="TapSmart English" />
        </a>
        <nav className="app-header-nav">
          <a href="/journey" className={pathname === "/journey" ? "active" : ""}>
            日々の歩み
          </a>
          <a href="/routine" className={pathname === "/routine" ? "active" : ""}>
            学習プラン
          </a>
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="nav-hamburger"
              aria-label="メニュー"
            >
              <span /><span /><span />
            </button>
            {menuOpen && (
              <div className="nav-dropdown">
                <a href="/account" onClick={() => setMenuOpen(false)}>アカウント管理</a>
                <a href="/billing" onClick={() => setMenuOpen(false)}>プランの確認・解約</a>
                <button onClick={handleLogout}>ログアウト</button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
