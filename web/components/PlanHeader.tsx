"use client";

type Props = {
    titulo: string;
    subtitulo?: string;
    onReset?: () => void;
    };

    export default function MateriasHeader({
    titulo,
    subtitulo,
    onReset,
    }: Props) {
    return (
    <header
        style={{
        marginBottom: "32px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "16px",
        flexWrap: "wrap",
        }}
    >
        <div>
        <h1 style={{ margin: 0, marginBottom: "8px" }}>{titulo}</h1>

        {subtitulo && (
            <p style={{ margin: 0, color: "#555", fontSize: "15px" }}>
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
            border: "1px solid #ddd",
            borderRadius: "10px",
            padding: "10px 14px",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 600,
            }}
        >
            Reset
        </button>
        )}
    </header>
    );
}