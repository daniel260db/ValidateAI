"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { APP_NAME } from "../../lib/appConfig";

type Plan = "monthly" | "yearly";

export default function PricingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);

  // Must be logged in to view pricing
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) router.replace("/login");
    };
    run();
  }, [router]);

  const startCheckout = async (plan: Plan) => {
    setLoadingPlan(plan);

    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      setLoadingPlan(null);
      router.replace("/login");
      return;
    }

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, plan }),
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json?.error || "Checkout failed");
      setLoadingPlan(null);
      return;
    }

    window.location.href = json.url;
  };

  return (
    <main style={{ padding: 40, maxWidth: 720, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>{APP_NAME}</h1>
      <h2 style={{ fontSize: 32, marginBottom: 8 }}>Pricing</h2>
      <p style={{ opacity: 0.8, marginBottom: 24 }}>
        Choose monthly, or save with yearly.
      </p>

      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        {/* Monthly */}
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Monthly</div>
            <div style={{ fontSize: 18 }}>£9.99 / month</div>
          </div>

          <p style={{ opacity: 0.8, marginTop: 8, marginBottom: 12 }}>
            Pay monthly. Cancel anytime.
          </p>

          <button
            onClick={() => startCheckout("monthly")}
            disabled={loadingPlan !== null}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "black",
              color: "white",
              cursor: loadingPlan ? "not-allowed" : "pointer",
            }}
          >
            {loadingPlan === "monthly" ? "Redirecting..." : "Subscribe monthly"}
          </button>
        </div>

        {/* Yearly */}
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Yearly (deal)</div>
            <div style={{ fontSize: 18 }}>£99 / year</div>
          </div>

          <p style={{ opacity: 0.8, marginTop: 8, marginBottom: 12 }}>
            Save vs monthly. Best value.
          </p>

          <button
            onClick={() => startCheckout("yearly")}
            disabled={loadingPlan !== null}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "black",
              color: "white",
              cursor: loadingPlan ? "not-allowed" : "pointer",
            }}
          >
            {loadingPlan === "yearly" ? "Redirecting..." : "Subscribe yearly"}
          </button>
        </div>
      </div>

      <button
        onClick={() => router.push("/app")}
        style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
      >
        Back to app
      </button>
    </main>
  );
}
