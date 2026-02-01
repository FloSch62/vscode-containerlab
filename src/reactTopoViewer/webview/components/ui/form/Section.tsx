/**
 * Section - Bordered section with title and optional inheritance badge
 */
import React from "react";
import { Box, Typography } from "@mui/material";

import { InheritanceBadge } from "./Badge";

interface SectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  hasBorder?: boolean;
  /** When true, shows an "inherited" badge indicating the values come from defaults/kinds/groups */
  inherited?: boolean;
}

export const Section: React.FC<SectionProps> = ({
  title,
  children,
  className = "",
  hasBorder = true,
  inherited
}) => (
  <Box
    className={className}
    sx={{
      pb: hasBorder ? 2 : 0,
      mb: hasBorder ? 2 : 0,
      borderBottom: hasBorder ? "1px solid var(--vscode-panel-border)" : "none"
    }}
  >
    <Typography
      variant="subtitle2"
      sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
    >
      {title}
      {inherited && <InheritanceBadge />}
    </Typography>
    {children}
  </Box>
);
