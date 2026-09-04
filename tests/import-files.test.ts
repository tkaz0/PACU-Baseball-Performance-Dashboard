import { describe, expect, it } from "vitest";
import { utils, write, type WorkBook, type WorkSheet } from "xlsx";
import { readImportFile } from "@/lib/imports/files";
import { MAX_IMPORT_BYTES, MAX_TABLE_ROWS, parseMeasurementDate, selectTable } from "@/lib/imports/engine";

function workbook(sheets: [string, WorkSheet][], date1904 = false): WorkBook {
  const book = utils.book_new();
  for (const [name, sheet] of sheets) utils.book_append_sheet(book, sheet, name);
  if (date1904) book.Workbook = { WBProps: { date1904: true } };
  return book;
}
function xlsxFile(book: WorkBook, compression = true): File {
  return new File([write(book, { type: "array", bookType: "xlsx", compression })], "fictional-tests.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
function sampleFile() {
  return xlsxFile(workbook([["Tests", utils.aoa_to_sheet([["Athlete", "Test"], ["LOCAL-0001", 0]])]]));
}
function firstCentralDirectory(bytes: ArrayBuffer) {
  const view = new DataView(bytes);
  for (let position = view.byteLength - 22; position >= 0; position--) {
    if (view.getUint32(position, true) === 0x06054b50 && position + 22 + view.getUint16(position + 20, true) === view.byteLength) return { end: position, entry: view.getUint32(position + 16, true), view };
  }
  throw new Error("Synthetic test archive has no directory.");
}

describe("user-selected CSV and TSV files", () => {
  it("decodes UTF-8 BOM, quotes, CRLF and tabs and computes a deterministic byte hash", async () => {
    const csv = new File(['\uFEFFName,Note\r\n"Fictional, Example","quoted ""text"""\r\n'], "fictional.CSV");
    const parsed = await readImportFile(csv);
    expect(parsed.fileName).toBe("fictional.CSV");
    expect(parsed.fileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.sheets).toEqual([{ name: "CSV", matrix: [["Name", "Note"], ["Fictional, Example", 'quoted "text"']] }]);
    const renamed = await readImportFile(new File([await csv.arrayBuffer()], "renamed.csv"));
    expect(renamed.fileHash).toBe(parsed.fileHash);
    const tsv = await readImportFile(new File(["Athlete\tTest\r\nLOCAL-0001\t0\r\n"], "fictional.tsv"));
    expect(tsv.sheets).toEqual([{ name: "TSV", matrix: [["Athlete", "Test"], ["LOCAL-0001", "0"]] }]);
  });
  it("rejects unsupported extensions, empty files, oversized files and invalid UTF-8", async () => {
    await expect(readImportFile(new File(["text"], "report.pdf"))).rejects.toThrow("CSV, TSV, or XLSX");
    await expect(readImportFile(new File([], "empty.csv"))).rejects.toThrow("empty");
    await expect(readImportFile(new File([new Uint8Array(MAX_IMPORT_BYTES + 1)], "large.csv"))).rejects.toThrow("2 MiB");
    await expect(readImportFile(new File([new Uint8Array([0xff, 0xfe, 0xfa])], "bad.csv"))).rejects.toThrow();
  });
});

describe("synthetic XLSX files", () => {
  it.each([true, false])("reads multiple sheets, unnamed header positions, zero and missing cells (compression=%s)", async compression => {
    const first = utils.aoa_to_sheet([[undefined, "Player", "Weight", "Optional"], [1, "Fictional Example", 0], [2, "Fictional Other", undefined, "text"]]);
    const second = utils.aoa_to_sheet([["Athlete", "Test"], ["LOCAL-0001", -1.25]]);
    const parsed = await readImportFile(xlsxFile(workbook([["Roster metrics", first], ["Other tests", second]]), compression));
    expect(parsed.sheets.map(sheet => sheet.name)).toEqual(["Roster metrics", "Other tests"]);
    expect(parsed.sheets[0].matrix).toEqual([["", "Player", "Weight", "Optional"], ["1", "Fictional Example", "0", ""], ["2", "Fictional Other", "", "text"]]);
    expect(selectTable(parsed.sheets[0].matrix, 0).headers[0]).toBe("Column 1 (unnamed)");
    expect(parsed.sheets[1].matrix[1][1]).toBe("-1.25");
  });
  it("preserves leading/interior blank rows so sheet row references remain exact", async () => {
    const sheet = utils.aoa_to_sheet([[], [], ["Athlete", "Test"], [], ["LOCAL-0001", 5]]);
    const parsed = await readImportFile(xlsxFile(workbook([["Sparse", sheet]])));
    const selected = selectTable(parsed.sheets[0].matrix, 2);
    expect(selected.rowNumbers).toEqual([5]);
    expect(selected.rows).toEqual([["LOCAL-0001", "5"]]);
  });
  it("converts real dates under Excel's 1900 date system and flags its fictitious leap day", async () => {
    const sheet = utils.aoa_to_sheet([["Date"], [1], [59], [60], [61], [0], [-1]]);
    for (let row = 2; row <= 7; row++) sheet[`A${row}`].z = "yyyy-mm-dd";
    const parsed = await readImportFile(xlsxFile(workbook([["Dates", sheet]])));
    expect(parsed.sheets[0].matrix.slice(1).map(row => row[0])).toEqual(["1900-01-01", "1900-02-28", "#INVALID_DATE!", "1900-03-01", "#INVALID_DATE!", "#INVALID_DATE!"]);
    expect(parseMeasurementDate(parsed.sheets[0].matrix[1][0], "ISO")).toBe("1900-01-01");
  });
  it("honors Excel's 1904 date system without a four-year shift", async () => {
    const sheet = utils.aoa_to_sheet([["Date"], [0], [1], [59], [60]]);
    for (let row = 2; row <= 5; row++) sheet[`A${row}`].z = "yyyy-mm-dd";
    const parsed = await readImportFile(xlsxFile(workbook([["Dates", sheet]], true)));
    expect(parsed.sheets[0].matrix.slice(1).map(row => row[0])).toEqual(["1904-01-01", "1904-01-02", "1904-02-29", "1904-03-01"]);
  });
  it("marks cached and uncached formula cells and retains explicit source error values", async () => {
    const sheet = utils.aoa_to_sheet([["Athlete", "Cached formula", "Uncached formula", "Source error"], ["LOCAL-0001", 2, 0, 0]]);
    sheet.B2 = { t: "n", f: "1+1", v: 2 };
    sheet.C2 = { t: "n", f: "1+2" };
    sheet.D2 = { t: "e", v: 0x07 };
    const parsed = await readImportFile(xlsxFile(workbook([["Formula cells", sheet]])));
    expect(parsed.sheets[0].matrix[1]).toEqual(["LOCAL-0001", "#FORMULA! Export values only for measured fields.", "#FORMULA! Export values only for measured fields.", "#DIV/0!"]);
  });
  it("retains percent markers and raw numeric measurements without guessing custom-format units", async () => {
    const sheet = utils.aoa_to_sheet([["Athlete", "Percent", "Weight"], ["LOCAL-0001", 0.15, 72.5]]);
    sheet.B2.z = "0.0%";
    sheet.C2.z = '0.0 "kg"';
    const parsed = await readImportFile(xlsxFile(workbook([["Formatting", sheet]])));
    expect(parsed.sheets[0].matrix[1]).toEqual(["LOCAL-0001", "15.0%", "72.5"]);
  });
  it("accepts exactly 5,000 records including the header and rejects one additional record", async () => {
    const accepted = utils.aoa_to_sheet([["Athlete"], ...Array.from({ length: MAX_TABLE_ROWS - 1 }, () => ["LOCAL-0001"])]);
    const parsed = await readImportFile(xlsxFile(workbook([["At limit", accepted]])));
    expect(parsed.sheets[0].matrix).toHaveLength(MAX_TABLE_ROWS);
    expect(selectTable(parsed.sheets[0].matrix, 0).rows).toHaveLength(MAX_TABLE_ROWS - 1);
    accepted[`A${MAX_TABLE_ROWS + 1}`] = { t: "s", v: "LOCAL-0001" };
    accepted["!ref"] = `A1:A${MAX_TABLE_ROWS + 1}`;
    await expect(readImportFile(xlsxFile(workbook([["Too many records", accepted]])))).rejects.toThrow("including the header");
  });
  it("rejects excessive sheet and column counts", async () => {
    const sheets: [string, WorkSheet][] = Array.from({ length: 31 }, (_, index) => [`Sheet${index + 1}`, utils.aoa_to_sheet([["Athlete"], ["LOCAL-0001"]])]);
    await expect(readImportFile(xlsxFile(workbook(sheets)))).rejects.toThrow("1–30 sheets");
    const wide = utils.aoa_to_sheet([Array.from({ length: 101 }, (_, index) => `Column${index + 1}`)]);
    await expect(readImportFile(xlsxFile(workbook([["Too wide", wide]])))).rejects.toThrow("100 columns");
  });
});

describe("XLSX archive preflight", () => {
  it("rejects non-ZIP content, truncated archives and invalid directory sizes", async () => {
    await expect(readImportFile(new File(["PK definitely not an archive"], "invalid.xlsx"))).rejects.toThrow("invalid or unsupported");
    const bytes = await sampleFile().arrayBuffer();
    await expect(readImportFile(new File([bytes.slice(0, -20)], "truncated.xlsx"))).rejects.toThrow("invalid or unsupported");
    const { end, view } = firstCentralDirectory(bytes);
    view.setUint32(end + 12, view.getUint32(end + 12, true) + 1, true);
    await expect(readImportFile(new File([bytes], "bad-directory.xlsx"))).rejects.toThrow("invalid or unsupported");
  });
  it("rejects a compressed workbook declaring excessive uncompressed content before parsing", async () => {
    const bytes = await sampleFile().arrayBuffer();
    const { entry, view } = firstCentralDirectory(bytes);
    view.setUint32(entry + 24, 20 * 1024 * 1024 + 1, true);
    await expect(readImportFile(new File([bytes], "oversized-expanded.xlsx"))).rejects.toThrow("20 MiB");
  });
  it("rejects unsupported encryption, ZIP64 entry count, and entries pointing outside the archive", async () => {
    for (const mutation of ["encrypted", "zip64", "outside"] as const) {
      const bytes = await sampleFile().arrayBuffer();
      const { entry, end, view } = firstCentralDirectory(bytes);
      if (mutation === "encrypted") view.setUint16(entry + 8, view.getUint16(entry + 8, true) | 1, true);
      else if (mutation === "zip64") { view.setUint16(end + 8, 0xffff, true); view.setUint16(end + 10, 0xffff, true); }
      else view.setUint32(entry + 42, bytes.byteLength, true);
      await expect(readImportFile(new File([bytes], `${mutation}.xlsx`))).rejects.toThrow("invalid or unsupported");
    }
  });
});
