"use client";

import { useMemo, useState } from "react";
import MateriaCard from "@/components/MateriaCard";
import { agruparMaterias } from "@/lib/agruparMaterias";
import { separarMaterias } from "@/lib/separarMaterias";
import { estaHabilitada, EstadoMateria } from "@/lib/evaluarCorrelativas";
import { estadoAgrupador, siguienteEstado } from "@/lib/estadoMaterias";
import { PlanData, Materia } from "../app/types/plan";


function renderGrupo(
  titulo: string,
  materias: Materia[],
  prefijoKey: string,
  grupoId: string,
  estados: Record<string, EstadoMateria>,
  onToggle: (materia: Materia) => void
) {
  if (materias.length === 0) return null;

  return (
    <section
      id={`grupo-${grupoId}`}
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
        {materias.map((materia, index) => {
          const estado = estados[materia.id] || "no_cursada";
          const habilitada = estaHabilitada(materia, estados);
          const bloqueada = estado === "no_cursada" && !habilitada;

          return (
            <MateriaCard
              key={`${materia.id}-${index}`}
              materia={materia}
              estado={estado}
              habilitada={habilitada}
              bloqueada={bloqueada}
              onClick={() => onToggle(materia)}
            />
          );
        })}
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


  const idsAgrupadores = useMemo(
    () => new Set(data.agrupadores.map((a) => a.id)),
    [data.agrupadores]
  );

  function irAGrupo(idGrupo: string) {
    const elemento = document.getElementById(`grupo-${idGrupo}`);
    if (elemento) {
      elemento.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function toggleMateria(materia: Materia) {
    if (idsAgrupadores.has(materia.id)) {
      irAGrupo(materia.id);
      return;
    }

    setEstados((prev) => {
      const actual = prev[materia.id] || "no_cursada";
      return {
        ...prev,
        [materia.id]: siguienteEstado(actual),
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
                {materias.map((materia, index) => {
                const esAgrupador = idsAgrupadores.has(materia.id);

                const habilitada = estaHabilitada(materia, estados);

                const estado = esAgrupador
                  ? estadoAgrupador(materia.id, data.materias, estados)
                  : estados[materia.id] || "no_cursada";

                const bloqueada = estado === "no_cursada" && !habilitada;

                return (
                  <MateriaCard
                    key={`${materia.id}-${index}`}
                    materia={materia}
                    estado={estado}
                    habilitada={estaHabilitada(materia, estados)}
                    bloqueada={bloqueada}
                    onClick={() => toggleMateria(materia)}
                  />
                );
              })}
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
            `opt-${grupo.id}`,
            grupo.id,
            estados,
            toggleMateria
          )
        )}

      {data.agrupadores
        .filter((a) => a.tipo === "idioma_grupo")
        .map((grupo) =>
          renderGrupo(
            grupo.nombre,
            idiomas.filter((m) => m.grupo_opcion === grupo.id),
            `idioma-${grupo.id}`,
            grupo.id,
            estados,
            toggleMateria
          )
        )}

      {seminarios.length > 0 &&
        renderGrupo(
          "Seminarios",
          seminarios,
          "seminarios",
          "seminarios",
          estados,
          toggleMateria
        )
        }
    </main>
  );
}