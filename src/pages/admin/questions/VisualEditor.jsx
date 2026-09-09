import { useState } from "react";
import { Upload, Sparkles, Trash2, Plus, Loader2, X } from "lucide-react";
import { getVisualTypeCategories, VISUAL_FIELD_DEFS, getDefaultContentForType } from "./visualEditorRegistry.js";
import { uploadQuestionImage } from "../../../lib/questionBankService.js";
import StimulusRenderer from "../../teacher/qbuilder/components/visuals/StimulusRenderer.jsx";
import { validateStimulus } from "../../../lib/stimulusSchema.js";
import Button from "../../../components/ui/Button.jsx";

const inputCls = "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";

// The Admin preview below is the EXACT same StimulusRenderer component
// Assess uses — never a separate fake preview — so what Admin sees here
// is guaranteed to match what a student would see.
function LivePreview({ content, questionId }) {
  if (!content) {
    return <p className="text-xs text-[var(--color-ink-faint)]">No visual configured.</p>;
  }
  const { valid } = validateStimulus(content);
  if (!valid) {
    return <p className="text-xs text-[var(--color-amber)]">Complete the required visual fields to preview.</p>;
  }
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-white p-4">
      <StimulusRenderer stimulus={content} questionId={questionId} />
    </div>
  );
}

function FieldInput({ field, value, onChange }) {
  if (field.type === "select") {
    return (
      <select className={inputCls} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select {field.label.toLowerCase()}</option>
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
        <input type="checkbox" checked={value !== false} onChange={(e) => onChange(e.target.checked)} /> {field.label}
      </label>
    );
  }
  if (field.type === "number") {
    return <input type="number" className={inputCls} value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} />;
  }
  if (field.type === "array-text") {
    const items = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input className={inputCls} value={item} onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))} />
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-xs text-[var(--color-coral)]"><X size={13} /></button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, ""])} className="text-xs font-medium text-[var(--color-indigo)]"><Plus size={12} className="inline" /> Add</button>
      </div>
    );
  }
  if (field.type === "array-object") {
    const items = Array.isArray(value) ? value : [];
    function updateItem(i, key, v) {
      onChange(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));
    }
    return (
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-[var(--color-line)] p-2">
            {field.itemFields.map((itemField) => (
              <input
                key={itemField.key}
                className={inputCls}
                placeholder={itemField.label}
                type={itemField.type === "number" ? "number" : "text"}
                value={item?.[itemField.key] ?? ""}
                onChange={(e) => updateItem(i, itemField.key, itemField.type === "number" ? Number(e.target.value) : e.target.value)}
              />
            ))}
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-xs text-[var(--color-coral)]"><X size={13} /></button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, {}])} className="text-xs font-medium text-[var(--color-indigo)]"><Plus size={12} className="inline" /> Add</button>
      </div>
    );
  }
  return <input className={inputCls} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}

export default function VisualEditor({ questionId, content, onChange }) {
  const [picking, setPicking] = useState(false);
  const [creatingType, setCreatingType] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setUploadError("Only PNG, JPG, or WEBP images are supported.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be 5 MB or smaller.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadQuestionImage(questionId, file);
      onChange({ type: "image", src: url, alt: "", caption: "", credit: "" });
      setPicking(false);
    } catch (err) {
      setUploadError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleSelectType(typeId) {
    onChange(getDefaultContentForType(typeId));
    setCreatingType(typeId);
    setPicking(false);
  }

  function handleRemove() {
    onChange(null);
    setConfirmRemove(false);
    setCreatingType(null);
  }

  const currentType = content?.type;
  const fieldDefs = currentType ? VISUAL_FIELD_DEFS[currentType] : null;

  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
      <p className="text-sm font-semibold text-[var(--color-ink)]">Visual / Stimulus</p>

      {!content && !picking && (
        <Button className="mt-3" variant="secondary" onClick={() => setPicking(true)}><Plus size={14} /> Add Visual</Button>
      )}

      {picking && (
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-2 text-sm hover:border-[var(--color-indigo)]">
            <Upload size={14} /> Upload Image
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileSelect} />
          </label>
          <button type="button" onClick={() => setCreatingType("picker")} className="flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-2 text-sm hover:border-[var(--color-indigo)]">
            <Sparkles size={14} /> Create e-Lab Visual
          </button>
        </div>
      )}

      {uploading && <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-ink-faint)]"><Loader2 className="h-3 w-3 animate-spin" /> Uploading\u2026</p>}
      {uploadError && <p className="mt-2 text-xs text-[var(--color-coral)]">{uploadError}</p>}

      {creatingType === "picker" && (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-[var(--color-line)] bg-white p-3">
          {getVisualTypeCategories().map((cat) => (
            <div key={cat.id} className="mb-2 last:mb-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{cat.label}</p>
              <div className="grid grid-cols-2 gap-1">
                {cat.types.map((t) => (
                  <button key={t.id} type="button" onClick={() => handleSelectType(t.id)} className="rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-ink-soft)] hover:bg-[var(--color-indigo-soft)] hover:text-[var(--color-indigo)]">
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {content && (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-[var(--color-ink-soft)]">Editing: {currentType}</p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setPicking(true)}>Replace</Button>
                {!confirmRemove ? (
                  <button type="button" onClick={() => setConfirmRemove(true)} className="rounded p-1.5 text-[var(--color-coral)] hover:bg-[var(--color-coral-soft)]"><Trash2 size={13} /></button>
                ) : (
                  <span className="flex items-center gap-1 text-xs">
                    Remove this visual from the question?
                    <button type="button" onClick={handleRemove} className="font-medium text-[var(--color-coral)]">Yes</button>
                    <button type="button" onClick={() => setConfirmRemove(false)} className="text-[var(--color-ink-faint)]">Cancel</button>
                  </span>
                )}
              </div>
            </div>

            {currentType === "image" ? (
              <div className="space-y-2">
                <div><label className={labelCls}>Alt text (required)</label><input className={inputCls} value={content.alt ?? ""} onChange={(e) => onChange({ ...content, alt: e.target.value })} /></div>
                <div><label className={labelCls}>Caption (optional)</label><input className={inputCls} value={content.caption ?? ""} onChange={(e) => onChange({ ...content, caption: e.target.value })} /></div>
                <div><label className={labelCls}>Credit/source (optional)</label><input className={inputCls} value={content.credit ?? ""} onChange={(e) => onChange({ ...content, credit: e.target.value })} /></div>
              </div>
            ) : fieldDefs ? (
              <div className="space-y-3">
                {fieldDefs.map((field) => (
                  <div key={field.key}>
                    <label className={labelCls}>{field.label}</label>
                    <FieldInput field={field} value={content[field.key]} onChange={(v) => onChange({ ...content, [field.key]: v })} />
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <label className={labelCls}>Raw visual data (JSON) \u2014 no dedicated form yet for this type</label>
                <textarea
                  className={`${inputCls} font-mono text-xs`} rows={8}
                  value={JSON.stringify(content, null, 2)}
                  onChange={(e) => { try { onChange(JSON.parse(e.target.value)); } catch { /* ignore until valid JSON */ } }}
                />
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-[var(--color-ink-soft)]">Student Preview</p>
            <LivePreview content={content} questionId={questionId} />
          </div>
        </div>
      )}
    </div>
  );
}
