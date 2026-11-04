-- e-Lab: Question Bank visual_data audit v2 (READ-ONLY)
-- Contains ONLY SELECT statements. No UPDATE, DELETE, INSERT, ALTER,
-- DROP, TRUNCATE, or CREATE anywhere in this file.
--
-- CORRECTION (this revision): every WHERE clause below now excludes BOTH
-- SQL NULL and the JSONB scalar `null` explicitly. These are NOT the
-- same thing — `visual_data IS NOT NULL` only excludes a genuinely empty
-- column; a column storing the JSON value `null` (jsonb_typeof = 'null')
-- is a real, non-NULL stored value and previously passed straight
-- through every query below, incorrectly counted as "has visual_data".
-- Confirmed against the live counts: 1,121 questions store JSON null,
-- 1 stores SQL NULL — both mean "this question has no visual", not a
-- structural encoding problem, and both are now correctly excluded from
-- every result set in this file.

-- ============================================================
-- -1. Explicit no-visual breakdown — confirms both null forms are
-- present and both are excluded everywhere else in this file.
-- ============================================================
select
  count(*) filter (where visual_data is null) as sql_null_count,
  count(*) filter (where visual_data is not null and jsonb_typeof(visual_data) = 'null') as json_null_count,
  count(*) filter (where visual_data is not null and jsonb_typeof(visual_data) <> 'null') as has_visual_object_count
from public.questions;
--
-- WHY THIS FILE EXISTS: the v1 audit reported ~1,131 of ~1,266 flagged
-- rows as "UNRECOGNIZED TYPE". That is a suspiciously large, largely
-- undifferentiated bucket — and after cross-checking schema.js's
-- long-documented field reference against stimulusSchema.js field by
-- field, there is no evidence of a legacy naming convention that would
-- explain it. The leading hypothesis is structural, not scientific: if
-- visual_data was ever stored as a JSON-encoded STRING rather than a
-- native JSONB object, `->>'type'` would return NULL for every affected
-- row regardless of what visual it actually represents — which would
-- produce exactly this symptom. Query 0 below tests that hypothesis
-- directly, before anything else, so it doesn't have to be guessed at.

-- ============================================================
-- 0. THE KEY DIAGNOSTIC — is visual_data actually a JSONB object, or a
-- string/other type? If a meaningful fraction of rows show anything
-- other than 'object' here, that confirms the structural hypothesis
-- above rather than a scientific data problem.
-- ============================================================
select
  jsonb_typeof(visual_data) as visual_data_json_type,
  count(*) as question_count
from public.questions
where visual_data is not null and jsonb_typeof(visual_data) <> 'null'
group by jsonb_typeof(visual_data)
order by question_count desc;

select
  jsonb_typeof(content_snapshot->'visual_data') as visual_data_json_type,
  count(*) as version_count
from public.question_versions
where content_snapshot->'visual_data' is not null and jsonb_typeof(content_snapshot->'visual_data') <> 'null'
group by jsonb_typeof(content_snapshot->'visual_data')
order by version_count desc;

-- ============================================================
-- 1. Full detailed listing — CURRENT canonical questions. Includes the
-- actual visual_data JSON (as requested) so shapes can be inspected
-- directly, plus curriculum context and the jsonb_typeof check inline.
-- `classification` is left for human judgement (A/B/C/D/E per the task);
-- this only reports the mechanical facts needed to decide.
-- ============================================================
select
  q.id as question_id,
  null::uuid as version_id,
  null::int as version_number,
  q.topic_code,
  q.concept,
  q.level,
  q.paper,
  jsonb_typeof(q.visual_data) as visual_data_json_type,
  q.visual_data->>'type' as raw_visual_type,
  q.visual_data as visual_data
from public.questions q
where q.visual_data is not null and jsonb_typeof(q.visual_data) <> 'null'
order by q.topic_code, q.id;

