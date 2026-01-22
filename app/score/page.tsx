"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { APP_NAME } from "../../lib/appConfig";

type ScoreResult = {
  summary: string;
  risks: string[];
  costs_effort: string[];
  complexity: "Low" | "Medium" | "High";
  verdict: string; // should start with BUILD / DON'T BUILD / BUILD ONLY IF
  score_out_of_10: number;
};

function verdictStyle(verdict: string) {
  const v = verdict.toUpperCase();
  if (v.startsWith("DON'T BUILD") || v.startsWith("DONT BUILD")) return { color: "crimson" };
  if (v.startsWith("BUILD ONLY IF")) return { color: "#b26a00" };
  if (v.startsWith("BUILD")) return { color: "green" };
  return { color: "black" };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function ScorePage() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Must be logged in
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) router.replace("/login");
    };
    run();
  }, [router]);

  const scoreIdea = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSavedMsg(null);

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || "Scoring failed");
        setLoading(false);
        return;
      }

      setResult(json.result);
    } catch (e: any) {
      setError(e?.message || "Scoring failed");
    } finally {
      setLoading(false);
    }
  };

  // Save to Supabase history whenever we receive a new result
  useEffect(() => {
    const save = async () => {
      if (!result) return;

      setSaving(true);
      setSavedMsg(null);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        setSaving(false);
        return;
      }

      const { error: insertError } = await supabase.from("idea_scores").insert({
        user_id: user.id,
        idea,
        result,
        score_out_of_10: result.score_out_of_10,
        verdict: result.verdict,
      });

      setSaving(false);

      if (insertError) {
        // Don’t block UX; just show a small hint
        setSavedMsg("Could not save to history (RLS or table missing).");
        return;
      }

      setSavedMsg("Saved to history.");
    };

    save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const scorePercent = useMemo(() => {
    if (!result) return 0;
    return clamp(Math.round((result.score_out_of_10 / 10) * 100), 0, 100);
  }, [result]);

  return (
    <main style={{ padding: 40, maxWidth: 720, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>{APP_NAME}</h1>
      <h2 style={{ fontSize: 32, marginBottom: 16 }}>Score an idea</h2>

      <label style={{ display: "block", marginBottom: 8, opacity: 0.85 }}>
        Describe the idea (what it is, who it’s for, and how you’ll get users):
      </label>

      <textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        rows={6}
        placeholder="Example: A mobile app for..."
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 10,
          border: "1px solid #ddd",
          marginBottom: 12,
        }}
      />

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={scoreIdea}
          disabled={!idea.trim() || loading}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "black",
            color: "white",
            cursor: !idea.trim() || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Scoring..." : "Score"}
        </button>

        <button
          onClick={() => router.push("/history")}
          style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          History
        </button>

        <button
          onClick={() => router.push("/app")}
          style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          Back
        </button>
      </div>

      {error && <p style={{ marginTop: 16, color: "crimson" }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 24, border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <p style={{ margin: 0 }}>
              <b>Score:</b> {result.score_out_of_10}/10 &nbsp; <b>Complexity:</b> {result.complexity}
            </p>
            <p style={{ margin: 0, opacity: 0.75 }}>
              {saving ? "Saving..." : savedMsg ?? ""}
            </p>
          </div>

          {/* Score bar */}
          <div style={{ marginTop: 12, marginBottom: 12 }}>
            <div style={{ height: 10, borderRadius: 999, background: "#eee", overflow: "hidden" }}>
              <div style={{ width: `${scorePercent}%`, height: 10, background: "#111" }} />
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{scorePercent}% signal</div>
          </div>

          <p style={{ marginBottom: 12 }}>
            <b>Summary:</b> {result.summary}
          </p>

          <div style={{ marginBottom: 12 }}>
            <b>Risks</b>
            <ul style={{ marginTop: 6, lineHeight: 1.7 }}>
              {result.risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          <div style={{ marginBottom: 12 }}>
            <b>Costs / Effort</b>
            <ul style={{ marginTop: 6, lineHeight: 1.7 }}>
              {result.costs_effort.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>

          <p style={{ marginBottom: 0 }}>
            <b>Verdict:</b>{" "}
            <span style={{ fontWeight: 700, ...verdictStyle(result.verdict) }}>
              {result.verdict}
            </span>
          </p>
        </div>
      )}
    </main>
  );
}
