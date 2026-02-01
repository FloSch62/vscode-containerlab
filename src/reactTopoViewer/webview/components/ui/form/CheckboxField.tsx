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
  className?: string;
  disabled?: boolean;
}

export const CheckboxField: React.FC<CheckboxFieldProps> = ({
  id,
  label,
  checked,
  onChange,
  className = "",
  disabled
}) => (
  <FormControlLabel
    className={className}
    control={
      <Checkbox
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        size="small"
      />
    }
    label={label}
  />
);
