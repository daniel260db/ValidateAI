"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { APP_NAME } from "../../lib/appConfig";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signup" | "login">("signup");

  // If already logged in, go straight to /app
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) router.replace("/app");
    };
    run();
  }, [router]);

  const sendMagicLink = async () => {
    setLoading(true);
    setSent(false);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setSent(true);
  };

  return (
    <main
      style={{
        padding: 40,
        maxWidth: 720,
        margin: "0 auto",
        fontFamily: "system-ui",
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>{APP_NAME}</h1>

      <p style={{ opacity: 0.7, marginBottom: 24 }}>
        {mode === "signup" ? "Create your account" : "Log in"}
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setMode("signup")}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: mode === "signup" ? "black" : "white",
            color: mode === "signup" ? "white" : "black",
          }}
        >
          Sign up
        </button>

        <button
          onClick={() => setMode("login")}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: mode === "login" ? "black" : "white",
            color: mode === "login" ? "white" : "black",
          }}
        >
          Log in
        </button>
      </div>

      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        {mode === "signup"
          ? "Enter your email and we’ll send a magic link. First login creates your account."
          : "Enter your email and we’ll send a magic link to log you in."}
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            width: 320,
          }}
        />

        <button
          onClick={sendMagicLink}
          disabled={!email || loading}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "black",
            color: "white",
            cursor: !email || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Sending..." : "Send magic link"}
        </button>
      </div>

      {sent && (
        <p style={{ marginTop: 16 }}>
          ✅ Check your email. Open the link on the <b>same browser</b> you’re using now.
        </p>
      )}
    </main>
  );
}
