import { MAX_IMPORT_BYTES, MAX_TABLE_COLUMNS, MAX_TABLE_ROWS, parseDelimited, parseMeasurementDate } from "./engine";

export type ImportFile = { fileName: string; fileHash: string; sheets: { name: string; matrix: string[][] }[] };

const MAX_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 1000;

/** Bound ZIP metadata before decompression; workbook bytes are never extracted to disk. */
function validateXlsxArchive(bytes: ArrayBuffer) {
  const view = new DataView(bytes);
  const fail = () => { throw new Error("This XLSX archive is invalid or unsupported. Export a fresh XLSX or CSV file."); };
  if (view.byteLength < 22 || view.getUint32(0, true) !== 0x04034b50) return fail();
  let end = -1;
  for (let position = view.byteLength - 22; position >= Math.max(0, view.byteLength - 65557); position--) {
    if (view.getUint32(position, true) === 0x06054b50 && position + 22 + view.getUint16(position + 20, true) === view.byteLength) { end = position; break; }
  }
  if (end < 0) return fail();
  const entryCount = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== entryCount || !entryCount || entryCount > MAX_ZIP_ENTRIES || directoryOffset + directorySize !== end) return fail();
  let position = directoryOffset, uncompressedTotal = 0;
  for (let entry = 0; entry < entryCount; entry++) {
    if (position + 46 > end || view.getUint32(position, true) !== 0x02014b50) return fail();
    const flags = view.getUint16(position + 8, true), method = view.getUint16(position + 10, true);
    const compressed = view.getUint32(position + 20, true), uncompressed = view.getUint32(position + 24, true);
    const nameLength = view.getUint16(position + 28, true), extraLength = view.getUint16(position + 30, true), commentLength = view.getUint16(position + 32, true);
    const localOffset = view.getUint32(position + 42, true);
    uncompressedTotal += uncompressed;
    if (uncompressedTotal > MAX_UNCOMPRESSED_BYTES) throw new Error("The workbook expands beyond the 20 MiB limit. Export fewer sheets or a smaller table.");
    if (flags & 1 || ![0, 8].includes(method) || view.getUint16(position + 34, true) || compressed > bytes.byteLength || position + 46 + nameLength + extraLength + commentLength > end || localOffset + 30 > directoryOffset) return fail();
    if (view.getUint32(localOffset, true) !== 0x04034b50 || view.getUint16(localOffset + 8, true) !== method || view.getUint16(localOffset + 6, true) & 1) return fail();
    const dataOffset = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    if (dataOffset + compressed > directoryOffset) return fail();
    position += 46 + nameLength + extraLength + commentLength;
  }
  if (position !== end) return fail();
}

/** User-selected bytes stay in this browser. No uploads, remote parsers, or telemetry. */
export async function readImportFile(file: File): Promise<ImportFile> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["csv", "tsv", "xlsx"].includes(extension ?? "")) throw new Error("Choose a CSV, TSV, or XLSX file. For RENPHO images or PDFs, select RENPHO report.");
  if (!file.size) throw new Error("The file is empty.");
  if (file.size > MAX_IMPORT_BYTES) throw new Error("Choose a file no larger than 2 MiB. Split large exports into smaller batches.");
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const fileHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  if (extension !== "xlsx") {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { fileName: file.name, fileHash, sheets: [{ name: extension === "tsv" ? "TSV" : "CSV", matrix: parseDelimited(text) }] };
  }
  validateXlsxArchive(bytes);
  const { read, utils, SSF } = await import("xlsx");
  const workbook = read(bytes, { type: "array", sheetRows: MAX_TABLE_ROWS + 1, cellFormula: true, cellNF: true, cellHTML: false, cellStyles: false, bookVBA: false, cellDates: false });
  if (!workbook.SheetNames.length || workbook.SheetNames.length > 30) throw new Error("Choose a workbook with 1–30 sheets.");
  const sheets = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    const range = utils.decode_range(sheet["!fullref"] || sheet["!ref"] || "A1");
    if (range.e.r >= MAX_TABLE_ROWS || range.e.c >= MAX_TABLE_COLUMNS) throw new Error(`Sheet “${name}” exceeds 5,000 records including the header, or 100 columns. Export a smaller table.`);
    const matrix: string[][] = [];
    for (let row = 0; row <= range.e.r; row++) {
      const values: string[] = [];
      for (let column = 0; column <= range.e.c; column++) {
        const cell = sheet[utils.encode_cell({ r: row, c: column })];
        if (!cell) { values.push(""); continue; }
        if (cell.f) { values.push("#FORMULA! Export values only for measured fields."); continue; }
        if (cell.v === undefined || cell.v === null) { values.push(""); continue; }
        if (cell.t === "e") { values.push(cell.w || "#ERROR!"); continue; }
        if (cell.t === "n" && cell.z && SSF.is_date(cell.z)) {
          const parsed = SSF.parse_date_code(Number(cell.v), { date1904: !!workbook.Workbook?.WBProps?.date1904 });
          const iso = parsed ? `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}` : "";
          try { values.push(parseMeasurementDate(iso, "ISO")); }
          catch { values.push("#INVALID_DATE!"); }
        } else if (cell.t === "n" && cell.z?.includes("%")) {
          values.push(cell.w || `${Number(cell.v) * 100}%`);
        } else {
          values.push(String(cell.v));
        }
      }
      matrix.push(values);
    }
    return { name, matrix };
  });
  return { fileName: file.name, fileHash, sheets };
}
