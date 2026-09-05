export default function Card({ children, className = "", as: Component = "div", ...rest }) {
  return (
    <Component
      className={`rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] shadow-[0_1px_2px_rgba(20,30,80,0.05),0_2px_8px_-2px_rgba(20,30,80,0.06)] transition-all duration-200 ${className}`}
      {...rest}
    >
      {children}
    </Component>
  );
}
