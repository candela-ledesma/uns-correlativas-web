"use client";

import { useState } from "react";

type UserRow = {
  id: string;
  email: string | null;
  role: "USER" | "MODERATOR" | "ADMIN";
};

type Props = {
  users: UserRow[];
};

export default function AdminRoleManager({ users }: Props) {
  const [rows, setRows] = useState(users);
  const [reasonByUserId, setReasonByUserId] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string>("");

  async function handleRoleChange(userId: string, role: UserRow["role"]) {
    const reason = reasonByUserId[userId]?.trim();

    if (!reason) {
      setStatus("El motivo es obligatorio para cambios de rol.");
      return;
    }

    const response = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, reason }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setStatus(payload?.error ?? "No se pudo actualizar el rol.");
      return;
    }

    setRows((prev) =>
      prev.map((row) => (row.id === userId ? { ...row, role } : row))
    );

    setStatus("Rol actualizado y auditado correctamente.");
    setReasonByUserId((prev) => ({ ...prev, [userId]: "" }));
  }

  return (
    <div className="grid gap-4">
      {status && <p className="text-sm text-zinc-700">{status}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500">
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Rol actual</th>
              <th className="px-3 py-2">Motivo</th>
              <th className="px-3 py-2">Actualizar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-zinc-100">
                <td className="px-3 py-2">{row.email ?? "(sin email)"}</td>
                <td className="px-3 py-2">{row.role}</td>
                <td className="px-3 py-2">
                  <input
                    data-testid={`reason-${row.id}`}
                    value={reasonByUserId[row.id] ?? ""}
                    onChange={(event) =>
                      setReasonByUserId((prev) => ({
                        ...prev,
                        [row.id]: event.target.value,
                      }))
                    }
                    placeholder="Motivo obligatorio"
                    className="w-72 rounded-md border border-zinc-300 px-2 py-1"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    {(["USER", "MODERATOR", "ADMIN"] as const).map((targetRole) => (
                      <button
                        key={targetRole}
                        type="button"
                        disabled={targetRole === row.role}
                        onClick={() => handleRoleChange(row.id, targetRole)}
                        className="rounded-md border border-zinc-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {targetRole}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
