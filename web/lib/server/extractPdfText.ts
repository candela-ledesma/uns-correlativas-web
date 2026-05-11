import { createRequire } from "module";

const require = createRequire(import.meta.url);

type Page = { Texts: Array<{ R: Array<{ T: string }> }> };
type PDFData = { Pages?: Page[] };

export async function extractPdfText(buf: Buffer): Promise<string> {
  // Cargamos pdf2json via require para evitar que Turbopack lo bundlee incorrectamente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PDFParser = require("pdf2json") as any;

  return new Promise<string>((resolve, reject) => {
    const parser = new PDFParser();

    parser.on("pdfParser_dataReady", (data: PDFData) => {
      try {
        const pages = data.Pages ?? [];
        const text = pages
          .map((page) =>
            page.Texts.map((t) =>
              t.R.map((r) => decodeURIComponent(r.T)).join("")
            ).join(" ")
          )
          .join("\n");
        resolve(text);
      } catch (e) {
        reject(e);
      }
    });

    parser.on("pdfParser_dataError", (err: unknown) => reject(err));

    parser.parseBuffer(buf);
  });
}
