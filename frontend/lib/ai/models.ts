export type ModelLimits = {
  rpm: number;
  tpm: number;
  rpd: number;
};

export const GEMINI_MODELS = [
  {
    value: "gemini-2.5-flash",
    label: "gemini-2.5-flash",
    limits: { rpm: 10, tpm: 250_000, rpd: 500 } satisfies ModelLimits,
  },
  {
    value: "gemini-2.5-flash-lite",
    label: "gemini-2.5-flash-lite",
    limits: { rpm: 30, tpm: 1_000_000, rpd: 1_500 } satisfies ModelLimits,
  },
  {
    value: "gemini-2.5-pro",
    label: "gemini-2.5-pro",
    limits: { rpm: 5, tpm: 250_000, rpd: 25 } satisfies ModelLimits,
  },
  {
    value: "gemma-4-26b-a4b-it",
    label: "gemma-4-26b-a4b-it",
    limits: { rpm: 30, tpm: 15_000, rpd: 14_400 } satisfies ModelLimits,
  },
] as const;

export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].value;

export type GeminiModelValue = (typeof GEMINI_MODELS)[number]["value"];
