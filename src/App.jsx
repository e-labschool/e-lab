import { RouterProvider } from "react-router-dom";
import { ModeProvider } from "./context/ModeContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { RoleProvider } from "./context/RoleContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ProgressProvider } from "./context/ProgressContext.jsx";
import { PreferencesProvider } from "./context/PreferencesContext.jsx";
import router from "./router.jsx";

export default function App() {
  return (
    <ThemeProvider>
      <ModeProvider>
        <RoleProvider>
          <AuthProvider>
            <ProgressProvider>
              <PreferencesProvider>
                <RouterProvider router={router} />
              </PreferencesProvider>
            </ProgressProvider>
          </AuthProvider>
        </RoleProvider>
      </ModeProvider>
    </ThemeProvider>
  );
}
