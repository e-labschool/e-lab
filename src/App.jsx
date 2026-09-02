import { RouterProvider } from "react-router-dom";
import { ModeProvider } from "./context/ModeContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { RoleProvider } from "./context/RoleContext.jsx";
import router from "./router.jsx";

export default function App() {
  return (
    <ThemeProvider>
      <ModeProvider>
        <RoleProvider>
          <RouterProvider router={router} />
        </RoleProvider>
      </ModeProvider>
    </ThemeProvider>
  );
}
