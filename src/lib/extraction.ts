import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { load } from "cheerio";
import { splitIntoChunks } from "./chunking";

export type ExtractionResult = { status: "done" | "unsupported" | "failed"; method: string; chunks: string[] };
const xml = new XMLParser({ ignoreAttributes: true });

export async function extractFile(filePath: string): Promise<ExtractionResult> {
  const extension = path.extname(filePath).toLowerCase();
  try {
    let text: string;
    let method = "text_layer";
    if ([".txt", ".md", ".csv"].includes(extension)) text = await readFile(filePath, "utf8");
    else if (extension === ".html" || extension === ".htm") {
      const $ = load(await readFile(filePath, "utf8"));
      $("script, style, noscript, svg").remove();
      text = $("body").text() || $.text();
      method = "text_layer";
    } else if (extension === ".docx") {
      text = (await mammoth.extractRawText({ path: filePath })).value;
      method = "text_layer";
    } else if (extension === ".xlsx" || extension === ".xls") {
      const book = XLSX.readFile(filePath, { cellText: true });
      text = book.SheetNames.map((name) => `# ${name}\n${XLSX.utils.sheet_to_csv(book.Sheets[name])}`).join("\n\n");
      method = "text_layer";
    } else if (extension === ".pptx") {
      const zip = await JSZip.loadAsync(await readFile(filePath));
      const names = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => slideNumber(a) - slideNumber(b));
      const texts = await Promise.all(names.map(async (name) => {
        const parsed = xml.parse(await zip.file(name)!.async("string"));
        return collectText(parsed).join(" ");
      }));
      text = texts.join("\n\n");
      method = "text_layer";
    } else if ([".pdf", ".png", ".jpg", ".jpeg"].includes(extension)) {
      const { extractPdfText } = await import("./pdf-extraction");
      text = await extractPdfText(filePath, extension !== ".pdf");
      method = extension === ".pdf" ? "text_layer" : "ocr";
    } else return { status: "unsupported", method: "", chunks: [] };
    return { status: "done", method, chunks: splitIntoChunks(text) };
  } catch (error) {
    console.error("File extraction failed", error);
    return { status: "failed", method: "", chunks: [] };
  }
}

function slideNumber(name: string) { return Number(name.match(/slide(\d+)/)?.[1] ?? 0); }
function collectText(value: unknown): string[] {
  if (typeof value === "string") return [];
  if (Array.isArray(value)) return value.flatMap(collectText);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const own = Object.entries(record).filter(([key, child]) => (key === "t" || key.endsWith(":t")) && typeof child === "string").map(([, child]) => String(child));
  return own.concat(...Object.entries(record).filter(([key]) => key !== "t" && !key.endsWith(":t")).map(([, child]) => collectText(child)));
}
