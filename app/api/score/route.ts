import { NextRequest } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type ScoreResult = {
  score_out_of_10: number;
  complexity: "Low" | "Medium" | "High";
  summary: string;
  risks: string[];
  costs_effort: string[];
  verdict: string;
  iteration_delta: number | null;
};

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function pickComplexity(v: unknown): "Low" | "Medium" | "High" {
  if (v === "Low" || v === "Medium" || v === "High") return v;
  return "Medium";
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function toStringSafe(v: unknown): string {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const idea = toStringSafe(body?.idea);
    const previous_score_raw = body?.previous_score;
    const previous_score =
      typeof previous_score_raw === "number" && Number.isFinite(previous_score_raw)
        ? Math.max(1, Math.min(10, Math.round(previous_score_raw)))
        : null;

    if (!idea) {
      return Response.json({ error: "Missing idea" }, { status: 400 });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You are ValidateAI, an idea validation engine for early-stage business ideas.\n\n" +
            "Tone rules:\n" +
            "- Be direct, calm, and constructive.\n" +
            "- Avoid harsh, mocking, or dismissive language.\n" +
            "- Focus on clarity, decision-making, and actionable next steps.\n" +
            "- Use British English.\n" +
            "- Assume an MVP can be built by a solo developer using hosted AI APIs unless stated otherwise.\n\n" +
            "Hard output rules:\n" +
            "- Return ONLY valid JSON that matches the schema.\n" +
            "- Verdict MUST start with exactly one label: BUILD, DON'T BUILD, or BUILD ONLY IF.\n" +
            "- If the label is DON'T BUILD, immediately include one sentence starting with: Primary blocker: (one short sentence).\n" +
            "- Verdict MUST include the exact heading: Next steps:\n" +
            "- Next steps MUST list exactly 3 actions, formatted as:\n" +
            "  1) ...\n" +
            "  2) ...\n" +
            "  3) ...\n" +
            "- Next steps must be realistically achievable within 7 days.\n\n" +
            "Scoring rubric (integer 1–10):\n" +
            "1–2: Fundamentally broken; no identifiable problem or user.\n" +
            "3–4: Weak and undefined; major gaps in demand, audience, or differentiation.\n" +
            "5: Some signal, but too many unknowns to proceed without validation.\n" +
            "6–7: Viable with a focused niche and clear execution path.\n" +
            "8–9: Strong signal with evidence of demand and differentiation.\n" +
            "10: Rare, exceptional opportunity with clear pull from the market.\n\n" +
            "Scoring guardrails (prevents fake 7/10s):\n" +
            "- If the idea is generic and missing (a) a clear niche, (b) a realistic acquisition channel, and (c) a specific differentiator, cap the score at 5.\n" +
            "- Only give 6+ if the user provides at least one concrete signal (existing audience, waitlist, pre-sales, LOIs, interview findings, or a proven channel).\n" +
            "- Only give 8+ with strong evidence of demand + differentiation.\n\n" +
            "Important constraints:\n" +
            "- Risks must be specific and actionable.\n" +
            "- Costs / Effort must be realistic and proportional to an MVP.\n" +
            "- Do NOT invent large teams, custom AI models, or extreme budgets unless explicitly stated.\n",
        },
        {
          role: "user",
          content:
            "Idea:\n" +
            idea +
            "\n\n" +
            "Return JSON fields:\n" +
            "- summary: 1–2 sentences\n" +
            "- risks: 3–8 items (each should include what must be proven)\n" +
            "- costs_effort: 2–6 items\n" +
            '- complexity: "Low" | "Medium" | "High"\n' +
            "- verdict: label + (if DON'T BUILD include 'Primary blocker: ...') + 'Next steps:' + 3 numbered actions\n" +
            "- score_out_of_10: integer 1–10\n",
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "idea_score",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              score_out_of_10: { type: "integer", minimum: 1, maximum: 10 },
              complexity: { type: "string", enum: ["Low", "Medium", "High"] },
              summary: { type: "string" },
              risks: { type: "array", items: { type: "string" } },
              costs_effort: { type: "array", items: { type: "string" } },
              verdict: { type: "string" },
            },
            required: ["score_out_of_10", "complexity", "summary", "risks", "costs_effort", "verdict"],
          },
        },
      },
    });

    // The SDK types can be inconsistent across versions; treat output as unknown.
    const rawText: unknown = (response as any)?.output_text;

    if (typeof rawText !== "string" || !rawText.trim()) {
      return Response.json({ error: "AI returned empty output" }, { status: 500 });
    }

    let parsedUnknown: unknown;
    try {
      parsedUnknown = JSON.parse(rawText);
    } catch {
      return Response.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    if (!parsedUnknown || typeof parsedUnknown !== "object") {
      return Response.json({ error: "AI returned invalid structured output" }, { status: 500 });
    }

    const parsed = parsedUnknown as any;

    const result: ScoreResult = {
      score_out_of_10: clampInt(parsed.score_out_of_10, 1, 10, 5),
      complexity: pickComplexity(parsed.complexity),
      summary: toStringSafe(parsed.summary),
      risks: toStringArray(parsed.risks),
      costs_effort: toStringArray(parsed.costs_effort),
      verdict: toStringSafe(parsed.verdict),
      iteration_delta: null,
    };

    if (!result.summary || !result.verdict) {
      return Response.json({ error: "AI returned incomplete structured output" }, { status: 500 });
    }

    if (previous_score !== null) {
      result.iteration_delta = result.score_out_of_10 - previous_score;
    }

    return Response.json({ result });
  } catch (err: any) {
    return Response.json({ error: err?.message || "Score failed" }, { status: 500 });
  }
}
