import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import { getQuestionMarks } from "../../../../data/questions/schema.js";

// PDF and Word export both build a real structured document from the paper
// data directly (not a screenshot of the DOM), so text stays selectable and
// file size stays small. Print uses the browser's native print dialog on
// the same on-screen preview instead (see the .qbuilder-print-area / print
// media rules in styles/index.css).

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildHeaderLines(details, mode) {
  const lines = [];
  if (details.schoolName) lines.push(details.schoolName.toUpperCase());
  lines.push("IB Diploma Programme");
  lines.push(details.subject || "Chemistry");
  if (mode === "markscheme") {
    lines.push(`Markscheme${details.assessmentTitle ? ` \u2014 ${details.assessmentTitle}` : ""}`);
  } else {
    const titleLine = [details.classGrade, details.assessmentTitle].filter(Boolean).join(" \u2013 ");
    if (titleLine) lines.push(titleLine);
  }
  return lines;
}

export function exportPdf({ draft, totalMarks, mode }) {
  const { details, questions } = draft;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 56;
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = doc.internal.pageSize.getWidth() - marginX * 2;
  let y = 64;

  function ensureSpace(lineHeight) {
    if (y + lineHeight > pageHeight - 56) {
      doc.addPage();
      y = 64;
    }
  }

  function writeLine(text, { size = 10, bold = false, center = false } = {}) {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      ensureSpace(size * 1.4);
      const x = center ? doc.internal.pageSize.getWidth() / 2 : marginX;
      doc.text(line, x, y, center ? { align: "center" } : undefined);
      y += size * 1.4;
    }
  }

  // Draws a question's stimulus as real vector content (lines/circles/text),
  // never a raster image — mirrors StimulusRenderer.jsx's data model exactly
  // so the PDF always matches what the teacher saw on screen.
  function drawStimulus(stimulus, indent = marginX + 14) {
    if (!stimulus) return;
    if (stimulus.intro) writeLine(stimulus.intro, { size: 9 });

    if (stimulus.type === "table") {
      ensureSpace(20);
      const colWidth = (maxWidth - (indent - marginX)) / stimulus.table.headers.length;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      stimulus.table.headers.forEach((h, i) => doc.text(String(h), indent + i * colWidth, y));
      y += 12;
      doc.setFont("helvetica", "normal");
      for (const row of stimulus.table.rows) {
        ensureSpace(12);
        row.forEach((cell, i) => doc.text(String(cell), indent + i * colWidth, y));
        y += 12;
      }
      y += 4;
    } else if (stimulus.type === "nuclide") {
      ensureSpace(34);
      let x = indent;
      for (const n of stimulus.nuclides) {
        if (n.label) {
          doc.setFontSize(8);
          doc.text(n.label, x + 10, y - 20);
        }
        doc.setFontSize(9);
        doc.text(String(n.massNumber), x, y - 8);
        doc.text(String(n.atomicNumber), x, y + 6);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(n.symbol, x + 14, y);
        const symbolW = doc.getTextWidth(n.symbol);
        doc.setFont("helvetica", "normal");
        if (n.charge) {
          doc.setFontSize(9);
          doc.text(String(n.charge), x + 14 + symbolW + 2, y - 8);
        }
        x += 14 + symbolW + (n.charge ? 16 : 4) + 20;
      }
      y += 26;
    } else if (stimulus.type === "mass-spectrum" || stimulus.type === "bar-chart") {
      const isSpectrum = stimulus.type === "mass-spectrum";
      const items = isSpectrum ? stimulus.peaks : stimulus.bars;
      const chartH = 90;
      ensureSpace(chartH + 30);
      const chartW = 260;
      const baseY = y + chartH;
      doc.setLineWidth(0.75);
      doc.line(indent, y, indent, baseY); // y-axis
      doc.line(indent, baseY, indent + chartW, baseY); // x-axis
      const maxVal = isSpectrum ? Math.max(...items.map((p) => p.abundance), 100) : Math.max(...items.map((b) => b.value), 100);
      const n = items.length;
      items.forEach((item, i) => {
        const val = isSpectrum ? item.abundance : item.value;
        const label = isSpectrum ? item.mz : item.label;
        const barH = (val / maxVal) * chartH;
        const x = indent + ((i + 1) / (n + 1)) * chartW;
        doc.line(x, baseY, x, baseY - barH);
        doc.setFontSize(7);
        doc.text(String(label), x, baseY + 10, { align: "center" });
      });
      doc.setFontSize(7);
      doc.text(stimulus.xLabel || "", indent + chartW / 2, baseY + 20, { align: "center" });
      y = baseY + 26;
    } else if (stimulus.type === "atom-diagram") {
      ensureSpace(60);
      const cx = indent + 30;
      const cy = y + 25;
      doc.setLineWidth(0.5);
      doc.circle(cx, cy, 24, "S");
      doc.circle(cx, cy, 8, "S");
      doc.setFontSize(8);
      doc.text("nucleus (protons + neutrons); outer shell: electrons", indent + 70, y + 25);
      y += 56;
    } else if (stimulus.type === "integrated") {
      for (const block of stimulus.blocks) drawStimulus(block, indent);
    } else if (stimulus.type === "emission-spectrum") {
      ensureSpace(40);
      const chartW = 220;
      const minNm = 380, maxNm = 750;
      const xFor = (nm) => indent + ((nm - minNm) / (maxNm - minNm)) * chartW;
      doc.setLineWidth(0.5);
      doc.rect(indent, y, chartW, 22, "S");
      if (stimulus.continuous) {
        doc.setFillColor(150, 150, 150);
        doc.rect(indent + 1, y + 1, chartW - 2, 20, "F");
      } else {
        doc.setLineWidth(1);
        for (const l of stimulus.lines) {
          const x = xFor(l.wavelength);
          doc.line(x, y + 1, x, y + 21);
        }
        doc.setFontSize(7);
        for (const l of stimulus.lines) doc.text(String(l.wavelength), xFor(l.wavelength), y + 32, { align: "center" });
      }
      y += 40;
    } else if (stimulus.type === "energy-level-diagram") {
      const chartH = 90, chartW = 180;
      ensureSpace(chartH + 20);
      const maxN = Math.max(...stimulus.levels);
      const converge = stimulus.converge !== false;
      const frac = (n) => (converge ? 1 - 1 / (n * n) : (n - 1) / (maxN - 1 || 1));
      const minFrac = frac(1), maxFrac = frac(maxN);
      const yFor = (n) => y + chartH - ((frac(n) - minFrac) / (maxFrac - minFrac || 1)) * chartH;
      doc.setLineWidth(0.75);
      doc.setFontSize(8);
      for (const n of stimulus.levels) {
        const ly = yFor(n);
        doc.line(indent + 24, ly, indent + chartW, ly);
        doc.text(`n=${n}`, indent, ly + 2);
      }
      (stimulus.transitions || []).forEach((t, i) => {
        const tx = indent + 34 + i * ((chartW - 40) / Math.max((stimulus.transitions || []).length - 1, 1));
        doc.line(tx, yFor(t.from), tx, yFor(t.to));
        doc.text(t.label ?? "", tx + 3, (yFor(t.from) + yFor(t.to)) / 2);
      });
      y += chartH + 14;
    } else if (stimulus.type === "orbital-shape") {
      ensureSpace(60);
      let x = indent + 20;
      doc.setLineWidth(0.75);
      doc.setFontSize(8);
      for (const s of stimulus.shapes) {
        if (s.kind === "s") {
          doc.circle(x, y + 20, 14, "S");
        } else {
          doc.ellipse(x - 10, y + 20, 9, 5, "S");
          doc.ellipse(x + 10, y + 20, 9, 5, "S");
        }
        doc.text(s.label ?? s.kind, x, y + 42, { align: "center" });
        x += 44;
      }
      y += 52;
    } else if (stimulus.type === "orbital-box") {
      for (const s of stimulus.subshells) {
        ensureSpace(16);
        doc.setFontSize(9);
        doc.text(s.label ?? "", indent, y + 8);
        let bx = indent + 28;
        doc.setLineWidth(0.5);
        for (const b of s.boxes) {
          doc.rect(bx, y, 14, 14, "S");
          const arrows = (b.spins || []).map((sp) => (sp === "up" ? "\u2191" : "\u2193")).join("");
          if (arrows) doc.text(arrows, bx + 7, y + 10, { align: "center" });
          bx += 16;
        }
        y += 20;
      }
      y += 4;
    } else if (stimulus.type === "ionization-graph") {
      const chartH = 90, chartW = 220;
      ensureSpace(chartH + 24);
      const values = stimulus.points.map((p) => p.value);
      const scale = (v) => (stimulus.logScale ? Math.log10(v) : v);
      const minV = Math.min(...values.map(scale));
      const maxV = Math.max(...values.map(scale));
      const xFor = (i) => indent + (i / (stimulus.points.length - 1 || 1)) * chartW;
      const yFor = (v) => y + chartH - ((scale(v) - minV) / (maxV - minV || 1)) * chartH;
      doc.setLineWidth(0.75);
      doc.line(indent, y, indent, y + chartH);
      doc.line(indent, y + chartH, indent + chartW, y + chartH);
      for (let i = 0; i < stimulus.points.length - 1; i += 1) {
        doc.line(xFor(i), yFor(stimulus.points[i].value), xFor(i + 1), yFor(stimulus.points[i + 1].value));
      }
      doc.setFontSize(7);
      stimulus.points.forEach((p, i) => {
        doc.circle(xFor(i), yFor(p.value), 1.2, "F");
        doc.text(String(p.label), xFor(i), y + chartH + 10, { align: "center" });
      });
      y += chartH + 18;
    }
  }

  const headerLines = buildHeaderLines(details, mode);
  headerLines.forEach((line, i) => writeLine(line, { size: i === 0 ? 14 : 11, bold: i === 0, center: true }));
  y += 6;

  if (mode === "paper") {
    writeLine(`Date: ${details.date || "__________"}    Duration: ${details.duration || "__________"}    Maximum Marks: ${details.maxMarks || totalMarks}`, { size: 10 });
    y += 6;
    if (details.instructions) {
      writeLine(details.instructions, { size: 9 });
      y += 8;
    }
    questions.forEach((q, index) => {
      ensureSpace(20);
      const marks = getQuestionMarks(q);
      writeLine(`${index + 1}. ${q.questionText}`, { size: 10.5 });
      if (q.stimulus) drawStimulus(q.stimulus);
      if (Array.isArray(q.parts) && q.parts.length > 0) {
        q.parts.forEach((part, i) => {
          writeLine(`(${part.id ?? String.fromCharCode(97 + i)}) ${part.questionText} [${part.marks}]`, { size: 9.5 });
        });
        writeLine(`[Total: ${marks}]`, { size: 9 });
      } else {
        writeLine(`[${marks} mark${marks === 1 ? "" : "s"}]`, { size: 9 });
      }
      y += 6;
    });
  } else {
    writeLine(`Total Marks: ${totalMarks}`, { size: 10, center: true });
    y += 10;
    questions.forEach((q, index) => {
      ensureSpace(20);
      const marks = getQuestionMarks(q);
      writeLine(`Question ${index + 1}`, { size: 11, bold: true });
      if (q.stimulus) drawStimulus(q.stimulus);
      if (Array.isArray(q.parts) && q.parts.length > 0) {
        q.parts.forEach((part, i) => {
          writeLine(`(${part.id ?? String.fromCharCode(97 + i)}) ${part.markscheme} [${part.marks}]`, { size: 9.5 });
        });
      } else {
        writeLine(q.questionType === "MCQ" ? `Correct answer: ${q.correctAnswer}` : q.answer, { size: 10 });
        writeLine(q.markscheme, { size: 9.5 });
      }
      writeLine(`[${marks} mark${marks === 1 ? "" : "s"}]`, { size: 9 });
      y += 8;
    });
  }

  const filename = `${(details.assessmentTitle || "question-paper").replace(/\s+/g, "-").toLowerCase()}-${mode}.pdf`;
  doc.save(filename);
}

