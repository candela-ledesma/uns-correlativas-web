"use client";

import { ReactNode } from "react";

type Props = {
    children: ReactNode;
};

export default function MateriasGrid({ children }: Props) {
    return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {children}
    </div>
    );
}