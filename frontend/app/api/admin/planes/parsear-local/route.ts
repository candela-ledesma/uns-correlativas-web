import { NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/auth/authz";
import { parsePdfLocal } from "@/lib/services/parserService";
import { MAX_UPLOAD_SIZE_MB } from "@/lib/config/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function sseEvent(type: string, payload: Record<string, unknown> = {}): string {
  return `data: ${JSON.stringify({ type, ...payload })}\n\n`;
}

export async function POST(request: Request) {
  const session = await requireAdminOrModerator();
  if (session instanceof NextResponse) return session;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Error leyendo el formulario: ${msg}` }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
    return NextResponse.json({ error: `El archivo supera los ${MAX_UPLOAD_SIZE_MB} MB` }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, payload: Record<string, unknown> = {}) => {
        controller.enqueue(new TextEncoder().encode(sseEvent(type, payload)));
      };

      try {
        const bytes = await file.arrayBuffer();
        const data = await parsePdfLocal(bytes, file.name, send);
        send("done", { data });
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