// Word has no vector-drawing surface, so a stimulus becomes the clearest
// faithful TEXT representation of the same underlying data — nuclide
// notation via real Unicode super/subscript characters, spectra/bar charts
// as a labelled data list, tables as plain rows. Same source data as the
// PDF/on-screen versions; only the rendering technique differs.
const SUPERSCRIPT_DIGITS = { "0": "\u2070", "1": "\u00b9", "2": "\u00b2", "3": "\u00b3", "4": "\u2074", "5": "\u2075", "6": "\u2076", "7": "\u2077", "8": "\u2078", "9": "\u2079", "+": "\u207a", "-": "\u207b" };
const SUBSCRIPT_DIGITS = { "0": "\u2080", "1": "\u2081", "2": "\u2082", "3": "\u2083", "4": "\u2084", "5": "\u2085", "6": "\u2086", "7": "\u2087", "8": "\u2088", "9": "\u2089" };
function toSuper(s) { return String(s).split("").map((c) => SUPERSCRIPT_DIGITS[c] ?? c).join(""); }
function toSub(s) { return String(s).split("").map((c) => SUBSCRIPT_DIGITS[c] ?? c).join(""); }

function stimulusParagraphs(stimulus) {
  const paragraphs = [];
  if (!stimulus) return paragraphs;
  if (stimulus.intro) paragraphs.push(new Paragraph({ children: [new TextRun({ text: stimulus.intro, italics: true, size: 18 })] }));

  if (stimulus.type === "table") {
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: stimulus.table.headers.join("  |  "), bold: true, size: 18 })] }));
    for (const row of stimulus.table.rows) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: row.join("  |  "), size: 18 })] }));
    }
  } else if (stimulus.type === "nuclide") {
    const text = stimulus.nuclides
      .map((n) => `${n.label ? `${n.label}: ` : ""}${toSuper(n.massNumber)}${toSub(n.atomicNumber)}${n.symbol}${n.charge ? toSuper(n.charge) : ""}`)
      .join("    ");
    paragraphs.push(new Paragraph({ children: [new TextRun({ text, size: 24 })] }));
  } else if (stimulus.type === "mass-spectrum" || stimulus.type === "bar-chart") {
    const isSpectrum = stimulus.type === "mass-spectrum";
    const items = isSpectrum ? stimulus.peaks : stimulus.bars;
    const line = items.map((item) => (isSpectrum ? `m/z ${item.mz}: ${item.abundance}%` : `${item.label}: ${item.value}%`)).join("   ");
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: `[${isSpectrum ? "Mass spectrum" : "Bar chart"} data] ${line}`, size: 18 })] }));
  } else if (stimulus.type === "atom-diagram") {
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: "[Diagram: central nucleus of protons and neutrons, surrounded by an electron shell]", italics: true, size: 18 })] }));
  } else if (stimulus.type === "emission-spectrum") {
    const text = stimulus.continuous
      ? "[Continuous spectrum \u2014 uninterrupted band]"
      : `[Line spectrum] ${stimulus.lines.map((l) => `${l.wavelength} nm`).join("   ")}`;
    paragraphs.push(new Paragraph({ children: [new TextRun({ text, italics: true, size: 18 })] }));
  } else if (stimulus.type === "energy-level-diagram") {
    const levelsText = `Levels: ${stimulus.levels.map((n) => `n=${n}`).join(", ")}`;
    const transitionsText = (stimulus.transitions || []).map((t) => `${t.label ?? ""}: n=${t.from}\u2192n=${t.to}`).join("   ");
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: `[Energy level diagram] ${levelsText}${transitionsText ? `   ${transitionsText}` : ""}`, italics: true, size: 18 })] }));
  } else if (stimulus.type === "orbital-shape") {
    const text = stimulus.shapes.map((s) => `${s.label ?? s.kind} (${s.kind === "s" ? "spherical" : `dumbbell along ${s.kind.slice(1)}`})`).join("   ");
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: `[Orbital shapes] ${text}`, italics: true, size: 18 })] }));
  } else if (stimulus.type === "orbital-box") {
    for (const s of stimulus.subshells) {
      const boxesText = s.boxes.map((b) => `[${(b.spins || []).map((sp) => (sp === "up" ? "\u2191" : "\u2193")).join("")}]`).join(" ");
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: `${s.label ?? ""}  ${boxesText}`, size: 22 })] }));
    }
  } else if (stimulus.type === "ionization-graph") {
    const line = stimulus.points.map((p) => `${p.label}: ${p.value}`).join("   ");
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: `[Ionization energy graph]${stimulus.logScale ? " (log scale)" : ""} ${line}`, italics: true, size: 18 })] }));
  } else if (stimulus.type === "integrated") {
    for (const block of stimulus.blocks) paragraphs.push(...stimulusParagraphs(block));
  }
  return paragraphs;
}

