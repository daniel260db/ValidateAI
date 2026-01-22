"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      // This reads the token from the URL (hash or query) and stores the session
      const { data, error } = await supabase.auth.getSession();

      // If session exists, you're logged in.
      // If not, you're not logged in (or link invalid/expired)
      if (error) {
        console.error("Callback error:", error.message);
      }

      // IMPORTANT: stop bouncing between callback and login/home.
      // Always end the callback at a single stable page.
      if (data.session) {
        router.replace("/app"); // your "logged in" area (we will create it)
      } else {
        router.replace("/login");
      }
    };

    run();
  }, [router]);

  return (
    <main style={{ padding: 40 }}>
      <p>Logging you in...</p>
    </main>
  );
}