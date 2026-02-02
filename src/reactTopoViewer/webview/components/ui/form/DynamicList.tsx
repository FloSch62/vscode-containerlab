/**
 * DynamicList - Array of string inputs with add/remove
 */
import React from "react";
import { Stack, TextField } from "@mui/material";

import { AddItemButton, DeleteItemButton } from "./ListButtons";

interface DynamicListProps {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  disabled?: boolean;
}

export const DynamicList: React.FC<DynamicListProps> = ({
  items,
  onChange,
  placeholder,
  addLabel = "Add",
  disabled
}) => {
  const handleAdd = () => {
    onChange([...items, ""]);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    onChange(newItems);
  };

  return (
    <Stack spacing={1}>
      {items.map((item, index) => (
        <DynamicListItem
          key={index}
          value={item}
          onChange={(value) => handleChange(index, value)}
          onRemove={() => handleRemove(index)}
          placeholder={placeholder}
          disabled={disabled}
        />
      ))}
      <AddItemButton onAdd={handleAdd} label={addLabel} disabled={disabled} />
    </Stack>
  );
};

/**
 * Single list item with input and delete button
 */
interface DynamicListItemProps {
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  placeholder?: string;
  disabled?: boolean;
}

const DynamicListItem: React.FC<DynamicListItemProps> = ({
  value,
  onChange,
  onRemove,
  placeholder,
  disabled
}) => (
  <Stack direction="row" spacing={1} alignItems="center">
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      fullWidth
    />
    <DeleteItemButton onRemove={onRemove} disabled={disabled} />
  </Stack>
);
