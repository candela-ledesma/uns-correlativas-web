import PlanViewer from "@/components/PlanViewer";
import { PlanData } from "./types/plan";

async function getMaterias(): Promise<PlanData> {
  const res = await fetch("http://localhost:3000/api/materias", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("No se pudieron cargar las materias");
  }

  return res.json();
}

export default async function HomePage() {
  const data = await getMaterias();
  return <PlanViewer data={data} />;
}