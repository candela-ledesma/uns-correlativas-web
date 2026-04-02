"use client";

import { ReactNode } from "react";

type Props = {
    children: ReactNode;
    };

    export default function MateriasGrid({ children }: Props) {
    return (
    <div
        style={{
        display: "grid",
        gap: "12px",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
    >
        {children}
    </div>
    );
}