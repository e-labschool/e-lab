# e-Lab Question Bank Cleanup

## What changed
- Removed the retired local/static question-content bank (`src/data/questions/structure`, `reactivity`, and `index.js`).
- Retained only shared `schema.js`, `unitMeta.js`, and the Question Bank README.
- Student Solve now loads published canonical questions from Supabase only; it never falls back to stale local questions.
- Teacher Question Builder now uses published Supabase questions as its canonical e-Lab bank. Teacher-created personal questions remain separate.
- Add to Lesson → Question Bank now loads the same canonical Supabase questions.
- Prediction difficulty lookup now resolves question IDs from Supabase only.
- Historical pre-canonical challenge rows without a pinned question version are no longer silently rehydrated from stale local content.
- Added Admin Question Bank row-level **Preview** button.
- Added Question Editor **Preview as Student** button.
- Student preview reuses the real Student `QuestionRenderer` and does not show answer keys, markschemes, explanations, tags, or admin metadata.
- Student MCQ rendering now accepts both canonical option shapes: `{id,text}` objects and older string options such as `"A. answer"`.

## Canonical source
`public.questions` in Supabase is now the single runtime e-Lab question source.

## Build verification note
A full Vite build could not be completed in the isolated working container because project dependencies were not present and dependency installation timed out. The source was checked for remaining old-bank imports; none remain. Run `npm install`/`npm ci` and `npm run build` on your normal project machine before deployment.
