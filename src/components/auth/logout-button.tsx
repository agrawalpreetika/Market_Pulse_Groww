"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export function LogoutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function logout() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await signOut({
        redirectTo: "/login",
      });
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={isSigningOut}
      className="text-xs text-slate-400 underline underline-offset-4 hover:text-cyan-300 disabled:opacity-50"
    >
      {isSigningOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
