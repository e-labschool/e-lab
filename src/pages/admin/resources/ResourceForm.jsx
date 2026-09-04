import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { UNITS, TOPICS } from "../../../data/questions/unitMeta.js";
import {
  uploadResourceFile, createResource, updateResource,
  RESOURCE_TYPES, LEVEL_OPTIONS, STUDENT_CATEGORIES, TEACHER_CATEGORY,
} from "../../../lib/resourceService.js";
import Button from "../../../components/ui/Button.jsx";
import ResourceUploader from "./ResourceUploader.jsx";

const inputClasses =
  "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30";
const labelClasses = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";

// Topic options reuse the SAME curriculum data the Q Builder filter tree
// and Learn sidebar already use (unitMeta.js, itself derived from
// src/data/curricula/dp-chemistry/2025.js) — never a second, independently
// maintained topic list.
const TOPIC_OPTIONS = UNITS.map((u) => u.unit); // "Structure 1", "Reactivity 2", ...

function subtopicOptionsFor(topicLabel) {
  // TOPICS already has exactly the "Structure 1.1"-style labels this form
  // needs (topicCode), derived from the same curriculum data as
  // everywhere else — no separate numbering logic needed here.
  return TOPICS.filter((t) => t.unit === topicLabel).map((t) => t.topicCode);
}

const emptyForm = {
  title: "", description: "", audience: "student", category: "ib-documents",
  curriculum: "dp-chemistry", topic: "", subtopic: "", level: "",
  resource_type: RESOURCE_TYPES[0], status: "draft", is_locked: false, access_tier: "free",
  external_url: "",
};

export default function ResourceForm({ resource, onClose, onSaved }) {
  const isEdit = Boolean(resource);
  const [form, setForm] = useState(() => (resource ? { ...emptyForm, ...resource } : emptyForm));
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const categoryOptions = form.audience === "teacher" ? [TEACHER_CATEGORY] : STUDENT_CATEGORIES;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) return setError("Title is required.");
    if (!file && !form.external_url && !form.file_path) return setError("Add a file or an external link.");
    if (file && form.external_url) return setError("Use either a file upload or an external link, not both.");

    setSaving(true);
    try {
      let fileFields = {};
      if (file) {
        setUploading(true);
        const uploaded = await uploadResourceFile(file, { audience: form.audience, category: form.category });
        setUploading(false);
        fileFields = {
          file_path: uploaded.filePath,
          original_file_name: uploaded.originalFileName,
          mime_type: uploaded.mimeType,
          file_size: uploaded.fileSize,
          external_url: null,
        };
      }

      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        audience: form.audience,
        category: form.category,
        curriculum: form.curriculum,
        topic: form.topic || null,
        subtopic: form.subtopic || null,
        level: form.level || null,
        resource_type: form.resource_type,
        status: form.status,
        is_locked: form.is_locked,
        access_tier: form.access_tier,
        external_url: file ? null : (form.external_url || null),
        ...fileFields,
      };

      const saved = isEdit ? await updateResource(resource.id, payload) : await createResource(payload);
      onSaved(saved);
    } catch (err) {
      setUploading(false);
      setError(err.message || "Something went wrong saving this resource.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-[var(--color-paper)] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
          <p className="text-sm font-semibold text-[var(--color-ink)]">{isEdit ? "Edit Resource" : "Add Resource"}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className={labelClasses} htmlFor="rf-title">Title <span className="text-[var(--color-coral)]">*</span></label>
            <input id="rf-title" required className={inputClasses} value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <label className={labelClasses} htmlFor="rf-description">Description</label>
            <textarea id="rf-description" rows={2} className={inputClasses} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClasses} htmlFor="rf-audience">Audience</label>
              <select id="rf-audience" className={inputClasses} value={form.audience} onChange={(e) => set("audience", e.target.value)}>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className={labelClasses} htmlFor="rf-category">Category</label>
              <select id="rf-category" className={inputClasses} value={form.category} onChange={(e) => set("category", e.target.value)}>
                {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClasses} htmlFor="rf-curriculum">Curriculum</label>
            <select id="rf-curriculum" className={inputClasses} value={form.curriculum} onChange={(e) => set("curriculum", e.target.value)}>
              <option value="dp-chemistry">IB DP Chemistry</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClasses} htmlFor="rf-topic">Topic</label>
              <select id="rf-topic" className={inputClasses} value={form.topic} onChange={(e) => { set("topic", e.target.value); set("subtopic", ""); }}>
                <option value="">\u2014</option>
                {TOPIC_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClasses} htmlFor="rf-subtopic">Subtopic</label>
              <select id="rf-subtopic" className={inputClasses} value={form.subtopic} onChange={(e) => set("subtopic", e.target.value)} disabled={!form.topic}>
                <option value="">\u2014</option>
                {subtopicOptionsFor(form.topic).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClasses} htmlFor="rf-level">Level</label>
              <select id="rf-level" className={inputClasses} value={form.level} onChange={(e) => set("level", e.target.value)}>
                <option value="">\u2014</option>
                {LEVEL_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClasses} htmlFor="rf-type">Resource type</label>
              <select id="rf-type" className={inputClasses} value={form.resource_type} onChange={(e) => set("resource_type", e.target.value)}>
                {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <p className={labelClasses}>File</p>
            <ResourceUploader file={file} onFileSelected={setFile} uploading={uploading} existingFileName={form.original_file_name} />
            <p className="mt-2 text-center text-xs text-[var(--color-ink-faint)]">or</p>
            <input
              type="url" placeholder="External link (https://...)" className={`mt-2 ${inputClasses}`}
              value={form.external_url ?? ""} onChange={(e) => set("external_url", e.target.value)} disabled={Boolean(file)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClasses} htmlFor="rf-status">Status</label>
              <select id="rf-status" className={inputClasses} value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <div>
              <label className={labelClasses} htmlFor="rf-tier">Access tier</label>
              <select id="rf-tier" className={inputClasses} value={form.access_tier} onChange={(e) => set("access_tier", e.target.value)}>
                <option value="free">Free</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div>
              <span className={labelClasses}>Locked</span>
              <label className="flex items-center gap-2 py-2 text-sm text-[var(--color-ink)]">
                <input type="checkbox" checked={form.is_locked} onChange={(e) => set("is_locked", e.target.checked)} />
                Locked
              </label>
            </div>
          </div>

          {error && <p role="alert" className="text-xs text-[var(--color-coral)]">{error}</p>}
        </form>

        <div className="flex gap-3 border-t border-[var(--color-line)] px-5 py-4">
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Save changes" : "Add Resource"}
          </Button>
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
