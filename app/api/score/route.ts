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
  iteration_delta: number | null; // ↑ / ↓ compared to previous_score (if provided)
};

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normaliseComplexity(v: unknown): "Low" | "Medium" | "High" {
  if (v === "Low" || v === "Medium" || v === "High") return v;
  return "Medium";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const idea = (body?.idea ?? "").toString().trim();

    // Optional: pass previous_score from the client to compute iteration delta
    const previousScoreRaw = body?.previous_score;
    const previous_score =
      typeof previousScoreRaw === "number" && Number.isFinite(previousScoreRaw)
        ? clampInt(previousScoreRaw, 1, 10)
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
            "- Avoid harsh or mocking language.\n" +
            "- Focus on clarity, decision-making, and actionable next steps.\n" +
            "- Use British English.\n" +
            "- Assume an MVP can be built by a solo developer using hosted AI APIs unless stated otherwise.\n\n" +
            "Hard output rules:\n" +
            "- Output MUST be structured into sections: Summary, Risks, Costs / Effort, Verdict.\n" +
            "- Verdict MUST start with exactly one label: BUILD, DON'T BUILD, or BUILD ONLY IF.\n" +
            "- When the verdict is DON'T BUILD, explicitly state the single biggest blocker in ONE short sentence immediately after the label.\n" +
            "- Verdict MUST include the exact heading: Next steps:\n" +
            "- Next steps MUST contain exactly 3 concrete actions.\n" +
            "- Next steps must be realistically achievable within 7 days.\n\n" +
            "Scoring rubric (integer 1–10):\n" +
            "1–2: Fundamentally broken; no identifiable problem or user.\n" +
            "3–4: Weak and undefined; major gaps in demand, audience, or differentiation.\n" +
            "5: Some signal, but too many unknowns to proceed without validation.\n" +
            "6–7: Viable with a focused niche and clear execution path.\n" +
            "8–9: Strong signal with evidence of demand and differentiation.\n" +
            "10: Rare, exceptional opportunity with clear pull from the market.\n\n" +
            "Scoring consistency rules:\n" +
            "- Use 3–5 conservatively.\n" +
            "- Do NOT jump scores unless the idea meaningfully changes.\n" +
            "- Similar ideas should score within ±1 point.\n\n" +
            "Important constraints:\n" +
            "- Risks must be specific and actionable.\n" +
            "- Costs / Effort must be realistic and proportional to an MVP.\n" +
            "- Do NOT invent large teams, custom AI models, or extreme budgets unless explicitly stated.\n",
        },
        { role: "user", content: idea },
      ],

      // Structured output uses text.format (Responses API)
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
            required: [
              "score_out_of_10",
              "complexity",
              "summary",
              "risks",
              "costs_effort",
              "verdict",
            ],
          },
        },
      },
    });

    const raw = (response as any)?.output_text;
    if (!raw || typeof raw !== "string") {
      return Response.json(
        { error: "AI returned no output_text" },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json(
        { error: "AI returned invalid JSON" },
        { status: 500 }
      );
    }

    // Build a safe result object (prevents TS 'never' issues and guards shape)
    const result: ScoreResult = {
      score_out_of_10: clampInt(Number(parsed?.score_out_of_10 ?? 5), 1, 10),
      complexity: normaliseComplexity(parsed?.complexity),
      summary: String(parsed?.summary ?? "").trim(),
      risks: Array.isArray(parsed?.risks)
        ? parsed.risks.map((x: any) => String(x)).filter(Boolean)
        : [],
      costs_effort: Array.isArray(parsed?.costs_effort)
        ? parsed.costs_effort.map((x: any) => String(x)).filter(Boolean)
        : [],
      verdict: String(parsed?.verdict ?? "").trim(),
      iteration_delta: null,
    };

    // Compute iteration delta if caller supplied previous_score
    if (previous_score !== null) {
      result.iteration_delta = result.score_out_of_10 - previous_score;
    }

    // Basic sanity checks
    if (!result.summary || !result.verdict) {
      return Response.json(
        { error: "AI returned incomplete structured output" },
        { status: 500 }
      );
    }

    return Response.json({ result });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "Score failed" },
      { status: 500 }
    );
  }
}
