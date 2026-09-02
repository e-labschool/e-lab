export default function Container({ children, className = "", as: Component = "div" }) {
  return (
    <Component className={`mx-auto w-full max-w-6xl px-6 md:px-10 ${className}`}>
      {children}
    </Component>
  );
}
