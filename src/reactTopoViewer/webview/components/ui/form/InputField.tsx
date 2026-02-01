/**
 * InputField - Text or number input
 */
import React from "react";
import { TextField } from "@mui/material";

interface InputFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
  step,
  className = "",
  disabled
}) => (
  <TextField
    id={id}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    type={type}
    size="small"
    className={className}
    inputProps={{ min, max, step }}
    disabled={disabled}
    fullWidth
  />
);
