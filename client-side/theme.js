import { createTheme } from "@mui/material/styles";

export const getTheme = mode => createTheme({
  palette: {
    mode,
    primary: { main: mode === "light" ? "#1976d2" : "#90caf9" },
    secondary: { main: mode === "light" ? "#ff9800" : "#f48fb1" },
    background: {
      default: mode === "light" ? "#f5f7fa" : "#121212",
      paper:    mode === "light" ? "#ffffff" : "#1e1e1e"
    }
  },
  shape: { borderRadius: 10 }
});
