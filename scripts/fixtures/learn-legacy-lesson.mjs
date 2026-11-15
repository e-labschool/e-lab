// A representative "legacy" lesson: every block type that renders without a live backend,
// using the content shapes the current editor writes (see src/data/learnBlockRegistry.jsx
// defaultContent) and the older shapes the renderer still supports. NO block carries
// content.layout -- this is what every lesson saved before the flexible editor looks like.
const IMG = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const b = (i, block_type, content) => ({ id: `legacy-${i}`, page_id: "legacy-lesson", block_type, position: i, visible: true, content: { audience: "both", ...content } });
export const LEGACY_BLOCKS = [
  b(0, "rich_text", { title: "Isotopes", titleColor: "#3654D6", html: "<p>Atoms of the same element with different numbers of neutrons: <sup>35</sup>Cl and <sup>37</sup>Cl.</p><ul><li>same Z</li><li>different A</li></ul>" }),
  b(1, "rich_text", { title: "With picture", html: "<p>Text that wraps around a floated image.</p>", imageUrl: IMG, imageAlt: "tiny", imageCaption: "Cap", imageWrap: "right", imageWidth: "medium" }),
  b(2, "image", { url: IMG, caption: "Centered image", alt: "a", alignment: "center", width: "large", wrap: "none" }),
  b(3, "image", { url: IMG, caption: "Wrapped image", alt: "b", alignment: "left", width: "small", wrap: "left" }),
  b(4, "rich_text", { html: "<p>This paragraph flows beside the floated image above (legacy float behaviour must be unchanged).</p>" }),
  b(5, "video", { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", caption: "A video", alignment: "center", width: "large" }),
  b(6, "equation", { markup: "SO_4^2- + 2H^+ -> H_2SO_4" }),
  b(7, "key_idea", { text: "Relative atomic mass is a weighted average of isotope masses." }),
  b(8, "definition", { term: "Isotope", definition: "Atoms of one element with different mass numbers." }),
  b(9, "common_mistake", { text: "Mass number is not the same as relative atomic mass." }),
  b(10, "real_life", { title: "Carbon dating", content: "Uses carbon-14.", imageUrl: IMG, imageAlt: "c", imageWrap: "left", imageWidth: "small" }),
  b(11, "worked_example", { question: "Calculate Ar of chlorine.", solution: "(35 x 75 + 37 x 25) / 100 = 35.5", displayMode: "direct" }),
  b(12, "worked_example", { questionItems: [{ type: "text", value: "Q" }], items: [{ type: "subheading", value: "Step 1" }, { type: "equation", value: "a = b" }, { type: "answer", value: "42" }], displayMode: "reveal" }),
  b(13, "data_graph", { title: "Data", rows: [{ x: "1", y: "2" }, { x: "3", y: "4" }], explanation: "e", prompt: "p" }),
  b(14, "compare_contrast", { title: "Compare", displayMode: "inline", columns: [{ title: "A", content: "a" }, { title: "B", content: "b" }] }),
  b(15, "reveal_think", { prompt: "Why?", reveal: "Because." }),
  b(16, "practical", { aim: "Find x", apparatus: "beaker", method: "heat" }),
  b(17, "page_break", { label: "Part 2" }),
  b(18, "rich_text", { title: "After break", html: "<p>Second page text.</p>" }),
  { id: "legacy-19", page_id: "legacy-lesson", block_type: "key_idea", position: 19, visible: true, content: { text: "No audience field at all (oldest blocks)." } },
  { id: "legacy-20", page_id: "legacy-lesson", block_type: "rich_text", position: 20, visible: true, content: null },
];
