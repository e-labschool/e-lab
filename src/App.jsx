import { RouterProvider } from "react-router-dom";
import { ModeProvider } from "./context/ModeContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { RoleProvider } from "./context/RoleContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SettingsProvider } from "./context/SettingsContext.jsx";
import { ProgressProvider } from "./context/ProgressContext.jsx";
import { PreferencesProvider } from "./context/PreferencesContext.jsx";
import { DisplaySettingsProvider } from "./context/DisplaySettingsContext.jsx";
import router from "./router.jsx";

export default function App() {
  return (
    <ThemeProvider>
      <ModeProvider>
        <RoleProvider>
          <SettingsProvider>
            <AuthProvider>
              <ProgressProvider>
                <PreferencesProvider>
                  <DisplaySettingsProvider>
                    <RouterProvider router={router} />
                  </DisplaySettingsProvider>
                </PreferencesProvider>
              </ProgressProvider>
            </AuthProvider>
          </SettingsProvider>
        </RoleProvider>
      </ModeProvider>
    </ThemeProvider>
  );
}
