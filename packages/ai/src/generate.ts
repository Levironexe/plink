import { generateText, Output } from "ai";
import {
  copySystemPrompt,
  generatedCopySchema,
  generatedPageSchema,
  modelFor,
  pageSystemPrompt,
  sanitizeGeneratedCopy,
  sanitizeGeneratedPage,
  type GeneratedCopy,
  type GeneratedPage,
} from "./index";

/**
 * The AI SDK is an implementation detail of this package — callers pass intent
 * and receive sanitised domain objects, never a raw model response.
 */
export async function generatePage(input: {
  prompt: string;
  socials?: { platform: string; url: string }[];
}): Promise<GeneratedPage> {
  const context = input.socials?.length
    ? `\n\nThe creator already has these social profiles: ${input.socials
        .map((s) => s.platform)
        .join(", ")}. Include a single "socials" block if it fits the page.`
    : "";

  const { output } = await generateText({
    model: modelFor("page"),
    system: pageSystemPrompt(),
    prompt: `Creator description:\n${input.prompt}${context}`,
    output: Output.object({
      schema: generatedPageSchema,
      name: "plink_page",
      description: "A complete link-in-bio page: profile, theme and ordered blocks.",
    }),
    temperature: 0.7,
    maxRetries: 1,
    timeout: 45_000,
  });

  // Model output is untrusted, even when it validated against the schema.
  return sanitizeGeneratedPage(output);
}

export async function generateCopy(input: {
  tone?: string;
  context?: string;
  bio?: string;
  titles?: string[];
}): Promise<GeneratedCopy> {
  const lines = [
    input.tone ? `Tone: ${input.tone}.` : "Tone: warm but plain-spoken.",
    input.context ? `What the creator does:\n${input.context}` : null,
    input.bio ? `Current bio:\n${input.bio}` : "There is no bio yet — write one.",
    input.titles?.length
      ? `Current block titles, in order:\n${input.titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
      : "There are no block titles to rewrite — return an empty list.",
  ].filter(Boolean);

  const { output } = await generateText({
    model: modelFor("copy"),
    system: copySystemPrompt(),
    prompt: lines.join("\n\n"),
    output: Output.object({
      schema: generatedCopySchema,
      name: "plink_copy",
      description: "A rewritten bio and the rewritten block titles, in the original order.",
    }),
    temperature: 0.6,
    maxRetries: 1,
    timeout: 20_000,
  });

  return sanitizeGeneratedCopy(output);
}
