/**
 * Wireshark Icon Component
 * SVG icon for Wireshark capture menu items
 */
import React from "react";
import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

// Import wireshark SVG
import wiresharkSvg from "../../assets/images/wireshark_bold.svg";

interface WiresharkIconProps {
  sx?: SxProps<Theme>;
}

export const WiresharkIcon: React.FC<WiresharkIconProps> = ({ sx }) => (
  <Box
    component="img"
    src={wiresharkSvg}
    alt="Wireshark"
    sx={{
      width: "1em",
      height: "1em",
      filter: "brightness(0) invert(1)",
      ...sx
    }}
  />
);
