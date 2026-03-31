import PlanViewer from "@/components/PlanViewer";
import { PlanData } from "./types/plan";
import { headers } from "next/headers";

async function getMaterias(): Promise<PlanData> {
  const h = await headers();
  const host = h.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  const res = await fetch(`${baseUrl}/api/materias`, {
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