import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";

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
      writeLine(`${index + 1}. ${q.questionText}`, { size: 10.5 });
      writeLine(`[${q.marks} mark${q.marks === 1 ? "" : "s"}]`, { size: 9 });
      y += 6;
    });
  } else {
    writeLine(`Total Marks: ${totalMarks}`, { size: 10, center: true });
    y += 10;
    questions.forEach((q, index) => {
      ensureSpace(20);
      writeLine(`Question ${index + 1}`, { size: 11, bold: true });
      writeLine(q.answer, { size: 10 });
      writeLine(q.markscheme, { size: 9.5 });
      writeLine(`[${q.marks} mark${q.marks === 1 ? "" : "s"}]`, { size: 9 });
      y += 8;
    });
  }

  const filename = `${(details.assessmentTitle || "question-paper").replace(/\s+/g, "-").toLowerCase()}-${mode}.pdf`;
  doc.save(filename);
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
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: `${index + 1}. `, bold: true }), new TextRun({ text: q.questionText })],
        })
      );
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: `[${q.marks} mark${q.marks === 1 ? "" : "s"}]`, size: 18 })],
        })
      );
      paragraphs.push(new Paragraph({ text: "" }));
    });
  } else {
    paragraphs.push(
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Total Marks: ${totalMarks}`, size: 20 })] })
    );
    paragraphs.push(new Paragraph({ text: "" }));
    questions.forEach((q, index) => {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: `Question ${index + 1}`, bold: true })] }));
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: q.answer })] }));
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: q.markscheme, size: 20 })] }));
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: `[${q.marks} mark${q.marks === 1 ? "" : "s"}]`, size: 18 })] }));
      paragraphs.push(new Paragraph({ text: "" }));
    });
  }

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  const filename = `${(details.assessmentTitle || "question-paper").replace(/\s+/g, "-").toLowerCase()}-${mode}.docx`;
  downloadBlob(blob, filename);
}
