import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * November 14 owner request: AI writing tools for staff (profile summaries and Ask the Data). Server only; the key is
 * `ANTHROPIC_API_KEY` (never NEXT_PUBLIC). Prompts carry numbers, labels and PAC codes only, never player names or
 * contact details; callers swap codes back to names after the reply. Output is descriptive, never training or health advice.
 */
export const AI_MODEL = "claude-opus-5-5";
export const aiEnabled = () => typeof process.env.ANTHROPIC_API_KEY === "string" && process.env.ANTHROPIC_API_KEY.length > 0;

export class AiError extends Error {}
let client: Anthropic | null = null;

/** Shared rules for every AI feature, so summaries and answers stay in the dashboard's descriptive voice. */
export const AI_GROUND_RULES = `You write for Pacific University baseball coaches using an independent player-development dashboard.
- Use only the numbers in the provided data. If something isn't in the data, say it isn't recorded. Never guess or invent values.
- Percentiles compare a player with Pacific teammates (100 = best on the team), not with other schools.
- Mention sample sizes when a result rests on few plate appearances, innings, swings or pitches.
- Describe what the numbers show. Don't give training programs, drills, injury or health advice, and don't claim one stat causes another.
- Body measurements (height, weight, muscle mass, body fat) are descriptive, not good or bad.
- Plain, friendly coaching language. No markdown headings or tables; short paragraphs or simple "- " bullets are fine.`;

export async function writeWithClaude({ system, data, request, maxTokens = 1200 }: { system: string; data: string; request: string; maxTokens?: number }): Promise<string> {
  if (!aiEnabled()) throw new AiError("AI writing isn't set up yet. Add an Anthropic API key to the dashboard's environment first.");
  client ??= new Anthropic();
  let response;
  try {
    response = await client.beta.messages.create({
      model: AI_MODEL,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      // The data block is the large, repeated part, so it is cached for follow-up questions within a few minutes.
      system: [{ type: "text", text: `${AI_GROUND_RULES}\n\n${system}` }, { type: "text", text: data, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: request }],
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new AiError("The AI service is busy. Try again in a minute.");
    if (error instanceof Anthropic.AuthenticationError) throw new AiError("The AI key isn't valid. Check the dashboard's Anthropic API key.");
    if (error instanceof Anthropic.APIError) throw new AiError("The AI service couldn't answer right now. Try again.");
    throw new AiError("The AI service couldn't be reached. Try again.");
  }
  if (response.stop_reason === "refusal") throw new AiError("The AI declined this request. Try rewording it.");
  const text = response.content.flatMap(block => block.type === "text" ? [block.text] : []).join("\n").trim();
  if (!text) throw new AiError("The AI returned an empty answer. Try again.");
  return text;
}

/** Replace PAC codes in an AI reply with the names they stand for (names never leave the server). */
export function restoreNames(text: string, names: ReadonlyMap<string, string>): string {
  return text.replace(/PAC-\d{4,9}/g, code => names.get(code) ?? code);
}
