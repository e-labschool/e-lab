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
  if (pages.length > 1 && pages[pages.length - 1].blocks.length === 0) pages.pop();
  return pages.length ? pages : [{ label: "", blocks: [] }];
}
