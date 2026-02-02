/**
 * ShortcutDisplay - MUI chip stack for shortcut feedback.
 */
import React from "react";
import { Chip, Stack } from "@mui/material";

interface ShortcutDisplayItem {
  id: number;
  text: string;
}

interface ShortcutDisplayProps {
  shortcuts: ShortcutDisplayItem[];
}

export const ShortcutDisplay: React.FC<ShortcutDisplayProps> = ({ shortcuts }) => {
  if (shortcuts.length === 0) return null;

  return (
    <Stack
      spacing={1}
      direction="column-reverse"
      sx={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 100000,
        pointerEvents: "none",
        alignItems: "flex-start"
      }}
    >
      {shortcuts.map((shortcut) => (
        <Chip
          key={shortcut.id}
          label={shortcut.text} sx={{
            fontSize: 12,
            backgroundColor: "var(--vscode-editorHoverWidget-background)",
            color: "var(--vscode-editor-foreground)"
          }}
        />
      ))}
    </Stack>
  );
};
