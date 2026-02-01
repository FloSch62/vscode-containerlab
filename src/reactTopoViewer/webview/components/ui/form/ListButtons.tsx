/**
 * Shared button components for dynamic list components
 */
import React from "react";
import { Button, IconButton } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";

interface DeleteItemButtonProps {
  onRemove: () => void;
  disabled?: boolean;
}

export const DeleteItemButton: React.FC<DeleteItemButtonProps> = ({ onRemove, disabled }) => (
  <IconButton size="small" onClick={onRemove} aria-label="Remove" disabled={disabled}>
    <DeleteIcon fontSize="small" />
  </IconButton>
);

interface AddItemButtonProps {
  onAdd: () => void;
  label?: string;
  disabled?: boolean;
}

export const AddItemButton: React.FC<AddItemButtonProps> = ({ onAdd, label = "Add", disabled }) => (
  <Button
    size="small"
    variant="outlined"
    onClick={onAdd}
    disabled={disabled}
    startIcon={<AddIcon fontSize="small" />}
  >
    {label}
  </Button>
);
