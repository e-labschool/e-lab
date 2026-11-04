// Shared page-width wrapper for application content (dashboards, lists,
// forms). Widened from the previous max-w-6xl (1152px) to make better
// use of modern desktop screens, per the site-wide density pass — narrow,
// long-form reading pages (Learn's concept pages, Welcome) intentionally
// use their own separate, narrower wrapper and are unaffected by this.
export default function Container({ children, className = "", as: Component = "div" }) {
  return (
    <Component className={`mx-auto w-full max-w-[1440px] px-4 sm:px-5 md:px-6 lg:px-8 ${className}`}>
      {children}
    </Component>
  );
}
