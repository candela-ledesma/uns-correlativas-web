import { notFound } from "next/navigation";
import { BG_GRADIENT, HEADING_FONT } from "@/lib/ui/tokens";
import { getCarreraById } from "@/lib/data/carreras";
import { loadPlanData, formatValidationIssues } from "@/lib/data/planDataLoader";
import PlanStatus from "@/components/plan/PlanStatus";
import ShareViewer from "@/components/plan/ShareViewer";
import { prisma } from "@/lib/db/prisma";
import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";

type Props = {
  params: Promise<{ carrera: string; token: string }>;
};

export default async function Page({ params }: Props) {
  const { carrera: carreraId, token } = await params;

  const share = await prisma.progressShare.findUnique({ where: { token } });
  if (!share) notFound();

  let sharedState: Record<string, EstadoMateria>;
  try {
    sharedState = JSON.parse(share.stateJson) as Record<string, EstadoMateria>;
  } catch {
    notFound();
  }

  const carrera = getCarreraById(carreraId);
  const result = await loadPlanData(carreraId, share.versionId);

  if (result.status === "not-found") notFound();

  if (result.status === "unavailable") {
    return (
      <PlanStatus
        titulo={carrera?.nombre ?? carreraId}
        mensaje="Este plan todavía no está disponible."
      />
    );
  }

  if (result.status === "invalid") {
    const mensaje =
      result.errorKind === "shape"
        ? "Los datos de este plan tienen un formato inválido."
        : "Los datos de este plan contienen inconsistencias internas.";
    return (
      <PlanStatus
        titulo={carrera?.nombre ?? carreraId}
        mensaje={mensaje}
        detallesTecnicos={formatValidationIssues(result.issues)}
        variant="error"
      />
    );
  }

  if (result.status === "error") {
    return (
      <PlanStatus
        titulo={carrera?.nombre ?? carreraId}
        mensaje="Hubo un problema inesperado al cargar este plan."
        variant="error"
      />
    );
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 py-8 sm:py-10" style={{ background: BG_GRADIENT, fontFamily: HEADING_FONT }}>
      <div className="mx-auto max-w-7xl">
        <ShareViewer
          data={result.data}
          carreraId={carreraId}
          sharedState={sharedState}
          sharedAt={share.createdAt.toISOString()}
        />
      </div>
    </main>
  );
}
