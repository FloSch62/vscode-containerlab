/**
 * KeyValueList - Dynamic key-value pairs
 */
import React from "react";
import { Stack, TextField } from "@mui/material";

import { AddItemButton, DeleteItemButton } from "./ListButtons";

interface KeyValueListProps {
  items: Record<string, string>;
  onChange: (items: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
  disabled?: boolean;
}

export const KeyValueList: React.FC<KeyValueListProps> = ({
  items,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  addLabel = "Add",
  disabled
}) => {
  const entries = Object.entries(items);

  const handleAdd = () => {
    const newKey = `key${entries.length + 1}`;
    onChange({ ...items, [newKey]: "" });
  };

  const handleRemove = (key: string) => {
    const newItems = { ...items };
    delete newItems[key];
    onChange(newItems);
  };

  const handleKeyChange = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const newItems: Record<string, string> = {};
    for (const [k, v] of Object.entries(items)) {
      newItems[k === oldKey ? newKey : k] = v;
    }
    onChange(newItems);
  };

  const handleValueChange = (key: string, value: string) => {
    onChange({ ...items, [key]: value });
  };

  return (
    <Stack spacing={1}>
      {entries.map(([key, value], index) => (
        <KeyValueItem
          key={index}
          itemKey={key}
          value={value}
          onKeyChange={(newKey) => handleKeyChange(key, newKey)}
          onValueChange={(val) => handleValueChange(key, val)}
          onRemove={() => handleRemove(key)}
          keyPlaceholder={keyPlaceholder}
          valuePlaceholder={valuePlaceholder}
          disabled={disabled}
        />
      ))}
      <AddItemButton onAdd={handleAdd} label={addLabel} disabled={disabled} />
    </Stack>
  );
};

/**
 * Single key-value item
 */
interface KeyValueItemProps {
  itemKey: string;
  value: string;
  onKeyChange: (key: string) => void;
  onValueChange: (value: string) => void;
  onRemove: () => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
  disabled?: boolean;
}

const KeyValueItem: React.FC<KeyValueItemProps> = ({
  itemKey,
  value,
  onKeyChange,
  onValueChange,
  onRemove,
  keyPlaceholder,
  valuePlaceholder,
  disabled
}) => (
  <Stack direction="row" spacing={1} alignItems="center">
    <TextField
      size="small"
      value={itemKey}
      onChange={(e) => onKeyChange(e.target.value)}
      placeholder={keyPlaceholder}
      disabled={disabled}
      sx={{ width: "33%" }}
    />
    <TextField
      size="small"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={valuePlaceholder}
      disabled={disabled}
      fullWidth
    />
    <DeleteItemButton onRemove={onRemove} disabled={disabled} />
  </Stack>
);
