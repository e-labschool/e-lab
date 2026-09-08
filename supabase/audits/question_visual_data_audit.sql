-- e-Lab: Question Bank visual_data compatibility audit (READ-ONLY)
-- Contains ONLY SELECT statements — no UPDATE, DELETE, INSERT, ALTER,
-- DROP, or TRUNCATE anywhere in this file, and no function/object is
-- created. Every check below is a direct SQL translation of the current
-- src/lib/stimulusSchema.js contract (the same schema StimulusRenderer
-- and the Admin importer both already use) — nothing here is stricter
-- or looser than what the live renderer actually requires.
--
-- Reads: public.questions, public.question_versions. Nothing is written.

-- ============================================================
-- A. Visual type counts — every distinct visual_data->>'type' value
-- actually present in canonical questions, including any type NOT in
-- the current schema at all (Classification C candidates).
-- ============================================================
select
  visual_data->>'type' as visual_type,
  count(*) as question_count
from public.questions
where visual_data is not null
group by visual_data->>'type'
order by question_count desc;

-- ============================================================
-- B. Every question with visual_data — id/topic/concept/type, for
-- cross-referencing against C below.
-- ============================================================
select
  id as question_id,
  topic_code,
  concept,
  visual_data->>'type' as visual_type
from public.questions
where visual_data is not null
order by topic_code, id;

-- ============================================================
-- C. Likely malformed records (CURRENT canonical questions) — one CTE
-- encodes the exact stimulusSchema.js contract as SQL, evaluated once
-- per question. `problem` is NULL for a structurally valid record
-- (Classification D); non-null identifies the missing/invalid field
-- (Classification B, or A if it turns out to be a simple rename — this
-- SQL only detects the mismatch, a human decides which classification
-- actually applies).
-- ============================================================
with validated as (
  select
    id as question_id,
    topic_code,
    concept,
    visual_data->>'type' as visual_type,
    case visual_data->>'type'

      when 'table' then
        case
          when jsonb_typeof(visual_data->'table') is distinct from 'object' then 'missing/invalid "table"'
          when jsonb_typeof(visual_data->'table'->'headers') is distinct from 'array' then 'missing/invalid "table.headers"'
          when jsonb_typeof(visual_data->'table'->'rows') is distinct from 'array' then 'missing/invalid "table.rows"'
          else null
        end

      when 'nuclide' then
        case when jsonb_typeof(visual_data->'nuclides') is distinct from 'array' then 'missing/invalid "nuclides"' else null end

      when 'mass-spectrum' then
        case when jsonb_typeof(visual_data->'peaks') is distinct from 'array' then 'missing/invalid "peaks"' else null end

      when 'bar-chart' then
        case when jsonb_typeof(visual_data->'bars') is distinct from 'array' then 'missing/invalid "bars"' else null end

      when 'emission-spectrum' then
        case when jsonb_typeof(visual_data->'lines') is distinct from 'array' then 'missing/invalid "lines"' else null end

      when 'energy-level-diagram' then
        case
          when jsonb_typeof(visual_data->'levels') is distinct from 'array' then 'missing/invalid "levels"'
          when jsonb_typeof(visual_data->'transitions') is distinct from 'array' then 'missing/invalid "transitions"'
          else null
        end

      when 'orbital-shape' then
        case when jsonb_typeof(visual_data->'shapes') is distinct from 'array' then 'missing/invalid "shapes"' else null end

      when 'orbital-box' then
        case when jsonb_typeof(visual_data->'subshells') is distinct from 'array' then 'missing/invalid "subshells"' else null end

      when 'ionization-graph' then
        case when jsonb_typeof(visual_data->'points') is distinct from 'array' then 'missing/invalid "points"' else null end

      when 'proportionality-graph' then
        case when jsonb_typeof(visual_data->'points') is distinct from 'array' then 'missing/invalid "points"' else null end

      when 'gas-particle-diagram' then
        case when jsonb_typeof(visual_data->'containers') is distinct from 'array' then 'missing/invalid "containers"' else null end

      when 'apparatus-diagram' then
        case when jsonb_typeof(visual_data->'items') is distinct from 'array' then 'missing/invalid "items"' else null end

      when 'lewis-structure' then
        case
          when jsonb_typeof(visual_data->'atoms') is distinct from 'array' then 'missing/invalid "atoms"'
          when jsonb_typeof(visual_data->'bonds') is distinct from 'array' then 'missing/invalid "bonds"'
          else null
        end

      when 'resonance' then
        case when jsonb_typeof(visual_data->'structures') is distinct from 'array' then 'missing/invalid "structures"' else null end

      when 'vsepr' then
        case when (visual_data->'geometry') is null or (visual_data->'geometry') = 'null'::jsonb then 'missing "geometry"' else null end

      when 'dipole' then
        case when (visual_data->'geometry') is null or (visual_data->'geometry') = 'null'::jsonb then 'missing "geometry"' else null end

      when 'electron-transfer' then
        case
          when (visual_data->'from') is null or (visual_data->'from') = 'null'::jsonb then 'missing "from"'
          when (visual_data->'to') is null or (visual_data->'to') = 'null'::jsonb then 'missing "to"'
          else null
        end

      when 'bonding-triangle' then
        case when jsonb_typeof(visual_data->'markers') is distinct from 'array' then 'missing/invalid "markers"' else null end

      when 'chromatogram' then
        case when jsonb_typeof(visual_data->'spots') is distinct from 'array' then 'missing/invalid "spots"' else null end

      when 'periodic-table-highlight' then
        case when jsonb_typeof(visual_data->'highlights') is distinct from 'array' then 'missing/invalid "highlights"' else null end

      when 'organic-structure' then
        case
          when jsonb_typeof(visual_data->'atoms') is distinct from 'array' then 'missing/invalid "atoms"'
          when jsonb_typeof(visual_data->'bonds') is distinct from 'array' then 'missing/invalid "bonds"'
          else null
        end

      when 'ir-spectrum' then
        case when jsonb_typeof(visual_data->'bands') is distinct from 'array' then 'missing/invalid "bands"' else null end

      when 'nmr-spectrum' then
        case when jsonb_typeof(visual_data->'signals') is distinct from 'array' then 'missing/invalid "signals"' else null end

      when 'hess-cycle' then
        case
          when jsonb_typeof(visual_data->'nodes') is distinct from 'array' then 'missing/invalid "nodes"'
          when jsonb_typeof(visual_data->'arrows') is distinct from 'array' then 'missing/invalid "arrows"'
          else null
        end

      when 'born-haber-cycle' then
        case when jsonb_typeof(visual_data->'steps') is distinct from 'array' then 'missing/invalid "steps"' else null end

      when 'carbon-cycle-diagram' then
        case when jsonb_typeof(visual_data->'stages') is distinct from 'array' then 'missing/invalid "stages"' else null end

      when 'maxwell-boltzmann' then
        case when jsonb_typeof(visual_data->'temps') is distinct from 'array' then 'missing/invalid "temps"' else null end

      when 'multistep-energy-profile' then
        case when jsonb_typeof(visual_data->'points') is distinct from 'array' then 'missing/invalid "points"' else null end

      when 'integrated' then
        case when jsonb_typeof(visual_data->'blocks') is distinct from 'array' then 'missing/invalid "blocks"' else null end

      -- atom-diagram, ion-grid, polymer, sigma-pi, colour-wheel,
      -- enantiomer-pair, energy-profile, calorimeter-diagram,
      -- electrochemical-cell, text: no required fields in the current
      -- renderer contract — never flagged, matching stimulusSchema.js exactly.
      when 'atom-diagram' then null
      when 'ion-grid' then null
      when 'polymer' then null
      when 'sigma-pi' then null
      when 'colour-wheel' then null
      when 'enantiomer-pair' then null
      when 'energy-profile' then null
      when 'calorimeter-diagram' then null
      when 'electrochemical-cell' then null
      when 'text' then null

      -- Any type not in the current schema at all — Classification C
      -- (unsupported/legacy visual type), not B — the renderer's own
      -- `default: return null` already handles these safely; they are
      -- not "broken", just not a recognized type.
      else 'UNRECOGNIZED TYPE — not present in stimulusSchema.js'
    end as problem
  from public.questions
  where visual_data is not null
)
select question_id, topic_code, concept, visual_type, problem
from validated
where problem is not null
order by visual_type, question_id;

