/**
 * FormField - Label wrapper with optional tooltip and inheritance badge
 */
import React from "react";
import { FormControl, FormLabel, IconButton, Tooltip } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { InheritanceBadge } from "./Badge";

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
  unit?: string;
  tooltip?: string;
  required?: boolean;
  /** When true, shows an "inherited" badge indicating the value comes from defaults/kinds/groups */
  inherited?: boolean;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  children,
  className = "",
  unit,
  tooltip,
  required,
  inherited
}) => (
  <FormControl fullWidth className={className} sx={{ gap: 0.5 }}>
    <FormLabel
      sx={{
        color: "var(--vscode-descriptionForeground)",
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        fontSize: 12
      }}
    >
      {label}
      {unit && <span>({unit})</span>}
      {required && <span style={{ color: "var(--vscode-editorError-foreground)" }}>*</span>}
      {inherited && <InheritanceBadge />}
      {tooltip && <TooltipIcon tooltip={tooltip} label={label} />}
    </FormLabel>
    {children}
  </FormControl>
);

/**
 * Tooltip icon with hover popup
 */
const TooltipIcon: React.FC<{ tooltip: string; label: string }> = ({ tooltip, label }) => (
  <Tooltip title={tooltip} placement="top">
    <IconButton size="small" aria-label={`${label} help`}>
      <InfoOutlinedIcon fontSize="inherit" />
    </IconButton>
  </Tooltip>
);
