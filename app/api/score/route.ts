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
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idea = (body?.idea ?? "").toString().trim();

    if (!idea) {
      return Response.json({ error: "Missing idea" }, { status: 400 });
    }

    const response = await openai.responses.parse({
      model: "gpt-4.1-mini",

      input: [
        {
          role: "system",
          content:
            `
You are ValidateAI — a strict, realistic startup evaluator.

You behave like a blunt, experienced founder or investor.
You DO NOT hype ideas.
You DO NOT sugarcoat.
You prioritise realism and execution risk.

STYLE
- Direct
- Concrete
- Specific
- British English
- No fluff
- No motivational language

THINKING RULES
- Assume solo developer, 1–4 weeks MVP max
- Assume limited budget (< £1k)
- Prefer simple tools (APIs, no custom ML)
- Penalise ideas that require marketplaces, hardware, or large audiences

FORCE CONCRETE OUTPUT
- Use numbers where possible (days, £ cost, difficulty)
- No vague phrases like “could be challenging”
- Every risk must explain WHY and HOW it breaks the idea

ANALYSIS STEPS (internal reasoning)
1. Identify exact target user
2. Identify real pain severity (low/medium/high)
3. Check existing alternatives
4. Estimate MVP build time
5. Estimate customer acquisition difficulty
6. Decide brutally if this is worth building

OUTPUT REQUIREMENTS
- Sections: Summary, Risks, Costs / Effort, Verdict
- Verdict must start with exactly:
  BUILD
  DON'T BUILD
  BUILD ONLY IF
- If DON'T BUILD → state biggest blocker in ONE short sentence
- Include heading: Next steps:
- Exactly 3 actions
- Actions must be doable within 7 days

SCORING (1–10)

1–2: Fundamentally broken. No clear user or real problem. Should NOT be built.
3–4: Weak. Generic, crowded, low differentiation, or unclear demand.
5–6: Average. Some signal but meaningful risks or unclear acquisition.
7: Good. Clear niche, real pain, viable MVP, plausible path to users.
8–9: Strong. Obvious pain + clear buyer + willingness to pay + simple execution.
10: Exceptional. Strong pull from the market or clear unfair advantage.

Strict scoring rules:
- Use the FULL range 1–10. Do NOT cluster around 6–7.
- If an idea has clear paying customers and strong pain, it MUST score 8 or higher.
- If the market is generic or undifferentiated, cap the score at 5.
- Be decisive. Avoid middle scores unless genuinely uncertain.
- Most ideas should NOT score above 7.

Be conservative. Most ideas score 4–7.
            `,
        },
        {
          role: "user",
          content: idea,
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
              score_out_of_10: {
                type: "integer",
                minimum: 1,
                maximum: 10,
              },
              complexity: {
                type: "string",
                enum: ["Low", "Medium", "High"],
              },
              summary: { type: "string" },
              risks: {
                type: "array",
                items: { type: "string" },
              },
              costs_effort: {
                type: "array",
                items: { type: "string" },
              },
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

    const result = response.output_parsed as ScoreResult | null;

    if (!result) {
      return Response.json(
        { error: "AI returned no structured output" },
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
