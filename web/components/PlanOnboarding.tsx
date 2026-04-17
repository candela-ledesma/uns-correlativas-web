"use client";

import { useMemo, useState } from "react";

type Props = {
  open: boolean;
  onDismiss: () => void;
  onComplete: () => void;
  isSubmitting?: boolean;
};

type Step = {
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    title: "Marcar materias",
    body: "Cada click sobre una materia avanza su estado: no cursada, cursada y aprobada. Si no cumple correlativas, no cambia.",
  },
  {
    title: "Deshacer cambios",
    body: "En cada tarjeta podés volver un paso: de aprobada a cursada o de cursada a no cursada. El sistema reajusta dependencias automáticamente.",
  },
  {
    title: "Cómo se calcula habilitación",
    body: "Una materia queda habilitada cuando cumplís las correlativas para cursar o para aprobar, según las reglas del plan.",
  },
  {
    title: "Ejemplo práctico",
    body: "Si Materia B requiere Materia A cursada, al marcar A como cursada B pasa a disponible. Si B requiere A aprobada, recién se habilita al aprobar A.",
  },
];

export default function PlanOnboarding({
  open,
  onDismiss,
  onComplete,
  isSubmitting = false,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = STEPS[stepIndex] ?? STEPS[0];
  const isLastStep = stepIndex === STEPS.length - 1;

  const progressPercent = useMemo(() => {
    if (STEPS.length <= 1) return 100;
    return Math.round((stepIndex / (STEPS.length - 1)) * 100);
  }, [stepIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Onboarding inicial
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-zinc-900">
              {currentStep.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            disabled={isSubmitting}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600"
          >
            Omitir
          </button>
        </div>

        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-zinc-900 transition-[width] duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p className="mb-6 text-sm leading-relaxed text-zinc-700">{currentStep.body}</p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-zinc-500">
            Paso {stepIndex + 1} de {STEPS.length}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={stepIndex === 0 || isSubmitting}
              onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50"
            >
              Anterior
            </button>

            {!isLastStep && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setStepIndex((prev) => Math.min(STEPS.length - 1, prev + 1))}
                className="rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-semibold text-white"
              >
                Siguiente
              </button>
            )}

            {isLastStep && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onComplete}
                className="rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-semibold text-white"
              >
                {isSubmitting ? "Guardando..." : "Finalizar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
