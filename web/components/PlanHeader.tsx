"use client";

type Props = {
    titulo: string;
    subtitulo?: string;
    aprobadas: number;
    cursadas: number;
    disponibles: number;
    total: number;
    onReset?: () => void;
};

function StatCard({
    label,
    value,
    }: {
    label: string;
    value: number;
    }) {
    return (
    <div
        style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        padding: "14px 16px",
        minWidth: "120px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}
    >
        <div
        style={{
            fontSize: "13px",
            color: "#6b7280",
            marginBottom: "6px",
        }}
        >
        {label}
        </div>
        <div
        style={{
            fontSize: "24px",
            fontWeight: 800,
            color: "#111827",
            lineHeight: 1,
        }}
        >
        {value}
        </div>
    </div>
    );
    }

    export default function PlanHeader({
    titulo,
    subtitulo,
    aprobadas,
    cursadas,
    disponibles,
    total,
    onReset,
    }: Props) {
    const porcentaje = total > 0 ? Math.round((aprobadas / total) * 100) : 0;

    return (
    <header
        style={{
        marginBottom: "36px",
        display: "grid",
        gap: "20px",
        }}
    >
        <div
        style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            flexWrap: "wrap",
        }}
        >
        <div>
            <h1
            style={{
                margin: 0,
                marginBottom: "8px",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                lineHeight: 1.05,
                color: "#111827",
            }}
            >
            {titulo}
            </h1>

            {subtitulo && (
            <p
                style={{
                margin: 0,
                color: "#4b5563",
                fontSize: "1rem",
                }}
            >
                {subtitulo}
            </p>
            )}
        </div>

        {onReset && (
            <button
            type="button"
            data-testid="reset-btn"
            onClick={onReset}
            style={{
                border: "1px solid #d1d5db",
                borderRadius: "12px",
                padding: "10px 14px",
                background: "#ffffff",
                cursor: "pointer",
                fontWeight: 700,
                color: "#111827",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
            >
            Reiniciar progreso
            </button>
        )}
        </div>

        <div
        style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "18px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
        }}
        >
        <div
            style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: "14px",
            }}
        >
            <div>
            <div
                style={{
                fontSize: "14px",
                color: "#6b7280",
                marginBottom: "6px",
                }}
            >
                Progreso general
            </div>
            <div
                style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "#111827",
                }}
            >
                {porcentaje}% aprobado
            </div>
            </div>

            <div
            style={{
                fontSize: "14px",
                color: "#4b5563",
            }}
            >
            {aprobadas} de {total} materias aprobadas
            </div>
        </div>

        <div
            aria-hidden="true"
            style={{
            width: "100%",
            height: "12px",
            background: "#eef2f7",
            borderRadius: "999px",
            overflow: "hidden",
            marginBottom: "18px",
            }}
        >
            <div
            style={{
                width: `${porcentaje}%`,
                height: "100%",
                background: "linear-gradient(90deg, #86efac 0%, #4ade80 100%)",
                borderRadius: "999px",
                transition: "width 0.25s ease",
            }}
            />
        </div>

        <div
            style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            }}
        >
            <StatCard label="Aprobadas" value={aprobadas} />
            <StatCard label="Cursadas" value={cursadas} />
            <StatCard label="Disponibles" value={disponibles} />
        </div>
        </div>
    </header>
    );
}