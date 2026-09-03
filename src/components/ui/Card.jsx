export default function Card({ children, className = "", as: Component = "div", ...rest }) {
  return (
    <Component
      className={`rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-150 ${className}`}
      {...rest}
    >
      {children}
    </Component>
  );
}
