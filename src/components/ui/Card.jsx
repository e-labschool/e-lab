export default function Card({ children, className = "", as: Component = "div", ...rest }) {
  return (
    <Component
      className={`rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] ${className}`}
      {...rest}
    >
      {children}
    </Component>
  );
}
