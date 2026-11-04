# e-Lab Question Bank — canonical source

The runtime static question bank has been retired. **Supabase `public.questions` is the single authoritative e-Lab question source** for Admin Question Bank, Student Assess/Solve, Teacher Question Builder, and Add to Lesson.

The former `structure/`, `reactivity/`, and `index.js` question-content files were intentionally removed to prevent stale or duplicate questions from resurfacing. Do not recreate a second local question bank.

`schema.js` is retained for shared constants/helpers used by import validation and Question Builder. `unitMeta.js` is retained for curriculum/topic metadata used by filters and resource forms.

New or revised question batches should be imported through **Admin → Question Bank → Import Questions**, which writes to Supabase through the canonical question-bank service.
