import { useRef, useState } from "react";
import { Link2, UploadCloud, Loader2, Image as ImageIcon, Video, X } from "lucide-react";
import { uploadLearnMedia, validateLearnMediaFile } from "../../lib/learnContentService.js";

const inputCls = "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-indigo)] focus:outline-none";

export default function LearnMediaInput({ kind, pageId, blockId, url = "", onUrlChange, label }) {
  const [mode, setMode] = useState("link");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const isImage = kind === "image";

  async function handleFile(file) {
    const validation = validateLearnMediaFile(file, kind);
    if (validation) { setError(validation); return; }
    setError("");
    setUploading(true);
    try {
      const uploaded = await uploadLearnMedia(pageId, blockId, file, kind);
      onUrlChange(uploaded.url);
      setMode("upload");
    } catch (err) {
      setError(err.message || `Could not upload ${kind}.`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {label && <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]">{label}</label>}
      <div className="mb-2 inline-flex rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-0.5">
        <button type="button" onClick={() => setMode("link")} className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium ${mode === "link" ? "bg-[var(--color-ink)] text-[var(--color-paper)]" : "text-[var(--color-ink-soft)]"}`}><Link2 size={12} /> Link</button>
        <button type="button" onClick={() => setMode("upload")} className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium ${mode === "upload" ? "bg-[var(--color-ink)] text-[var(--color-paper)]" : "text-[var(--color-ink-soft)]"}`}><UploadCloud size={12} /> Upload</button>
      </div>

      {mode === "link" ? (
        <input className={inputCls} value={url} onChange={(e) => onUrlChange(e.target.value)} placeholder={isImage ? "https://... image URL" : "YouTube/Vimeo or direct video URL"} />
      ) : (
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }} className="rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-paper)] p-4 text-center">
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-[var(--color-ink-soft)]"><Loader2 size={16} className="animate-spin" /> Uploading…</div>
          ) : (
            <>
              {isImage ? <ImageIcon size={20} className="mx-auto text-[var(--color-ink-faint)]" /> : <Video size={20} className="mx-auto text-[var(--color-ink-faint)]" />}
              <button type="button" onClick={() => inputRef.current?.click()} className="mt-2 rounded-md bg-[var(--color-indigo)] px-3 py-2 text-xs font-semibold text-white">Choose {isImage ? "Image" : "Video"}</button>
              <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">Choose a file or drag & drop · {isImage ? "PNG, JPG, WEBP or GIF · max 8 MB" : "MP4, WEBM or MOV · max 100 MB"}</p>
            </>
          )}
          <input ref={inputRef} type="file" className="hidden" accept={isImage ? "image/png,image/jpeg,image/webp,image/gif" : "video/mp4,video/webm,video/quicktime"} onChange={(e) => handleFile(e.target.files?.[0])} />
        </div>
      )}

      {url && (
        <div className="mt-2 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-2">
          {isImage && <img src={url} alt="Selected media preview" className="mb-2 max-h-40 rounded-md border border-[var(--color-line)] bg-white object-contain" />}
          {!isImage && /\.(mp4|webm|mov)(\?|#|$)/i.test(url) && <video src={url} controls preload="metadata" className="mb-2 max-h-48 w-full rounded-md bg-black" />}
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-[var(--color-ink-soft)]">Media attached</span>
            <button type="button" onClick={() => onUrlChange("")} className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--color-coral)]"><X size={12} /> Clear</button>
          </div>
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-[var(--color-coral)]">{error}</p>}
    </div>
  );
}
