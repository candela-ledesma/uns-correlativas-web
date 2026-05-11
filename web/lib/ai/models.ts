export const GEMINI_MODELS = [
  { value: "gemini-2.5-flash",      label: "gemini-2.5-flash" },
  { value: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite" },
  { value: "gemini-2.5-pro",        label: "gemini-2.5-pro" },
  { value: "gemma-4-26b-a4b-it",    label: "gemma-4-26b-a4b-it" },
] as const;

export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].value;

export type GeminiModelValue = (typeof GEMINI_MODELS)[number]["value"];
