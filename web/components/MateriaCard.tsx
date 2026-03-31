import { Materia } from "../app/types/plan";

type Props = {
  materia: Materia;
};

export default function MateriaCard({ materia }: Props) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "14px",
        backgroundColor: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: "6px" }}>{materia.nombre}</div>

      <div style={{ fontSize: "14px", color: "#555" }}>Código: {materia.id}</div>

      {materia.horas && (
        <div style={{ fontSize: "14px", color: "#555", marginTop: "4px" }}>
          Carga horaria: {materia.horas} hs
        </div>
      )}
    </div>
  );
}