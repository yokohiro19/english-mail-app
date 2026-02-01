"use client";

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
  deleteUser,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../src/lib/firebase";
import { useRouter } from "next/navigation";
import "../app.css";
import AppHeader from "../components/AppHeader";

function firebaseErrorJa(err: any): string {
  const code = typeof err?.code === "string" ? err.code : "";
  switch (code) {
    case "auth/wrong-password": return "現在のパスワードが正しくありません。";
    case "auth/invalid-credential": return "現在のパスワードが正しくありません。";
    case "auth/weak-password": return "新しいパスワードが短すぎます。6文字以上にしてください。";
    case "auth/email-already-in-use": return "このメールアドレスは既に使用されています。";
    case "auth/invalid-email": return "メールアドレスの形式が正しくありません。";
    case "auth/too-many-requests": return "リクエストが多すぎます。しばらくしてから再度お試しください。";
    case "auth/requires-recent-login": return "セキュリティのため再ログインが必要です。一度ログアウトしてから再度お試しください。";
    default: return "エラーが発生しました。";
  }
}

export default function AccountPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  // Nickname
  const [nickname, setNickname] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameMsg, setNicknameMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Email
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Delete
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
      if (!u) router.replace("/login");
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setNickname(data.nickname ?? "");
      }
      setLoadingData(false);
    };
    load().catch(() => setLoadingData(false));
  }, [user]);

  const displayName = nickname || user?.email || "";

  // Save nickname
  const saveNickname = async () => {
    if (!user) return;
    setNicknameSaving(true);
    setNicknameMsg(null);
    try {
      const ref = doc(db, "users", user.uid);
      await setDoc(ref, { nickname, updatedAt: serverTimestamp() }, { merge: true });
      setNicknameMsg({ text: "保存しました", type: "success" });
    } catch {
      setNicknameMsg({ text: "保存に失敗しました。", type: "error" });
    } finally {
      setNicknameSaving(false);
    }
  };

  // Change email
  const changeEmail = async () => {
    if (!user || !user.email) return;
    if (!newEmail || !emailPassword) return;
    setEmailLoading(true);
    setEmailMsg(null);
    try {
      const credential = EmailAuthProvider.credential(user.email, emailPassword);
      await reauthenticateWithCredential(user, credential);
      await verifyBeforeUpdateEmail(user, newEmail);
      setEmailMsg({ text: "確認メールを送信しました。新しいメールアドレスの受信トレイを確認してください。", type: "success" });
      setNewEmail("");
      setEmailPassword("");
    } catch (err: any) {
      setEmailMsg({ text: firebaseErrorJa(err), type: "error" });
    } finally {
      setEmailLoading(false);
    }
  };

  // Change password
  const changePassword = async () => {
    if (!user || !user.email) return;
    if (!currentPassword || !newPassword) return;
    if (newPassword !== newPasswordConfirm) {
      setPasswordMsg({ text: "新しいパスワードが一致しません。", type: "error" });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ text: "新しいパスワードは6文字以上にしてください。", type: "error" });
      return;
    }
    setPasswordLoading(true);
    setPasswordMsg(null);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setPasswordMsg({ text: "パスワードを変更しました。", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (err: any) {
      setPasswordMsg({ text: firebaseErrorJa(err), type: "error" });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Delete account
  const doDeleteAccount = async () => {
    if (!user || !user.email) return;
    if (!deletePassword) return;
    setDeleteLoading(true);
    setDeleteMsg(null);
    try {
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);
      await deleteUser(user);
      router.replace("/login");
    } catch (err: any) {
      setDeleteMsg({ text: firebaseErrorJa(err), type: "error" });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loadingAuth || loadingData) {
    return (
      <div className="app-page">
        <AppHeader />
        <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)" }}>
          <p style={{ color: "#6B7280" }}>Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-page">
      <AppHeader />
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Page title */}
          <div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 4 }}>アカウント</h1>
            <p style={{ fontSize: 14, color: "#6B7280" }}>{displayName}様</p>
          </div>

          {/* Nickname */}
          <div className="app-card">
            <h2 className="section-title">ニックネーム</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="app-input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="ニックネームを入力"
                style={{ flex: 1 }}
              />
              <button onClick={saveNickname} disabled={nicknameSaving} className="app-btn-primary" style={{ padding: "10px 24px", whiteSpace: "nowrap" }}>
                {nicknameSaving ? "保存中..." : "保存"}
              </button>
            </div>
            {nicknameMsg && (
              <div className={nicknameMsg.type === "success" ? "app-success" : "app-error"} style={{ marginTop: 12, padding: "8px 16px" }}>
                {nicknameMsg.text}
              </div>
            )}
          </div>

          {/* Email change */}
          <div className="app-card">
            <h2 className="section-title">メールアドレスの変更</h2>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>現在: {user?.email}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="form-label">新しいメールアドレス</label>
                <input className="app-input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
              <div>
                <label className="form-label">現在のパスワード（確認用）</label>
                <input className="app-input" type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} />
              </div>
              <div>
                <button onClick={changeEmail} disabled={emailLoading || !newEmail || !emailPassword} className="app-btn-primary" style={{ padding: "10px 24px" }}>
                  {emailLoading ? "処理中..." : "変更する"}
                </button>
              </div>
            </div>
            <p className="form-helper" style={{ marginTop: 8 }}>変更後、新しいメールアドレスに確認メールが届きます</p>
            {emailMsg && (
              <div className={emailMsg.type === "success" ? "app-success" : "app-error"} style={{ marginTop: 12, padding: "8px 16px" }}>
                {emailMsg.text}
              </div>
            )}
          </div>

          {/* Password change */}
          <div className="app-card">
            <h2 className="section-title">パスワードの変更</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="form-label">現在のパスワード</label>
                <input className="app-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div>
                <label className="form-label">新しいパスワード</label>
                <input className="app-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} />
                <p className="form-helper">6文字以上</p>
              </div>
              <div>
                <label className="form-label">新しいパスワード（確認）</label>
                <input className="app-input" type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} />
              </div>
              <div>
                <button onClick={changePassword} disabled={passwordLoading || !currentPassword || !newPassword || !newPasswordConfirm} className="app-btn-primary" style={{ padding: "10px 24px" }}>
                  {passwordLoading ? "処理中..." : "変更する"}
                </button>
              </div>
            </div>
            {passwordMsg && (
              <div className={passwordMsg.type === "success" ? "app-success" : "app-error"} style={{ marginTop: 12, padding: "8px 16px" }}>
                {passwordMsg.text}
              </div>
            )}
          </div>

          {/* Delete account */}
          <div className="app-card" style={{ borderColor: "#FECACA" }}>
            <h2 className="section-title" style={{ color: "#991B1B" }}>アカウントの削除</h2>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 16 }}>
              アカウントを削除すると、すべてのデータが失われます。この操作は取り消せません。
            </p>

            {!deleteConfirm ? (
              <button onClick={() => setDeleteConfirm(true)} className="app-btn-secondary" style={{ borderColor: "#FECACA", color: "#991B1B" }}>
                アカウントを削除する
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="form-label">パスワードを入力して確認</label>
                  <input className="app-input" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={doDeleteAccount}
                    disabled={deleteLoading || !deletePassword}
                    style={{
                      background: "#DC2626", color: "#fff", fontWeight: 600,
                      padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
                      fontSize: 14, fontFamily: "'Inter', sans-serif", opacity: deleteLoading || !deletePassword ? 0.5 : 1,
                    }}
                  >
                    {deleteLoading ? "処理中..." : "削除を実行"}
                  </button>
                  <button onClick={() => { setDeleteConfirm(false); setDeletePassword(""); setDeleteMsg(null); }} className="app-btn-secondary" style={{ padding: "10px 24px" }}>
                    キャンセル
                  </button>
                </div>
              </div>
            )}
            {deleteMsg && (
              <div className="app-error" style={{ marginTop: 12, padding: "8px 16px" }}>
                {deleteMsg.text}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
