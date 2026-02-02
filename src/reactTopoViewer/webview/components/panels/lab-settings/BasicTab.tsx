/**
 * BasicTab - Basic settings tab for Lab Settings panel
 */
import React from "react";
import { MenuItem, Stack, TextField } from "@mui/material";

import type { PrefixType } from "./types";

interface BasicTabProps {
  labName: string;
  prefixType: PrefixType;
  customPrefix: string;
  isViewMode: boolean;
  onLabNameChange: (value: string) => void;
  onPrefixTypeChange: (value: PrefixType) => void;
  onCustomPrefixChange: (value: string) => void;
}

export const BasicTab: React.FC<BasicTabProps> = ({
  labName,
  prefixType,
  customPrefix,
  isViewMode,
  onLabNameChange,
  onPrefixTypeChange,
  onCustomPrefixChange
}) => {
  return (
    <Stack spacing={2}>
      <TextField label="Lab Name"
        placeholder="Enter lab name"
        value={labName}
        onChange={(e) => onLabNameChange(e.target.value)}
        disabled={isViewMode}
        helperText="Unique name to identify and distinguish this topology from others"
      />

      <TextField select
        label="Container Name Prefix"
        value={prefixType}
        onChange={(e) => onPrefixTypeChange(e.target.value as PrefixType)}
        disabled={isViewMode}
        helperText="Default: clab-<lab-name>-<node-name> | No prefix: <node-name>"
      >
        <MenuItem value="default">Default (clab)</MenuItem>
        <MenuItem value="custom">Custom</MenuItem>
        <MenuItem value="no-prefix">No prefix</MenuItem>
      </TextField>

      {prefixType === "custom" && (
        <TextField label="Custom Prefix"
          placeholder="Enter custom prefix"
          value={customPrefix}
          onChange={(e) => onCustomPrefixChange(e.target.value)}
          disabled={isViewMode}
        />
      )}
    </Stack>
  );
};
