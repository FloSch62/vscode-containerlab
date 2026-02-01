/**
 * MUI theme provider bound to VS Code CSS variables.
 */
import React, { useEffect, useMemo, useState } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { createTheme, StyledEngineProvider } from "@mui/material/styles";

const VSCODE_FALLBACK_VARS: Record<string, string> = {
  "--vscode-editor-background": "#1e1e1e",
  "--vscode-editor-foreground": "#d4d4d4",
  "--vscode-panel-background": "#252526",
  "--vscode-panel-foreground": "var(--vscode-foreground, var(--vscode-editor-foreground))",
  "--vscode-panel-border": "#2a2a2a",
  "--vscode-button-background": "#0e639c",
  "--vscode-button-foreground": "#ffffff",
  "--vscode-button-hoverBackground": "#1177bb",
  "--vscode-button-secondaryBackground": "#3a3d41",
  "--vscode-button-secondaryForeground": "#ffffff",
  "--vscode-button-secondaryHoverBackground": "#45494e",
  "--vscode-input-background": "#3c3c3c",
  "--vscode-input-foreground": "#cccccc",
  "--vscode-input-border": "#3c3c3c",
  "--vscode-focusBorder": "#3794ff",
  "--vscode-dropdown-background": "#3c3c3c",
  "--vscode-dropdown-foreground": "#f0f0f0",
  "--vscode-dropdown-border": "#3c3c3c",
  "--vscode-list-activeSelectionBackground": "#04395e",
  "--vscode-list-hoverBackground": "#2a2d2e",
  "--vscode-textLink-foreground": "#3794ff",
  "--vscode-textLink-activeForeground": "#4aa3ff",
  "--vscode-descriptionForeground": "#9d9d9d",
  "--vscode-menu-border": "var(--vscode-panel-border)",
  "--vscode-badge-background": "#4d4d4d",
  "--vscode-badge-foreground": "#ffffff",
  "--vscode-titleBar-activeBackground": "#3c3c3c",
  "--vscode-titleBar-activeForeground": "#cccccc",
  "--vscode-editorHoverWidget-background": "#252526",
  "--vscode-editorHoverWidget-border": "#454545",
  "--vscode-textBlockQuote-background": "#222222",
  "--vscode-textBlockQuote-border": "#2b2b2b",
  "--vscode-charts-green": "#89d185",
  "--vscode-charts-yellow": "#cca700",
  "--vscode-charts-red": "#f14c4c",
  "--vscode-charts-blue": "#3794ff",
  "--vscode-errorForeground": "#f14c4c",
  "--vscode-testing-iconFailed": "#f14c4c",
  "--vscode-testing-iconPassed": "#73c991",
  "--vscode-font-family": "Segoe WPC, Segoe UI, sans-serif",
  "--vscode-font-size": "13px"
};

function ensureVSCodeThemeVariables(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const computed = getComputedStyle(root);
  Object.entries(VSCODE_FALLBACK_VARS).forEach(([key, value]) => {
    if (!computed.getPropertyValue(key).trim()) {
      root.style.setProperty(key, value);
    }
  });
}

ensureVSCodeThemeVariables();

function parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    if (full.length !== 6) return null;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return { r, g, b };
  }
  const match = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return null;
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

function getCssVarValue(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function detectThemeMode(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const root = document.documentElement;
  const body = document.body;
  if (root.classList.contains("light") || body.classList.contains("vscode-light")) return "light";
  if (root.classList.contains("dark") || body.classList.contains("vscode-dark")) return "dark";
  const bg = getComputedStyle(document.documentElement).getPropertyValue(
    "--vscode-editor-background"
  );
  const rgb = parseColorToRgb(bg);
  if (!rgb) return "dark";
  const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return luminance < 128 ? "dark" : "light";
}

export const MuiThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<"light" | "dark">(() => detectThemeMode());
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const body = document.body;
    const updateTheme = () => {
      ensureVSCodeThemeVariables();
      setMode(detectThemeMode());
      setThemeVersion((version) => version + 1);
    };
    updateTheme();
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === "class")) {
        updateTheme();
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    if (body) observer.observe(body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const muiTheme = useMemo(
    () =>
      createTheme({
        shape: { borderRadius: 4 },
        typography: {
          fontFamily: "var(--vscode-font-family)",
          fontSize: 13
        },
        palette: {
          mode,
          primary: { main: getCssVarValue("--vscode-button-background", "#0e639c") },
          secondary: {
            main: getCssVarValue("--vscode-button-secondaryBackground", "#3a3d41")
          },
          background: {
            default: getCssVarValue("--vscode-editor-background", "#1e1e1e"),
            paper: getCssVarValue("--vscode-panel-background", "#252526")
          },
          text: {
            primary: getCssVarValue("--vscode-editor-foreground", "#d4d4d4"),
            secondary: getCssVarValue("--vscode-descriptionForeground", "#9d9d9d")
          },
          error: { main: getCssVarValue("--vscode-errorForeground", "#f14c4c") },
          warning: { main: getCssVarValue("--vscode-charts-yellow", "#cca700") },
          info: { main: getCssVarValue("--vscode-charts-blue", "#3794ff") },
          success: { main: getCssVarValue("--vscode-charts-green", "#89d185") }
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                backgroundColor: "var(--vscode-editor-background)",
                color: "var(--vscode-editor-foreground)"
              }
            }
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                backgroundColor: "var(--vscode-input-background)",
                color: "var(--vscode-input-foreground)",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "var(--vscode-input-border)"
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "var(--vscode-input-border)"
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "var(--vscode-focusBorder, var(--vscode-textLink-foreground))"
                }
              },
              input: {
                color: "var(--vscode-input-foreground)"
              }
            }
          },
          MuiFormLabel: {
            styleOverrides: {
              root: {
                color: "var(--vscode-descriptionForeground)"
              }
            }
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none"
              }
            }
          },
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: "none"
              }
            }
          },
          MuiTooltip: {
            styleOverrides: {
              tooltip: {
                backgroundColor: "var(--vscode-editorHoverWidget-background)",
                border: "1px solid var(--vscode-editorHoverWidget-border)",
                color: "var(--vscode-editor-foreground)"
              }
            }
          },
          MuiMenu: {
            styleOverrides: {
              paper: {
                backgroundColor: "var(--vscode-dropdown-background)",
                color: "var(--vscode-dropdown-foreground)",
                border: "1px solid var(--vscode-dropdown-border)"
              }
            }
          },
          MuiMenuItem: {
            styleOverrides: {
              root: {
                "&.Mui-selected, &.Mui-selected:hover": {
                  backgroundColor: "var(--vscode-list-activeSelectionBackground)"
                }
              }
            }
          }
        }
      }),
    [mode, themeVersion]
  );

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </StyledEngineProvider>
  );
};
