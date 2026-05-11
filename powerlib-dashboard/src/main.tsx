import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { App } from "./App";
import "./styles.css";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#facc15",
      dark: "#d4a900",
      light: "#fde047",
      contrastText: "#161616"
    },
    secondary: {
      main: "#f5f5f4",
      contrastText: "#171717"
    },
    background: {
      default: "#0d0d0d",
      paper: "#18181b"
    },
    divider: "rgba(250, 204, 21, 0.18)",
    text: {
      primary: "#f8fafc",
      secondary: "#b8b8aa"
    }
  },
  shape: {
    borderRadius: 8
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
