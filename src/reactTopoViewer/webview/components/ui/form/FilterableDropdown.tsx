/**
 * FilterableDropdown - MUI Autocomplete wrapper.
 */
import React, { useMemo } from "react";
import { Autocomplete, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

export interface FilterableDropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface FilterableDropdownProps {
  id: string;
  options: FilterableDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowFreeText?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  renderOption?: (option: FilterableDropdownOption) => React.ReactNode;
  listboxSx?: SxProps<Theme>;
}

export const FilterableDropdown: React.FC<FilterableDropdownProps> = ({
  id,
  options,
  value,
  onChange,
  placeholder = "Type to filter...",
  allowFreeText = false,
  disabled = false,
  fullWidth = true,
  renderOption,
  listboxSx
}) => {
  const selected = useMemo(() => {
    const match = options.find((opt) => opt.value === value);
    if (match) return match;
    if (allowFreeText && value) {
      return { value, label: value };
    }
    return null;
  }, [options, value, allowFreeText]);

  return (
    <Autocomplete
      id={id}
      options={options}
      value={selected}
      freeSolo={allowFreeText}
      fullWidth={fullWidth}
      disabled={disabled}
      getOptionDisabled={(option) => option.disabled ?? false}
      getOptionLabel={(option) =>
        typeof option === "string" ? option : (option as FilterableDropdownOption).label
      }
      isOptionEqualToValue={(option, val) => option.value === val.value}
      onChange={(_, newValue) => {
        if (typeof newValue === "string") {
          onChange(newValue);
          return;
        }
        if (newValue) {
          onChange(newValue.value);
          return;
        }
        onChange("");
      }}
      onInputChange={(_, newInput, reason) => {
        if (!allowFreeText || reason !== "input") return;
        onChange(newInput);
      }}
      renderOption={(props, option) => (
        <li {...props} key={option.value}>
          {renderOption ? renderOption(option) : option.label}
        </li>
      )}
      ListboxProps={listboxSx ? { sx: listboxSx } : undefined}
      renderInput={(params) => (
        <TextField {...params} placeholder={placeholder} fullWidth={fullWidth} />
      )}
    />
  );
};
