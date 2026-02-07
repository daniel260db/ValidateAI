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
  verdict: string;
  score_out_of_10: number;
  iteration_delta?: number | null;
};

function verdictStyle(verdict: string) {
  const v = verdict.toUpperCase();
  if (v.startsWith("DON'T BUILD") || v.startsWith("DONT BUILD")) return { color: "crimson" as const };
  if (v.startsWith("BUILD ONLY IF")) return { color: "#b26a00" as const };
  if (v.startsWith("BUILD")) return { color: "green" as const };
  return { color: "black" as const };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function deltaBadge(delta: number | null | undefined) {
  if (delta === null || delta === undefined) return null;
  if (delta > 0) return { text: `↑ +${delta}`, style: { color: "green" as const } };
  if (delta < 0) return { text: `↓ ${delta}`, style: { color: "crimson" as const } };
  return { text: "→ 0", style: { opacity: 0.75 as const } };
}

const IDEA_TEMPLATE =
  "Use this template for better scores:\n" +
  "- Who (niche):\n" +
  "- Problem (pain + frequency):\n" +
  "- Offer (what you deliver):\n" +
  "- Acquisition (one channel):\n" +
  "- Differentiator (why you):\n" +
  "- Price (rough):\n";

export default function ScorePage() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [previousScore, setPreviousScore] = useState<number | null>(null);

  // Must be logged in
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) router.replace("/login");
    };
    run();
  }, [router]);

  const clearAll = () => {
    setIdea("");
    setResult(null);
    setError(null);
    setSavedMsg(null);
    setPreviousScore(null);
  };

  const fillExample = () => {
    setIdea(
      "Who (niche): UK care homes (small private homes)\n" +
        "Problem: carers spend 60–90 minutes per shift writing daily notes\n" +
        "Offer: record voice → structured compliant notes\n" +
        "Acquisition: direct outreach to care home managers\n" +
        "Differentiator: templates aligned to CQC inspections\n" +
        "Price: £79/month per home\n"
    );
    setResult(null);
    setError(null);
    setSavedMsg(null);
  };

  const scoreIdea = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSavedMsg(null);
    setPreviousScore(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      // Best-effort previous score lookup (for delta)
      let prev: number | null = null;
      try {
        const q = await supabase
          .from("idea_scores")
          .select("score_out_of_10, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!q.error && q.data && q.data.length > 0) {
          const s = q.data[0]?.score_out_of_10;
          if (typeof s === "number" && Number.isFinite(s)) prev = Math.round(s);
        }
      } catch {
        // ignore
      }

      setPreviousScore(prev);

      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          previous_score: prev,
        }),
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
        setSavedMsg("Could not save to history (RLS, table, or columns).");
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

  const delta = useMemo(() => {
    if (!result) return null;
    if (typeof result.iteration_delta === "number" && Number.isFinite(result.iteration_delta)) {
      return result.iteration_delta;
    }
    if (previousScore !== null) return result.score_out_of_10 - previousScore;
    return null;
  }, [result, previousScore]);

  const badge = useMemo(() => deltaBadge(delta), [delta]);

  return (
    <main style={{ padding: 40, maxWidth: 720, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>{APP_NAME}</h1>
      <h2 style={{ fontSize: 32, marginBottom: 16 }}>Score an idea</h2>

      <label style={{ display: "block", marginBottom: 8, opacity: 0.85 }}>
        Describe the idea (who it’s for, the problem, what you deliver, how you’ll get users, and why you win):
      </label>

      <textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        rows={10}
        placeholder={IDEA_TEMPLATE}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 10,
          border: "1px solid #ddd",
          marginBottom: 12,
        }}
      />

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
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
          onClick={clearAll}
          disabled={loading && !!idea.trim()}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            cursor: loading && !!idea.trim() ? "not-allowed" : "pointer",
          }}
          title="Clear the text and reset the result"
        >
          Clear
        </button>

        <button
          onClick={fillExample}
          style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #ddd" }}
          title="Fill an example idea"
        >
          Example
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
              <b>Score:</b> {result.score_out_of_10}/10{" "}
              {badge && (
                <span style={{ marginLeft: 10, fontWeight: 700, ...badge.style }}>{badge.text}</span>
              )}
              &nbsp; <b>Complexity:</b> {result.complexity}
            </p>
            <p style={{ margin: 0, opacity: 0.75 }}>{saving ? "Saving..." : savedMsg ?? ""}</p>
          </div>

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
            <span style={{ fontWeight: 700, ...verdictStyle(result.verdict) }}>{result.verdict}</span>
          </p>
        </div>
      )}
    </main>
  );
}
