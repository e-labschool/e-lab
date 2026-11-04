import { useState, useRef } from "react";
import { UploadCloud, FileCheck2, XCircle, Loader2, X } from "lucide-react";
import { validateResourceFile } from "../../../lib/resourceService.js";

// Deliberately dumb about WHERE the file goes — this component only picks
// a validated File and hands it up via onFileSelected; ResourceForm
// decides when to actually call uploadResourceFile (on save), so a
// student navigating away mid-form never leaves an orphaned Storage
// object from a file that was dropped but the form was never submitted.
export default function ResourceUploader({ file, onFileSelected, uploading, uploadError, existingFileName }) {
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState(null);
  const inputRef = useRef(null);

  function handleFiles(fileList) {
    const selected = fileList?.[0];
    if (!selected) return;
    const error = validateResourceFile(selected);
    if (error) {
      setLocalError(error);
      return;
    }
    setLocalError(null);
    onFileSelected(selected);
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragOver ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)]" : "border-[var(--color-line)]"
        }`}
      >
        {uploading ? (
          <>
            <Loader2 size={22} className="animate-spin text-[var(--color-ink-faint)]" />
            <p className="text-sm text-[var(--color-ink-soft)]">Uploading…</p>
          </>
        ) : file ? (
          <>
            <FileCheck2 size={22} className="text-[var(--color-teal)]" />
            <p className="text-sm font-medium text-[var(--color-ink)]">{file.name}</p>
            <p className="text-xs text-[var(--color-ink-faint)]">{(file.size / 1024).toFixed(0)} KB</p>
            <button
              type="button"
              onClick={() => { onFileSelected(null); setLocalError(null); }}
              className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-coral)]"
            >
              <X size={12} /> Remove
            </button>
          </>
        ) : (
          <>
            <UploadCloud size={22} className="text-[var(--color-ink-faint)]" />
            <p className="text-sm text-[var(--color-ink)]">Drag & drop your file</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-sm font-medium text-[var(--color-indigo)] hover:underline"
            >
              or Browse Files
            </button>
            <p className="text-xs text-[var(--color-ink-faint)]">PDF &middot; DOCX &middot; PPTX &middot; XLSX</p>
            {existingFileName && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">Current file: {existingFileName} (leave empty to keep it)</p>}
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.xlsx"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {(localError || uploadError) && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-coral)]">
          <XCircle size={13} /> {localError || uploadError}
        </p>
      )}
    </div>
  );
}
