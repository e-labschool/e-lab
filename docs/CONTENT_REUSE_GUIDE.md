# Updating lessons when the IB guide changes

Everything below is in Admin, Learn Content. Nothing here needs a database change. Nothing is ever overwritten silently.

## Where the review data lives

| What | Where it is stored |
|---|---|
| Block tags (syllabus codes, guide version, needs review, last reviewed) | inside the block: `learn_blocks.content.meta` |
| Lesson guide version, needs-review flag, reviewed date, note, "copied from" | a hidden `lesson_meta` block of that lesson (`visible = false`). Students never receive hidden blocks. `learn_pages` has no JSON column, so this is the only migration-free place |
| Block library (templates) | this browser (`localStorage`), moved between computers with Export / Import |
| Question bank | guide version = the existing `syllabus_version` column, needs review = the tag `needs-review` |

## Step by step: a new edition of the guide arrives

1. **See what you have.** Open Learn Content, then "Content overview". Every lesson is listed with its blocks (type, first line, words, images, linked simulation or questions). Click the arrow on a lesson to see its blocks.
2. **Tag the old content once.** In a lesson, open "Guide version and review" and type the current version (for example `2016`). Do this for every lesson you want to track (filter "Guide version: Not tagged" in the overview shows the ones still missing).
3. **Find what is affected.** Search the text of ALL lessons (for example the old term or number). Matches are listed per block with a link that opens the lesson at that block. Filter by syllabus code to see every lesson that touches one guide point.
4. **Make the new version.** On the lesson row click "New guide version", type the new version (`2025`) and "Create draft copy". You get a NEW draft lesson, code `S1.2 [2025]`, with every block copied and stamped `2025`, flagged "needs review", with a note saying where it came from. The original lesson is not changed and stays published.
5. **Edit the copy.** Open it. Change text, swap images, add or delete blocks. Use "Needs review" on single blocks (Tags and review in the block drawer) if only some parts still need work.
6. **Review in order.** In the overview tick "Needs review" and press "Start review". Review mode shows one lesson at a time in the compact view. "Approve" clears the flag and stamps today's date. "Needs change" keeps the flag and stores your note.
7. **Publish and retire.** Publish the new lesson. Then switch the old lesson to draft (Save Draft) or delete it, so students do not see both. Lesson order is the usual drag list.
8. **Questions.** Check Your Understanding questions that point at question-bank questions are copied (same pinned version). Manual questions are not copied: add them again in the copy.

## Reusing content

- **Block library.** Select a block (Ctrl or Shift + click to select several) then "More > Save to block library", or Add block > "From block library". Insert puts copies after the selected block. Templates keep content only, not position. Check Your Understanding blocks cannot be saved (their questions belong to one lesson).
- **Export / Import.** In the overview tick lessons (or use the current filter) and "Export". The file holds lessons, blocks, layout and tags. Import shows a dry run (what would be created, warnings) and only after "Create" writes NEW draft lessons. A lesson code that already exists gets `(import 2)`; existing lessons are never overwritten. Check Your Understanding questions are not part of the file.
- **Backups.** The platform backup already includes `learn_blocks`, so tags and hidden lesson metadata are covered.

## Things to know

- Layout and tags do not change what students see. Hidden blocks are never sent to students.
- A lesson copy keeps the arrangement (Classic or Canvas) of the original.
- Library templates live in one browser. Export the library file now and then.
