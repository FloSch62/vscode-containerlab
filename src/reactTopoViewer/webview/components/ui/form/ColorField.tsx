/**
 * ColorField - Color picker input with hex display
 */
import React from "react";
import { Box, Stack, TextField } from "@mui/material";

interface ColorFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  showHex?: boolean;
}

export const ColorField: React.FC<ColorFieldProps> = ({
  id,
  value,
  onChange,
  showHex = true
}) => {
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    if (/^#[0-9A-Fa-f]{0,6}$/.test(hex)) {
      onChange(hex);
    }
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box
        component="input"
        type="color"
        id={id}
        value={value || "#000000"}
        onChange={handleColorChange}
        sx={{
          width: 56,
          height: 32,
          cursor: "pointer",
          border: "1px solid var(--vscode-input-border)",
          borderRadius: 1,
          padding: 0.5,
          backgroundColor: "var(--vscode-input-background)"
        }}
      />
      {showHex && (
        <TextField
          value={value || ""}
          onChange={handleHexChange}
          placeholder="#000000"
          inputProps={{ maxLength: 7 }}
          fullWidth
        />
      )}
    </Stack>
  );
};
