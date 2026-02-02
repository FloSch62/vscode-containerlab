/**
 * MUI theme provider bound to VS Code CSS variables.
 */
import React, { useEffect, useMemo, useState } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { alpha, createTheme, StyledEngineProvider } from "@mui/material/styles";

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

  const muiTheme = useMemo(() => {
    const editorBg = getCssVarValue("--vscode-editor-background", "#1e1e1e");
    const editorFg = getCssVarValue("--vscode-editor-foreground", "#d4d4d4");
    const panelBg = getCssVarValue("--vscode-panel-background", "#252526");
    const panelBorder = getCssVarValue("--vscode-panel-border", "#2a2a2a");
    const inputBg = getCssVarValue("--vscode-input-background", "#3c3c3c");
    const inputFg = getCssVarValue("--vscode-input-foreground", "#cccccc");
    const inputBorder = getCssVarValue("--vscode-input-border", "#3c3c3c");
    const buttonBg = getCssVarValue("--vscode-button-background", "#0e639c");
    const buttonSecondary = getCssVarValue("--vscode-button-secondaryBackground", "#3a3d41");
    const buttonHover = getCssVarValue("--vscode-button-hoverBackground", "#1177bb");
    const focusBorder = getCssVarValue("--vscode-focusBorder", "#3794ff");
    const listHover = getCssVarValue("--vscode-list-hoverBackground", "#2a2d2e");
    const listSelected = getCssVarValue("--vscode-list-activeSelectionBackground", "#04395e");
    const dropdownBg = getCssVarValue("--vscode-dropdown-background", "#3c3c3c");
    const dropdownFg = getCssVarValue("--vscode-dropdown-foreground", "#f0f0f0");
    const dropdownBorder = getCssVarValue("--vscode-dropdown-border", "#3c3c3c");
    const linkColor = getCssVarValue("--vscode-textLink-foreground", "#3794ff");
    const linkActive = getCssVarValue("--vscode-textLink-activeForeground", "#4aa3ff");
    const hoverWidgetBg = getCssVarValue("--vscode-editorHoverWidget-background", "#252526");
    const hoverWidgetBorder = getCssVarValue("--vscode-editorHoverWidget-border", "#454545");
    const badgeBg = getCssVarValue("--vscode-badge-background", "#4d4d4d");
    const badgeFg = getCssVarValue("--vscode-badge-foreground", "#ffffff");
    const descriptionFg = getCssVarValue("--vscode-descriptionForeground", "#9d9d9d");

    return createTheme({
      shape: { borderRadius: 6 },
      typography: {
        fontFamily: "var(--vscode-font-family)",
        fontSize: 13,
        button: { fontWeight: 600 }
      },
      palette: {
        mode,
        primary: { main: buttonBg },
        secondary: { main: buttonSecondary },
        background: {
          default: editorBg,
          paper: panelBg
        },
        divider: panelBorder,
        text: {
          primary: editorFg,
          secondary: descriptionFg
        },
        error: { main: getCssVarValue("--vscode-errorForeground", "#f14c4c") },
        warning: { main: getCssVarValue("--vscode-charts-yellow", "#cca700") },
        info: { main: getCssVarValue("--vscode-charts-blue", "#3794ff") },
        success: { main: getCssVarValue("--vscode-charts-green", "#89d185") },
        action: {
          hover: listHover,
          selected: listSelected
        }
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              backgroundColor: editorBg,
              color: editorFg
            },
            a: {
              color: linkColor
            },
            "a:hover": {
              color: linkActive
            },
            "::selection": {
              backgroundColor: alpha(buttonBg, 0.35)
            }
          }
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundColor: panelBg,
              backgroundImage: "none",
              borderBottom: `1px solid ${panelBorder}`,
              color: editorFg
            }
          }
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: "none",
              border: `1px solid ${panelBorder}`
            }
          }
        },
        MuiDrawer: {
          styleOverrides: {
            paper: {
              backgroundImage: "none",
              borderRight: `1px solid ${panelBorder}`
            }
          }
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              backgroundColor: inputBg,
              color: inputFg,
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: inputBorder
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: inputBorder
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: focusBorder,
                boxShadow: `0 0 0 1px ${alpha(focusBorder, 0.5)}`
              }
            },
            input: {
              color: inputFg
            }
          }
        },
        MuiFormLabel: {
          styleOverrides: {
            root: {
              color: descriptionFg,
              "&.Mui-focused": {
                color: linkColor
              }
            }
          }
        },
        MuiInputLabel: {
          styleOverrides: {
            root: {
              color: descriptionFg,
              "&.Mui-focused": {
                color: linkColor
              }
            },
            shrink: {
              color: descriptionFg,
              backgroundColor: panelBg,
              padding: "0 4px",
              marginLeft: -4,
              borderRadius: 4
            }
          }
        },
        MuiButton: {
          defaultProps: {
            size: "small",
            disableElevation: true
          },
          styleOverrides: {
            root: {
              textTransform: "none",
              borderRadius: 8
            },
            containedPrimary: {
              boxShadow: `0 0 0 1px ${alpha(buttonBg, 0.45)} inset`
            },
            outlined: {
              borderColor: alpha(buttonBg, 0.35)
            }
          }
        },
        MuiIconButton: {
          defaultProps: { size: "small" },
          styleOverrides: {
            root: {
              borderRadius: 10
            }
          }
        },
        MuiTextField: {
          defaultProps: { size: "small" }
        },
        MuiToggleButton: {
          defaultProps: { size: "small" },
          styleOverrides: {
            root: {
              textTransform: "none",
              fontSize: 11
            }
          }
        },
        MuiChip: {
          defaultProps: { size: "small" },
          styleOverrides: {
            root: {
              fontWeight: 600
            },
            outlined: {
              borderColor: alpha(badgeBg, 0.6)
            }
          }
        },
        MuiSlider: {
          defaultProps: { size: "small" },
          styleOverrides: {
            thumb: {
              boxShadow: `0 0 0 4px ${alpha(buttonBg, 0.18)}`
            },
            rail: {
              opacity: 0.3
            }
          }
        },
        MuiCheckbox: {
          defaultProps: { size: "small" }
        },
        MuiTable: {
          defaultProps: { size: "small" }
        },
        MuiTabs: {
          styleOverrides: {
            root: {
              minHeight: 36
            },
            indicator: {
              height: 3,
              borderRadius: 2,
              backgroundColor: buttonHover
            }
          }
        },
        MuiTab: {
          styleOverrides: {
            root: {
              minHeight: 36,
              textTransform: "none",
              fontWeight: 600
            }
          }
        },
        MuiTooltip: {
          styleOverrides: {
            tooltip: {
              backgroundColor: hoverWidgetBg,
              border: `1px solid ${hoverWidgetBorder}`,
              color: editorFg
            }
          }
        },
        MuiMenu: {
          styleOverrides: {
            paper: {
              backgroundColor: dropdownBg,
              color: dropdownFg,
              border: `1px solid ${dropdownBorder}`
            }
          }
        },
        MuiMenuItem: {
          styleOverrides: {
            root: {
              "&.Mui-selected, &.Mui-selected:hover": {
                backgroundColor: listSelected
              }
            }
          }
        },
        MuiBadge: {
          styleOverrides: {
            badge: {
              backgroundColor: badgeBg,
              color: badgeFg
            }
          }
        }
      }
    });
  }, [mode, themeVersion]);

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </StyledEngineProvider>
  );
};