-- ============================================================
-- 2. Full detailed listing — HISTORICAL question_versions. Reported
-- separately from live questions per instruction; these rows are
-- immutable and this file never modifies them.
-- ============================================================
select
  qv.question_id,
  qv.id as version_id,
  qv.version_number,
  q.topic_code,
  q.concept,
  qv.content_snapshot->>'level' as level,
  qv.content_snapshot->>'paper' as paper,
  jsonb_typeof(qv.content_snapshot->'visual_data') as visual_data_json_type,
  qv.content_snapshot->'visual_data'->>'type' as raw_visual_type,
  qv.content_snapshot->'visual_data' as visual_data
from public.question_versions qv
left join public.questions q on q.id = qv.question_id
where qv.content_snapshot->'visual_data' is not null and jsonb_typeof(qv.content_snapshot->'visual_data') <> 'null'
order by q.topic_code, qv.question_id, qv.version_number;

-- ============================================================
-- 3. Grouped frequency table — one row per raw_visual_type actually
-- present in the data (current questions), with a mechanical
-- renderer_status you can cross-reference against
-- src/lib/stimulusSchema.js's key list, and a suggested_classification
-- computed from that single fact (a human should still confirm it,
-- especially for anything suggested as E).
-- ============================================================
select
  visual_data->>'type' as raw_visual_type,
  jsonb_typeof(visual_data) as visual_data_json_type,
  count(*) as question_count,
  case
    when jsonb_typeof(visual_data) != 'object' then 'N/A — visual_data is not an object, cannot determine a type at all'
    when (visual_data->>'type') is null then 'N/A — no "type" key present in visual_data'
    when (visual_data->>'type') in (
      'text','table','nuclide','mass-spectrum','bar-chart','atom-diagram','emission-spectrum',
      'energy-level-diagram','orbital-shape','orbital-box','ionization-graph','proportionality-graph',
      'gas-particle-diagram','apparatus-diagram','lewis-structure','resonance','vsepr','dipole',
      'ion-grid','electron-transfer','bonding-triangle','polymer','sigma-pi','chromatogram',
      'periodic-table-highlight','colour-wheel','organic-structure','enantiomer-pair','ir-spectrum',
      'nmr-spectrum','energy-profile','calorimeter-diagram','hess-cycle','born-haber-cycle',
      'carbon-cycle-diagram','electrochemical-cell','maxwell-boltzmann','multistep-energy-profile','integrated'
    ) then 'renderer + schema exist in stimulusSchema.js'
    else 'NO renderer/schema entry for this type string'
  end as renderer_status,
  case
    when jsonb_typeof(visual_data) != 'object' then 'INVESTIGATE — structural encoding problem, not a type-naming problem (see query 0)'
    when (visual_data->>'type') is null then 'INVESTIGATE — visual_data present but has no type key at all'
    when (visual_data->>'type') in (
      'text','table','nuclide','mass-spectrum','bar-chart','atom-diagram','emission-spectrum',
      'energy-level-diagram','orbital-shape','orbital-box','ionization-graph','proportionality-graph',
      'gas-particle-diagram','apparatus-diagram','lewis-structure','resonance','vsepr','dipole',
      'ion-grid','electron-transfer','bonding-triangle','polymer','sigma-pi','chromatogram',
      'periodic-table-highlight','colour-wheel','organic-structure','enantiomer-pair','ir-spectrum',
      'nmr-spectrum','energy-profile','calorimeter-diagram','hess-cycle','born-haber-cycle',
      'carbon-cycle-diagram','electrochemical-cell','maxwell-boltzmann','multistep-energy-profile','integrated'
    ) then 'A or D — recognized type; run query 1 filtered to this type to check field completeness'
    else 'E — no current renderer for this type string; confirm no proven alias exists before treating as unsupported'
  end as suggested_classification
from public.questions
where visual_data is not null and jsonb_typeof(visual_data) <> 'null'
group by visual_data->>'type', jsonb_typeof(visual_data)
order by question_count desc;
