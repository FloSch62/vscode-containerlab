/**
 * Shared action button for Easter Egg modes
 */
import React from "react";
import { ButtonBase } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

import { BTN_VISIBLE, BTN_HIDDEN, BTN_BLUR, BTN_TRANSITION } from "./buttonConstants";

export interface ModeActionButtonProps {
  onClick: () => void;
  visible: boolean;
  title?: string;
  sx?: SxProps<Theme>;
  children: React.ReactNode;
}

const MODE_ACTION_BUTTON_BASE_SX = {
  px: 3,
  py: 1.25,
  borderRadius: "999px",
  pointerEvents: "auto",
  transition: BTN_TRANSITION,
  backdropFilter: BTN_BLUR,
  fontSize: 14,
  fontWeight: 600,
  textTransform: "none",
  cursor: "pointer"
};

export const ModeActionButton: React.FC<ModeActionButtonProps> = ({
  onClick,
  visible,
  title,
  sx,
  children
}) => (
  <ButtonBase
    onClick={onClick}
    disableRipple
    title={title}
    sx={{
      ...MODE_ACTION_BUTTON_BASE_SX,
      ...(visible ? BTN_VISIBLE : BTN_HIDDEN),
      ...(sx ? (sx as object) : {})
    }}
  >
    {children}
  </ButtonBase>
);
