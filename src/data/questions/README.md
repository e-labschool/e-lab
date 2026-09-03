# e-Lab Question Bank — batch import guide

This is the **one central question registry** for e-Lab (used today by
Teacher → Q Builder; Student → Practice will read from this same registry
later — there is only ever one question database).

## Where to paste a new batch of questions

1. Work out which **topic file** the batch belongs to. Every syllabus
   subtopic has its own file:

   ```
   src/data/questions/structure/structure-1/structure-1-1.js   (Structure 1.1)
   src/data/questions/structure/structure-1/structure-1-2.js   (Structure 1.2)
   ...
   src/data/questions/reactivity/reactivity-3/reactivity-3-4.js (Reactivity 3.4)
   ```

   e.g. a batch labelled **"Batch S1.1 — Questions 001–025"** goes in
   `src/data/questions/structure/structure-1/structure-1-1.js`.

2. Open that file. You'll see a `const questions = [ ... ]` array (empty,
   or with existing questions already in it).

3. **Paste each new question as one more object inside that array**,
   following the exact shape of the objects already there. Every field is
   documented in `schema.js` in this same folder.

4. Give each new question the next sequence number in its `id`, e.g. if
   `structure-1-1.js` already ends at `EL-S1-1-003`, the next one is
   `EL-S1-1-004`. The file's header comment always states the next
   available number.

5. Set `status` to `"draft"` while you're still reviewing a batch, then
   change it to `"reviewed"` or `"published"` once you're happy with it.
   Only `"reviewed"`/`"published"` questions show up in the Q Builder bank
   by default (drafts are hidden unless the Status filter is explicitly
   set to show them).

6. Save the file. **Nothing else needs to change** — `index.js`
   automatically includes every question in every topic file, the Q
   Builder filters/search pick up new topics, marks, difficulty, etc.
   automatically, and the dev console will warn you immediately if a
   pasted question is missing a required field or reuses an existing ID.

## Adding a brand-new topic file (only if the curriculum itself changes)

This should be rare — the 22 files already cover every current DP
Chemistry 2025 subtopic. If a future syllabus version adds a subtopic:

1. Create the new file following the same naming pattern.
2. Add one `import` line and one entry to the `TOPIC_FILES` array in
   `index.js`.

That's the only file that needs touching outside the new topic file
itself.

## Full field reference

See `schema.js` for every supported field, the `EL-[UNIT]-[TOPIC]-[NUMBER]`
ID convention, and the validation rules a question must pass before it's
considered publish-ready. See `unitMeta.js` for how unit/topic titles are
derived (directly from `src/data/curricula/dp-chemistry/2025.js` — never
hand-typed here, so the question bank can never disagree with the
curriculum map).
