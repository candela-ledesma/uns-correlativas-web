import MateriaCard from "@/components/MateriaCard";
import { agruparMaterias } from "@/lib/agruparMaterias";
import { separarMaterias } from "@/lib/separarMaterias";
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

  const { normales, optativas, idiomas, seminarios } = separarMaterias(
    data.materias
  );

  const agrupadas = agruparMaterias(normales);

  return (
    <main
      style={{
        padding: "24px",
        maxWidth: "1100px",
        margin: "0 auto",
        backgroundColor: "#f7f7f7",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ marginBottom: "24px" }}>UNS Correlativas</h1>

      {Object.entries(agrupadas).map(([anio, cuatrimestres]) => (
        <section key={anio} style={{ marginBottom: "40px" }}>
          <h2 style={{ marginBottom: "16px" }}>{anio}</h2>

          {Object.entries(cuatrimestres).map(([cuatri, materias]) => (
            <div key={`${anio}-${cuatri}`} style={{ marginBottom: "24px" }}>
              <h3 style={{ marginBottom: "12px", color: "#444" }}>{cuatri}</h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: "14px",
                }}
              >
                {materias.map((materia, index) => (
                  <MateriaCard key={`${materia.id}-${index}`} materia={materia} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      {optativas.length > 0 && (
        <section
          style={{
            marginTop: "48px",
            padding: "20px",
            backgroundColor: "#fff",
            borderRadius: "12px",
          }}
        >
          <h2 style={{ marginBottom: "16px" }}>Materias Optativas</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "14px",
            }}
          >
            {optativas.map((materia, index) => (
              <MateriaCard key={`opt-${materia.id}-${index}`} materia={materia} />
            ))}
          </div>
        </section>
      )}

      {idiomas.length > 0 && (
        <section
          style={{
            marginTop: "32px",
            padding: "20px",
            backgroundColor: "#fff",
            borderRadius: "12px",
          }}
        >
          <h2 style={{ marginBottom: "16px" }}>Idiomas</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "14px",
            }}
          >
            {idiomas.map((materia, index) => (
              <MateriaCard key={`idioma-${materia.id}-${index}`} materia={materia} />
            ))}
          </div>
        </section>
      )}

      {seminarios.length > 0 && (
        <section
          style={{
            marginTop: "32px",
            padding: "20px",
            backgroundColor: "#fff",
            borderRadius: "12px",
          }}
        >
          <h2 style={{ marginBottom: "16px" }}>Seminarios</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "14px",
            }}
          >
            {seminarios.map((materia, index) => (
              <MateriaCard
                key={`seminario-${materia.id}-${index}`}
                materia={materia}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}