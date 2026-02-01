"use client";

import { useRouter, usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/src/lib/firebase";

type Props = {
  variant?: "app" | "auth";
};

export default function AppHeader({ variant = "app" }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

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
          <a href="/dashboard" className={pathname === "/dashboard" ? "active" : ""}>
            Dashboard
          </a>
          <a href="/settings" className={pathname === "/settings" ? "active" : ""}>
            Settings
          </a>
          <button onClick={handleLogout} className="nav-logout">
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
