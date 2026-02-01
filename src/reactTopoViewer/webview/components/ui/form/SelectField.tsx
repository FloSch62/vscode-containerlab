/**
 * SelectField - Dropdown select
 */
import React from "react";
import { MenuItem, TextField } from "@mui/material";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder,
  className = "",
  disabled
}) => (
  <TextField
    id={id}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    select
    size="small"
    className={className}
    disabled={disabled}
    fullWidth
  >
    {placeholder && (
      <MenuItem value="" disabled>
        {placeholder}
      </MenuItem>
    )}
    {options.map((opt) => (
      <MenuItem key={opt.value} value={opt.value}>
        {opt.label}
      </MenuItem>
    ))}
  </TextField>
);
