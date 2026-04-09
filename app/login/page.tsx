"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔥 SABİT EMAIL (DEĞİŞTİRME)
  const email = "info@baudecor.com";

  async function handleLogin() {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert("Şifre yanlış");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6">
        <h1 className="text-2xl font-bold">BAUDECOR Giriş</h1>

        <input
          type="password"
          placeholder="Şifre"
          className="mt-4 w-full rounded-lg bg-slate-800 p-3"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className="mt-4 w-full rounded-lg bg-blue-600 p-3 font-bold"
        >
          {loading ? "Giriş..." : "Giriş Yap"}
        </button>
      </div>
    </main>
  );
}
