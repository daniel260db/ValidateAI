"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { APP_NAME } from "../../lib/appConfig";

type Row = {
  id: string;
  idea: string;
  verdict: string;
  score_out_of_10: number;
  created_at: string;
  result: any;
};

function verdictStyle(verdict: string) {
  const v = verdict.toUpperCase();
  if (v.startsWith("DON'T BUILD") || v.startsWith("DONT BUILD")) return { color: "crimson" };
  if (v.startsWith("BUILD ONLY IF")) return { color: "#b26a00" };
  if (v.startsWith("BUILD")) return { color: "green" };
  return { color: "black" };
}

function daysLeft(trialEndIso?: string | null) {
  if (!trialEndIso) return null;
  const end = new Date(trialEndIso).getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function HistoryPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      // Ensure profile row exists (trial_end may be null until you wire Stripe webhook later)
      await supabase.from("profiles").upsert({ user_id: user.id }, { onConflict: "user_id" });

      const [{ data: profile }, { data: scores, error: scoresErr }] = await Promise.all([
        supabase.from("profiles").select("trial_end").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("idea_scores")
          .select("id, idea, verdict, score_out_of_10, created_at, result")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (scoresErr) {
        console.error(scoresErr);
      }

      setTrialEnd(profile?.trial_end ?? null);
      setRows((scores as Row[]) ?? []);
      setLoading(false);
    };

    run();
  }, [router]);

  const trialDays = useMemo(() => daysLeft(trialEnd), [trialEnd]);

  return (
    <main style={{ padding: 40, maxWidth: 900, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>{APP_NAME}</h1>
      <h2 style={{ fontSize: 32, marginBottom: 8 }}>History</h2>

      {/* Trial banner (shows only if trial_end is present) */}
      {trialDays !== null && trialDays > 0 && (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <b>Trial:</b> {trialDays} day{trialDays === 1 ? "" : "s"} left.
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        <button
          onClick={() => router.push("/score")}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          New score
        </button>
        <button
          onClick={() => router.push("/app")}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          Back to app
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ opacity: 0.8 }}>No history yet. Score an idea and it will appear here.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <b style={{ fontSize: 16 }}>Score:</b> {r.score_out_of_10}/10{" "}
                  <span style={{ marginLeft: 10, fontWeight: 700, ...verdictStyle(r.verdict) }}>
                    {r.verdict}
                  </span>
                </div>
                <div style={{ opacity: 0.75, fontSize: 13 }}>
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>

              <p style={{ marginTop: 10, marginBottom: 0, opacity: 0.9 }}>
                {r.idea.length > 220 ? r.idea.slice(0, 220) + "…" : r.idea}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
