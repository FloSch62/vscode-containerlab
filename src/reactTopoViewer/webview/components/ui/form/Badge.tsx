/**
 * Badge components for form fields
 */
import React from "react";
import { Chip } from "@mui/material";

/**
 * Inheritance badge - shown when a field value comes from defaults, kinds, or groups
 */
export const InheritanceBadge: React.FC = () => (
  <Chip
    label="inherited"
    sx={{
      ml: 1,
      height: 18,
      fontSize: 10,
      backgroundColor: "var(--vscode-badge-background)",
      color: "var(--vscode-badge-foreground)"
    }}
  />
);

/**
 * Read-only badge for displaying non-editable values
 */
export const ReadOnlyBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Chip
    label={children}
    variant="outlined"
    sx={{
      fontSize: 12,
      borderColor: "var(--vscode-textBlockQuote-border)",
      backgroundColor: "var(--vscode-textBlockQuote-background)"
    }}
  />
);