export async function exportDocx({ draft, totalMarks, mode }) {
  const { details, questions } = draft;
  const headerLines = buildHeaderLines(details, mode);

  const paragraphs = headerLines.map(
    (line, i) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: line, bold: i === 0, size: i === 0 ? 28 : 22 })],
      })
  );

  paragraphs.push(new Paragraph({ text: "" }));

  if (mode === "paper") {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Date: ${details.date || "__________"}    Duration: ${details.duration || "__________"}    Maximum Marks: ${details.maxMarks || totalMarks}`,
            size: 20,
          }),
        ],
      })
    );
    if (details.instructions) {
      paragraphs.push(new Paragraph({ text: "" }));
      details.instructions.split("\n").forEach((line) => {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: line, italics: true, size: 18 })] }));
      });
    }
    paragraphs.push(new Paragraph({ text: "" }));
    questions.forEach((q, index) => {
      const marks = getQuestionMarks(q);
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: `${index + 1}. `, bold: true }), new TextRun({ text: q.questionText })],
        })
      );
      paragraphs.push(...stimulusParagraphs(q.stimulus));
      if (Array.isArray(q.parts) && q.parts.length > 0) {
        q.parts.forEach((part, i) => {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: `(${part.id ?? String.fromCharCode(97 + i)}) ${part.questionText} [${part.marks}]`, size: 20 })],
            })
          );
        });
        paragraphs.push(
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `[Total: ${marks}]`, size: 18 })] })
        );
      } else {
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: `[${marks} mark${marks === 1 ? "" : "s"}]`, size: 18 })],
          })
        );
      }
      paragraphs.push(new Paragraph({ text: "" }));
    });
  } else {
    paragraphs.push(
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Total Marks: ${totalMarks}`, size: 20 })] })
    );
    paragraphs.push(new Paragraph({ text: "" }));
    questions.forEach((q, index) => {
      const marks = getQuestionMarks(q);
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: `Question ${index + 1}`, bold: true })] }));
      paragraphs.push(...stimulusParagraphs(q.stimulus));
      if (Array.isArray(q.parts) && q.parts.length > 0) {
        q.parts.forEach((part, i) => {
          paragraphs.push(
            new Paragraph({ children: [new TextRun({ text: `(${part.id ?? String.fromCharCode(97 + i)}) ${part.markscheme} [${part.marks}]`, size: 20 })] })
          );
        });
      } else {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: q.questionType === "MCQ" ? `Correct answer: ${q.correctAnswer}` : q.answer })] }));
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: q.markscheme, size: 20 })] }));
      }
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: `[${marks} mark${marks === 1 ? "" : "s"}]`, size: 18 })] }));
      paragraphs.push(new Paragraph({ text: "" }));
    });
  }

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  const filename = `${(details.assessmentTitle || "question-paper").replace(/\s+/g, "-").toLowerCase()}-${mode}.docx`;
  downloadBlob(blob, filename);
}
