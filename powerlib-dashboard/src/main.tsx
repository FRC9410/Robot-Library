import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { App } from "./App";
import "./styles.css";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#7aa2ff"
    },
    secondary: {
      main: "#7dd3c7"
    },
    background: {
      default: "#0f141b",
      paper: "#171d26"
    },
    divider: "rgba(255, 255, 255, 0.14)",
    text: {
      primary: "#edf2f7",
      secondary: "#aeb8c5"
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
