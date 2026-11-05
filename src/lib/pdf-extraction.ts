import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";

let workerPromise: ReturnType<typeof createWorker> | undefined;
async function ocr(image: Buffer): Promise<string> {
  const cachePath = path.join(process.cwd(), ".data", "tesseract");
  await mkdir(cachePath, { recursive: true });
  workerPromise ??= createWorker("eng", undefined, {
    langPath: path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0") + path.sep,
    cachePath,
  });
  const worker = await workerPromise;
  return (await worker.recognize(image)).data.text;
}

export async function extractPdfText(filePath: string, imageOnly: boolean): Promise<string> {
  if (imageOnly) return ocr(await readFile(filePath));
  const canvasLib = await import("@napi-rs/canvas");
  Object.assign(globalThis, { DOMMatrix: canvasLib.DOMMatrix, ImageData: canvasLib.ImageData, Path2D: canvasLib.Path2D });
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(filePath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    const content = await page.getTextContent();
    const text = content.items.map((item) => "str" in item ? item.str : "").join(" ").trim();
    if (text.length > 40) pages.push(text);
    else {
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      await page.render({ canvas: canvas as never, canvasContext: context as never, viewport }).promise;
      pages.push(await ocr(await canvas.encode("png")));
    }
  }
  return pages.join("\n\n");
}
