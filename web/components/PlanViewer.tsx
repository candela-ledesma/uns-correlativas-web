"use client";

import { useMemo, useState } from "react";
import MateriaCard from "@/components/MateriaCard";
import { agruparMaterias } from "@/lib/agruparMaterias";
import { separarMaterias } from "@/lib/separarMaterias";
import { estaHabilitada, EstadoMateria } from "@/lib/evaluarCorrelativas";
import { PlanData, Materia } from "../app/types/plan";

function siguienteEstado(actual: EstadoMateria): EstadoMateria {
  if (actual === "no_cursada") return "cursada";
  if (actual === "cursada") return "aprobada";
  return "no_cursada";
}

function renderGrupo(
  titulo: string,
  materias: Materia[],
  estados: Record<string, EstadoMateria>,
  onToggle: (id: string) => void,
  prefijoKey: string
) {
  if (materias.length === 0) return null;

  return (
    <section
      key={prefijoKey}
      style={{
        marginTop: "32px",
        padding: "20px",
        backgroundColor: "#fff",
        borderRadius: "12px",
      }}
    >
      <h2 style={{ marginBottom: "16px" }}>{titulo}</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "14px",
        }}
      >
        {materias.map((materia, index) => (
          <MateriaCard
            key={`${prefijoKey}-${materia.id}-${index}`}
            materia={materia}
            estado={estados[materia.id] || "no_cursada"}
            habilitada={estaHabilitada(materia, estados)}
            onClick={() => onToggle(materia.id)}
          />
        ))}
      </div>
    </section>
  );
}

export default function PlanViewer({ data }: { data: PlanData }) {
  const [estados, setEstados] = useState<Record<string, EstadoMateria>>({});

  const { normales, optativas, idiomas, seminarios } = separarMaterias(
    data.materias,
    data.agrupadores
  );

  const agrupadas = useMemo(() => agruparMaterias(normales), [normales]);

  function toggleMateria(id: string) {
    setEstados((prev) => {
      const actual = prev[id] || "no_cursada";
      return {
        ...prev,
        [id]: siguienteEstado(actual),
      };
    });
  }

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
                  <MateriaCard
                    key={`${materia.id}-${index}`}
                    materia={materia}
                    estado={estados[materia.id] || "no_cursada"}
                    habilitada={estaHabilitada(materia, estados)}
                    onClick={() => toggleMateria(materia.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      {data.agrupadores
        .filter((a) => a.tipo === "optativa_grupo")
        .map((grupo) =>
          renderGrupo(
            grupo.nombre,
            optativas.filter((m) => m.grupo_opcion === grupo.id),
            estados,
            toggleMateria,
            `opt-${grupo.id}`
          )
        )}

      {data.agrupadores
        .filter((a) => a.tipo === "idioma_grupo")
        .map((grupo) =>
          renderGrupo(
            grupo.nombre,
            idiomas.filter((m) => m.grupo_opcion === grupo.id),
            estados,
            toggleMateria,
            `idioma-${grupo.id}`
          )
        )}

      {seminarios.length > 0 &&
        renderGrupo("Seminarios", seminarios, estados, toggleMateria, "seminarios")}
    </main>
  );
}