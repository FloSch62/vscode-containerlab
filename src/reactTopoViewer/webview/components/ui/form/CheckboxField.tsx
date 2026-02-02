/**
 * CheckboxField - Checkbox with label
 */
import React from "react";
import { Checkbox, FormControlLabel } from "@mui/material";

interface CheckboxFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const CheckboxField: React.FC<CheckboxFieldProps> = ({
  id,
  label,
  checked,
  onChange,
  disabled
}) => (
  <FormControlLabel
    sx={{
      m: 0,
      minHeight: 28,
      "& .MuiFormControlLabel-label": { lineHeight: 1.2 }
    }}
    control={
      <Checkbox
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
    }
    label={label}
  />
);
