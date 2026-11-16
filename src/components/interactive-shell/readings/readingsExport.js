// Browser-only helpers for the Readings export buttons. Kept apart from readingsModel.js so the model stays pure.

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** UTF-8 with a BOM so Excel reads dm³, °C, − correctly. */
export function downloadCSV(text, filename) { downloadBlob(new Blob(["﻿", text], { type: "text/csv;charset=utf-8" }), filename); }

/** Rasterise SVG markup (a string with literal colours and explicit width/height/viewBox) to a PNG Blob at `scale`x.
 *  Transparent background unless `background` is given. */
export function svgMarkupToPngBlob(markup, width, height, { scale = 2, background = null } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext("2d");
        if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png");
      };
      img.onerror = () => reject(new Error("PNG export failed"));
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    } catch (e) { reject(e); }
  });
}