-- ============================================================
-- D. Same exact check applied to question_versions.content_snapshot —
-- the immutable, historical record. Reported SEPARATELY per instruction
-- ("do not modify historical versions") — this identifies whether a
-- malformed shape is also frozen into past versions, not just present in
-- the live canonical row. Uses the identical branch-for-branch logic as
-- section C, pointed at the version snapshot's nested visual_data instead
-- of the live column.
-- ============================================================
with version_validated as (
  select
    qv.id as version_id,
    qv.question_id,
    qv.version_number,
    qv.content_snapshot->'visual_data'->>'type' as visual_type,
    case qv.content_snapshot->'visual_data'->>'type'

      when 'table' then
        case
          when jsonb_typeof(qv.content_snapshot->'visual_data'->'table') is distinct from 'object' then 'missing/invalid "table"'
          when jsonb_typeof(qv.content_snapshot->'visual_data'->'table'->'headers') is distinct from 'array' then 'missing/invalid "table.headers"'
          when jsonb_typeof(qv.content_snapshot->'visual_data'->'table'->'rows') is distinct from 'array' then 'missing/invalid "table.rows"'
          else null
        end

      when 'nuclide' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'nuclides') is distinct from 'array' then 'missing/invalid "nuclides"' else null end

      when 'mass-spectrum' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'peaks') is distinct from 'array' then 'missing/invalid "peaks"' else null end

      when 'bar-chart' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'bars') is distinct from 'array' then 'missing/invalid "bars"' else null end

      when 'emission-spectrum' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'lines') is distinct from 'array' then 'missing/invalid "lines"' else null end

      when 'energy-level-diagram' then
        case
          when jsonb_typeof(qv.content_snapshot->'visual_data'->'levels') is distinct from 'array' then 'missing/invalid "levels"'
          when jsonb_typeof(qv.content_snapshot->'visual_data'->'transitions') is distinct from 'array' then 'missing/invalid "transitions"'
          else null
        end

      when 'orbital-shape' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'shapes') is distinct from 'array' then 'missing/invalid "shapes"' else null end

      when 'orbital-box' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'subshells') is distinct from 'array' then 'missing/invalid "subshells"' else null end

      when 'ionization-graph' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'points') is distinct from 'array' then 'missing/invalid "points"' else null end

      when 'proportionality-graph' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'points') is distinct from 'array' then 'missing/invalid "points"' else null end

      when 'gas-particle-diagram' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'containers') is distinct from 'array' then 'missing/invalid "containers"' else null end

      when 'apparatus-diagram' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'items') is distinct from 'array' then 'missing/invalid "items"' else null end

      when 'lewis-structure' then
        case
          when jsonb_typeof(qv.content_snapshot->'visual_data'->'atoms') is distinct from 'array' then 'missing/invalid "atoms"'
          when jsonb_typeof(qv.content_snapshot->'visual_data'->'bonds') is distinct from 'array' then 'missing/invalid "bonds"'
          else null
        end

      when 'resonance' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'structures') is distinct from 'array' then 'missing/invalid "structures"' else null end

      when 'vsepr' then
        case when (qv.content_snapshot->'visual_data'->'geometry') is null or (qv.content_snapshot->'visual_data'->'geometry') = 'null'::jsonb then 'missing "geometry"' else null end

      when 'dipole' then
        case when (qv.content_snapshot->'visual_data'->'geometry') is null or (qv.content_snapshot->'visual_data'->'geometry') = 'null'::jsonb then 'missing "geometry"' else null end

      when 'electron-transfer' then
        case
          when (qv.content_snapshot->'visual_data'->'from') is null or (qv.content_snapshot->'visual_data'->'from') = 'null'::jsonb then 'missing "from"'
          when (qv.content_snapshot->'visual_data'->'to') is null or (qv.content_snapshot->'visual_data'->'to') = 'null'::jsonb then 'missing "to"'
          else null
        end

      when 'bonding-triangle' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'markers') is distinct from 'array' then 'missing/invalid "markers"' else null end

      when 'chromatogram' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'spots') is distinct from 'array' then 'missing/invalid "spots"' else null end

      when 'periodic-table-highlight' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'highlights') is distinct from 'array' then 'missing/invalid "highlights"' else null end

      when 'organic-structure' then
        case
          when jsonb_typeof(qv.content_snapshot->'visual_data'->'atoms') is distinct from 'array' then 'missing/invalid "atoms"'
          when jsonb_typeof(qv.content_snapshot->'visual_data'->'bonds') is distinct from 'array' then 'missing/invalid "bonds"'
          else null
        end

      when 'ir-spectrum' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'bands') is distinct from 'array' then 'missing/invalid "bands"' else null end

      when 'nmr-spectrum' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'signals') is distinct from 'array' then 'missing/invalid "signals"' else null end

      when 'hess-cycle' then
        case
          when jsonb_typeof(qv.content_snapshot->'visual_data'->'nodes') is distinct from 'array' then 'missing/invalid "nodes"'
          when jsonb_typeof(qv.content_snapshot->'visual_data'->'arrows') is distinct from 'array' then 'missing/invalid "arrows"'
          else null
        end

      when 'born-haber-cycle' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'steps') is distinct from 'array' then 'missing/invalid "steps"' else null end

      when 'carbon-cycle-diagram' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'stages') is distinct from 'array' then 'missing/invalid "stages"' else null end

      when 'maxwell-boltzmann' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'temps') is distinct from 'array' then 'missing/invalid "temps"' else null end

      when 'multistep-energy-profile' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'points') is distinct from 'array' then 'missing/invalid "points"' else null end

      when 'integrated' then
        case when jsonb_typeof(qv.content_snapshot->'visual_data'->'blocks') is distinct from 'array' then 'missing/invalid "blocks"' else null end

      when 'atom-diagram' then null
      when 'ion-grid' then null
      when 'polymer' then null
      when 'sigma-pi' then null
      when 'colour-wheel' then null
      when 'enantiomer-pair' then null
      when 'energy-profile' then null
      when 'calorimeter-diagram' then null
      when 'electrochemical-cell' then null
      when 'text' then null

      else 'UNRECOGNIZED TYPE — not present in stimulusSchema.js'
    end as problem
  from public.question_versions qv
  where qv.content_snapshot->'visual_data' is not null
)
select version_id, question_id, version_number, visual_type, problem
from version_validated
where problem is not null
order by visual_type, question_id, version_number;
