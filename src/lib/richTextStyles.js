// Shared typography for Rich Text HTML so headings, lists, indents and
// sub/superscripts look the same in the admin editor and on the student
// Learn page (and the admin "Preview as Student"). Tailwind arbitrary-variant
// classes; kept as complete literal strings so Tailwind's scanner sees them.
export const RICH_TEXT_TYPOGRAPHY = [
  "[&_h1]:my-2 [&_h1]:text-[1.75rem] [&_h1]:leading-tight [&_h1]:font-bold",
  "[&_h2]:my-2 [&_h2]:text-[1.4rem] [&_h2]:leading-snug [&_h2]:font-bold",
  "[&_h3]:my-1.5 [&_h3]:text-lg [&_h3]:font-bold",
  "[&_h4]:my-1 [&_h4]:text-base [&_h4]:font-semibold",
  "[&_p+p]:mt-2",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li>ul]:my-0 [&_li>ol]:my-0",
  "[&_a]:text-[var(--color-indigo)] [&_a]:underline",
  "[&_sub]:text-[0.75em] [&_sup]:text-[0.75em] [&_sub]:relative [&_sup]:relative [&_sub]:[line-height:0] [&_sup]:[line-height:0]",
].join(" ");

// Student/preview only: the surrounding block is justified body text, but
// headings stay left unless the author aligned them (inline text-align wins).
export const RICH_TEXT_STUDENT_HEADINGS = "[&_h1]:text-left [&_h1]:text-[var(--color-ink)] [&_h2]:text-left [&_h2]:text-[var(--color-ink)] [&_h3]:text-left [&_h3]:text-[var(--color-ink)] [&_h4]:text-left [&_h4]:text-[var(--color-ink)]";
