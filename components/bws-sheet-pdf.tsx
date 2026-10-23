"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import type { SheetHitter, SheetPitcher } from "@/lib/bws-arsenal-sheet-server";

type Props = { title: string; subtitle: string; footnote: string; fileName: string } & ({ kind: "pitchers"; pitchers: SheetPitcher[] } | { kind: "hitters"; hitters: SheetHitter[] });
const hex = (color: string) => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)) as [number, number, number];
const ip = (outs: number | null) => outs === null ? "-" : `${Math.floor(outs / 3)}.${outs % 3}`;
const HITTER_STATS = [["batting_avg", "AVG"], ["batting_obp", "OBP"], ["batting_est_slg", "SLG"], ["batting_est_iso", "ISO"], ["batting_k_pct", "K%"], ["batting_bb_pct", "BB%"], ["qpa_pct", "QPA%"], ["batting_hh_pct", "HH%"], ["batting_8plus_pct", "8+ Pitch"], ["pumps", "HR"], ["sb", "SB"]] as const;

/** Builds the dugout sheet as a real PDF in the browser (landscape letter, four cards across). Nothing is uploaded. */
export function BwsSheetPdfButton(props: Props) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
      const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 24, cols = 4, gap = 8;
      const cardW = (W - 2 * M - gap * (cols - 1)) / cols, cardH = props.kind === "pitchers" ? 118 : 128;
      const header = () => {
        doc.setFillColor(200, 16, 46); doc.rect(M, M + 30, W - 2 * M, 2.5, "F");
        doc.setTextColor(17, 19, 24); doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.text(props.title.toUpperCase(), M, M + 14);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(91, 95, 105); doc.text(props.subtitle, M, M + 26);
      };
      header();
      const top = M + 42, rowsPerPage = Math.max(1, Math.floor((H - top - M - 18) / (cardH + gap)));
      const items = props.kind === "pitchers" ? props.pitchers : props.hitters;
      items.forEach((item, index) => {
        const slot = index % (cols * rowsPerPage);
        if (index > 0 && slot === 0) { doc.addPage(); header(); }
        const x = M + (slot % cols) * (cardW + gap), y = top + Math.floor(slot / cols) * (cardH + gap);
        doc.setDrawColor(217, 219, 224); doc.setLineWidth(0.8); doc.roundedRect(x, y, cardW, cardH, 5, 5, "S");
        const pad = 7; let cy = y + 15;
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(17, 19, 24); doc.text(item.name, x + pad, cy, { maxWidth: cardW - 52 });
        const tag = props.kind === "pitchers" ? ((item as SheetPitcher).throws ? `${(item as SheetPitcher).throws}HP` : "-") : ((item as SheetHitter).bats ? `Bats ${(item as SheetHitter).bats}` : "-");
        const lefty = props.kind === "pitchers" ? (item as SheetPitcher).throws === "L" : (item as SheetHitter).bats === "L";
        doc.setFontSize(7.5); const tw = doc.getTextWidth(tag) + 8;
        if (lefty) doc.setFillColor(200, 16, 46); else doc.setFillColor(233, 234, 238);
        doc.roundedRect(x + cardW - pad - tw, cy - 8, tw, 11, 5, 5, "F"); doc.setTextColor(lefty ? 255 : 17, lefty ? 255 : 19, lefty ? 255 : 24); doc.text(tag, x + cardW - pad - tw + 4, cy);
        doc.setFont("helvetica", "normal"); doc.setTextColor(91, 95, 105); doc.setFontSize(7.5);
        if (props.kind === "pitchers") {
          const p = item as SheetPitcher;
          cy += 11; doc.text(`${ip(p.outs)} IP${p.academicClass ? ` · ${p.academicClass}` : ""}${p.manualFrom ? " · from sheet, not synced" : ""}`, x + pad, cy, { maxWidth: cardW - 2 * pad });
          cy += 10; doc.text(p.line.map(l => `${l.label} ${l.value}`).join(" · "), x + pad, cy, { maxWidth: cardW - 2 * pad });
          cy += 8;
          if (p.mix) {
            const barW = cardW - 2 * pad; let bx = x + pad;
            doc.setFillColor(236, 238, 241); doc.rect(bx, cy, barW, 12, "F");
            for (const f of p.mix.families) { const w = barW * f.pitches / p.mix.total; doc.setFillColor(...hex(f.color)); doc.rect(bx, cy, w, 12, "F");
              if (f.pitches / p.mix.total >= 0.12) { doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text(`${Math.round(100 * f.pitches / p.mix.total)}%`, bx + w / 2, cy + 8.5, { align: "center" }); }
              bx += w; }
            cy += 22; doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(17, 19, 24);
            for (const f of p.mix.families) { const s = p.familyStrike.find(v => v.label === f.label);
              doc.setFillColor(...hex(f.color)); doc.rect(x + pad, cy - 6, 6, 6, "F");
              doc.text(`${f.label.replace(" Family", "")}  ${Math.round(100 * f.pitches / p.mix.total)}%${s?.strikePct != null ? `  ·  ${s.strikePct.toFixed(0)}% strikes` : ""}`, x + pad + 10, cy); cy += 11; }
            doc.setTextColor(91, 95, 105); doc.setFontSize(7.5); doc.text(`${p.mix.total} game pitches${p.mix.unrecorded ? ` · ${p.mix.unrecorded} family not recorded` : ""}`, x + pad, cy);
          } else { cy += 8; doc.text("No game-sheet pitch mix yet.", x + pad, cy); }
        } else {
          const h = item as SheetHitter;
          cy += 11; doc.text(`${h.position || "-"} · ${h.pa ?? "-"} PA${h.pa !== null && h.pa < 10 ? " · small sample" : ""}`, x + pad, cy);
          cy += 20; doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(17, 19, 24); doc.text(h.stats.batting_ops?.value ?? "-", x + pad, cy);
          const opsW = doc.getTextWidth(h.stats.batting_ops?.value ?? "-"); doc.setFontSize(7.5); doc.setTextColor(91, 95, 105); doc.text("OPS", x + pad + opsW + 3, cy);
          let tx = x + cardW - pad; doc.setFont("helvetica", "bold"); doc.setFontSize(7);
          for (const t of [...h.tags].reverse()) { const w = doc.getTextWidth(t) + 8; tx -= w; if (tx < x + pad + opsW + 22) break; doc.setFillColor(251, 228, 231); doc.roundedRect(tx, cy - 8, w, 11, 5, 5, "F"); doc.setTextColor(160, 13, 37); doc.text(t, tx + 4, cy); tx -= 3; }
          cy += 8; const colW = (cardW - 2 * pad) / 4;
          HITTER_STATS.forEach(([key, label], i) => { const cx = x + pad + (i % 4) * colW, ry = cy + Math.floor(i / 4) * 21;
            doc.setDrawColor(238, 240, 242); doc.line(cx, ry, cx + colW - 4, ry);
            doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(91, 95, 105); doc.text(label, cx, ry + 8);
            doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(17, 19, 24); doc.text(h.stats[key]?.value ?? "-", cx, ry + 17); });
        }
      });
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(91, 95, 105); doc.text(props.footnote, M, H - M + 6, { maxWidth: W - 2 * M - 40 }); doc.text(`${i}/${pages}`, W - M, H - M + 6, { align: "right" }); }
      doc.save(props.fileName);
    } finally { setBusy(false); }
  }
  return <button type="button" className="btn btn-primary no-print" onClick={download} disabled={busy}><Download size={16} aria-hidden="true"/>{busy ? "Building PDF…" : "Download PDF"}</button>;
}
