import { RouterProvider } from "react-router-dom";
import { ModeProvider } from "./context/ModeContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import router from "./router.jsx";

export default function App() {
  return (
    <ThemeProvider>
      <ModeProvider>
        <RouterProvider router={router} />
      </ModeProvider>
    </ThemeProvider>
  );
}
