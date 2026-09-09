/** Split visible Learn blocks into student-facing pages. A page_break block
 * starts a new page and is not itself rendered as lesson content. */
export function splitLearnBlocksIntoPages(blocks = []) {
  const pages = [{ label: "", blocks: [] }];
  for (const block of blocks) {
    if (block.block_type === "page_break") {
      pages.push({ label: block.content?.label || "", blocks: [] });
    } else {
      pages[pages.length - 1].blocks.push(block);
    }
  }
  // Preserve an explicitly-created trailing page even when it has no blocks yet.
  // Admins expect a newly-added Page Break to immediately create Page 2/3 in
  // Preview and Student Learn, so an empty final page is intentional.
  return pages.length ? pages : [{ label: "", blocks: [] }];
}
