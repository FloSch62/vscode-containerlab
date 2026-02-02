/**
 * Shared form components for annotation editors
 * Used by FreeShape, FreeText, and Group editors
 */
import React from "react";
import { Box, InputAdornment, MenuItem, Slider, TextField, ToggleButton } from "@mui/material";

import { normalizeHexColor } from "../../../utils/color";

/**
 * Toggle pill button
 */
export const Toggle: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <ToggleButton value="toggle" selected={active} onChange={onClick}>
    {children}
  </ToggleButton>
);

/**
 * Color swatch input with label
 */
export const ColorSwatch: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}> = ({ label, value, onChange, disabled }) => {
  const inputValue = normalizeHexColor(value);
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Box component="span" sx={{ fontSize: 12, color: "var(--vscode-descriptionForeground)" }}>
        {label}
      </Box>
      <Box
        component="input"
        type="color"
        value={inputValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        sx={{
          width: 32,
          height: 32,
          cursor: "pointer",
          border: "1px solid var(--vscode-input-border)",
          borderRadius: 1,
          backgroundColor: "var(--vscode-input-background)",
          opacity: disabled ? 0.4 : 1
        }}
      />
    </Box>
  );
};

/**
 * Number input with label and optional unit
 */
export const NumberInput: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}> = ({ label, value, onChange, min = 0, max = 999, step = 1, unit }) => (
  <TextField
    label={label}
    type="number"
    value={value}
    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    inputProps={{ min, max, step }}
    InputProps={{
      endAdornment: unit ? <InputAdornment position="end">{unit}</InputAdornment> : undefined
    }}
  />
);

/**
 * Text input with label
 */
export const TextInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <TextField
    label={label}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
  />
);

/**
 * Select input with label
 */
export const SelectInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <TextField
    label={label}
    select
    value={value}
    onChange={(e) => onChange(e.target.value)}
  >
    {options.map((opt) => (
      <MenuItem key={opt.value} value={opt.value}>
        {opt.label}
      </MenuItem>
    ))}
  </TextField>
);

/**
 * Range slider with label and value display
 */
export const RangeSlider: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}> = ({ label, value, onChange, min = 0, max = 100, unit = "%" }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 140, flex: 1 }}>
    <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span>{label}</span>
      <span>
        {value}
        {unit}
      </span>
    </Box>
    <Slider
      min={min}
      max={max}
      value={value}
      onChange={(_, newValue) => onChange(newValue as number)}
    />
  </Box>
);

/**
 * Grid pattern background for previews
 */
export const PREVIEW_GRID_BG =
  "url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cdefs%3E%3Cpattern%20id%3D%22grid%22%20width%3D%2220%22%20height%3D%2220%22%20patternUnits%3D%22userSpaceOnUse%22%3E%3Cpath%20d%3D%22M%200%200%20L%2020%200%2020%2020%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.03)%22%20stroke-width%3D%221%22%2F%3E%3C%2Fpattern%3E%3C%2Fdefs%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22url(%23grid)%22%2F%3E%3C%2Fsvg%3E')";
