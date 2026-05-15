"use client";

import { useMemo, useState } from "react";
import { TEXT, TEXT_DET, ACCENT, GLASS, BTN, BTN_VIOLET, SURFACE } from "@/lib/ui/tokens";

type Props = {
  open: boolean;
  onDismiss: () => void;
  onComplete: () => void;
};

type Step = {
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    title: "Hacé click en una materia",
    body: "Cada click avanza el estado: disponible → cursada → aprobada. Si no cumplís las correlativas, el estado no cambia.",
  },
  {
    title: "Podés deshacer",
    body: "En cada tarjeta hay un botón para volver un paso atrás — de aprobada a cursada, o de cursada a disponible. Las dependencias se recalculan solas.",
  },
  {
    title: "Cómo funcionan las correlativas",
    body: "Una materia se habilita cuando cumplís sus requisitos: algunas piden que otra esté cursada, otras que esté aprobada. El plan lo indica automáticamente.",
  },
  {
    title: "Ejemplo rápido",
    body: "Si Análisis II requiere Análisis I cursada, al marcar Análisis I como cursada, Análisis II pasa a disponible. Si requiere aprobada, recién se habilita al aprobarla.",
  },
];

export default function PlanOnboarding({ open, onDismiss, onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = STEPS[stepIndex] ?? STEPS[0];
  const isLastStep = stepIndex === STEPS.length - 1;

  const progressPercent = useMemo(() => {
    if (STEPS.length <= 1) return 100;
    return Math.round(((stepIndex + 1) / STEPS.length) * 100);
  }, [stepIndex]);

  if (!open) return null;

  return (
    <div
      data-testid="plan-onboarding-modal"
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", padding: 24 }}
      onClick={onDismiss}
    >
      <div
        style={{ ...SURFACE, borderRadius: 20, padding: "28px 24px", maxWidth: 480, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)", display: "flex", flexDirection: "column", gap: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ color: ACCENT, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
              Guía rápida · {stepIndex + 1} de {STEPS.length}
            </p>
            <h2 style={{ color: TEXT, fontSize: 18, fontWeight: 800, lineHeight: 1.2, margin: 0 }}>
              {currentStep.title}
            </h2>
          </div>
          <button
            type="button"
            data-testid="plan-onboarding-dismiss"
            onClick={onDismiss}
            style={{ ...BTN, padding: "6px 14px", fontSize: 12, fontWeight: 500, borderRadius: 8, cursor: "pointer", flexShrink: 0 }}
          >
            Omitir
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, width: "100%", borderRadius: 99, background: GLASS.medium, overflow: "hidden" }}>
          <div
            style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${ACCENT}, #c77dff)`, transition: "width 0.25s", width: `${progressPercent}%` }}
          />
        </div>

        {/* Body */}
        <p style={{ color: TEXT_DET, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
          {currentStep.body}
        </p>

        {/* Dot indicators */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStepIndex(i)}
              style={{ width: i === stepIndex ? 20 : 8, height: 8, borderRadius: 99, border: "none", cursor: "pointer", transition: "all 0.2s", background: i === stepIndex ? ACCENT : GLASS.strong, padding: 0 }}
              aria-label={`Ir al paso ${i + 1}`}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((p) => Math.max(0, p - 1))}
            style={{ ...BTN, padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: 10, cursor: "pointer", opacity: stepIndex === 0 ? 0.4 : 1 }}
          >
            ← Anterior
          </button>

          {!isLastStep ? (
            <button
              type="button"
              data-testid="plan-onboarding-next"
              onClick={() => setStepIndex((p) => Math.min(STEPS.length - 1, p + 1))}
              style={{ ...BTN_VIOLET, padding: "8px 18px", fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: "pointer" }}
            >
              Siguiente →
            </button>
          ) : (
            <button
              type="button"
              data-testid="plan-onboarding-complete"
              onClick={onComplete}
              style={{ ...BTN_VIOLET, padding: "8px 18px", fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: "pointer" }}
            >
              ¡Entendido!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
