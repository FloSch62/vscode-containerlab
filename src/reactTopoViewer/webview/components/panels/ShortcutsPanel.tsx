/**
 * ShortcutsPanel - Displays keyboard shortcuts and interactions
 * Migrated from legacy TopoViewer shortcuts-modal.html
 */
import React from "react";
import { Chip, List, ListItem, Stack, Typography } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import SettingsIcon from "@mui/icons-material/Settings";
import LightbulbIcon from "@mui/icons-material/LightbulbOutline";

import { BasePanel } from "../ui/editor/BasePanel";

interface ShortcutsPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

/** Platform detection for keyboard symbols */
const isMac =
  typeof window !== "undefined" &&
  typeof window.navigator !== "undefined" &&
  /macintosh/i.test(window.navigator.userAgent);

/** Converts modifier keys based on platform */
function formatKey(key: string): string {
  if (!isMac) return key;
  return key.replace(/Ctrl/g, "Cmd").replace(/Alt/g, "Option");
}

interface ShortcutRowProps {
  label: string;
  shortcut: string;
}

const ShortcutRow: React.FC<ShortcutRowProps> = ({ label, shortcut }) => (
  <ListItem
    disableGutters
    sx={{ py: 0.5, display: "flex", justifyContent: "space-between" }}
  >
    <Typography variant="body2">{label}</Typography>
    <Chip label={formatKey(shortcut)} size="small" />
  </ListItem>
);

interface ShortcutSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const ShortcutSection: React.FC<ShortcutSectionProps> = ({ title, icon, children }) => (
  <Box>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
      {icon}
      <Typography variant="subtitle2">{title}</Typography>
    </Stack>
    <List dense disablePadding>
      {children}
    </List>
  </Box>
);

export const ShortcutsPanel: React.FC<ShortcutsPanelProps> = ({ isVisible, onClose }) => {
  return (
    <BasePanel
      title="Shortcuts & Interactions"
      isVisible={isVisible}
      onClose={onClose}
      initialPosition={{ x: window.innerWidth - 340, y: 72 }}
      width={320}
      storageKey="shortcuts"
      zIndex={30}
      footer={false}
      minWidth={280}
      minHeight={200}
    >
      <Stack spacing={2}>
        <ShortcutSection title="Viewer Mode" icon={<VisibilityIcon fontSize="small" />}>
          <ShortcutRow label="Select node/link" shortcut="Left Click" />
          <ShortcutRow label="Node actions" shortcut="Right Click" />
          <ShortcutRow label="Capture packets" shortcut="Right Click + Link" />
          <ShortcutRow label="Move nodes" shortcut="Drag" />
        </ShortcutSection>

        <ShortcutSection title="Editor Mode" icon={<EditIcon fontSize="small" />}>
          <ShortcutRow label="Add node" shortcut="Shift + Click" />
          <ShortcutRow label="Create link" shortcut="Shift + Click node" />
          <ShortcutRow label="Delete element" shortcut="Alt + Click" />
          <ShortcutRow label="Context menu" shortcut="Right Click" />
          <ShortcutRow label="Select all" shortcut="Ctrl + A" />
          <ShortcutRow label="Multi-select" shortcut="Ctrl + Click" />
          <ShortcutRow label="Copy selected" shortcut="Ctrl + C" />
          <ShortcutRow label="Paste" shortcut="Ctrl + V" />
          <ShortcutRow label="Duplicate selected" shortcut="Ctrl + D" />
          <ShortcutRow label="Undo" shortcut="Ctrl + Z" />
          <ShortcutRow label="Redo" shortcut="Ctrl + Y" />
          <ShortcutRow label="Create group" shortcut="Ctrl + G" />
          <ShortcutRow label="Delete selected" shortcut="Del" />
        </ShortcutSection>

        <ShortcutSection title="Navigation" icon={<SettingsIcon fontSize="small" />}>
          <ShortcutRow label="Deselect all" shortcut="Esc" />
        </ShortcutSection>

        <ShortcutSection title="Tips" icon={<LightbulbIcon fontSize="small" />}>
          <List dense disablePadding>
            <ListItem disableGutters>
              <Typography variant="body2">Use layout algorithms to auto-arrange</Typography>
            </ListItem>
            <ListItem disableGutters>
              <Typography variant="body2">
                Box select nodes, then <Chip label="Ctrl" size="small" sx={{ mx: 0.5 }} /> +{" "}
                <Chip label="G" size="small" sx={{ mx: 0.5 }} /> to group or{" "}
                <Chip label="Del" size="small" sx={{ mx: 0.5 }} /> to delete
              </Typography>
            </ListItem>
            <ListItem disableGutters>
              <Typography variant="body2">Double-click any item to directly edit</Typography>
            </ListItem>
            <ListItem disableGutters>
              <Typography variant="body2">Shift+Click a node to start creating a link</Typography>
            </ListItem>
          </List>
        </ShortcutSection>
      </Stack>
    </BasePanel>
  );
};
