/**
 * IconSelectorModal - MUI dialog for selecting and customizing node icons.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";

import type { NodeType } from "../../icons/SvgGenerator";
import { generateEncodedSVG } from "../../icons/SvgGenerator";
import { useCustomIcons } from "../../stores/topoViewerStore";
import { postCommand } from "../../messaging/extensionMessaging";
import { isBuiltInIcon } from "../../../shared/types/icons";

const AVAILABLE_ICONS: NodeType[] = [
  "pe",
  "dcgw",
  "leaf",
  "switch",
  "bridge",
  "spine",
  "super-spine",
  "server",
  "pon",
  "controller",
  "rgw",
  "ue",
  "cloud",
  "client"
];

const ICON_LABELS: Record<string, string> = {
  pe: "PE Router",
  dcgw: "DC Gateway",
  leaf: "Leaf",
  switch: "Switch",
  bridge: "Bridge",
  spine: "Spine",
  "super-spine": "Super Spine",
  server: "Server",
  pon: "PON",
  controller: "Controller",
  rgw: "RGW",
  ue: "User Equipment",
  cloud: "Cloud",
  client: "Client"
};

const DEFAULT_COLOR = "#1a73e8";
const MAX_RADIUS = 40;
const COLOR_DEBOUNCE_MS = 50;

function getIconSrc(icon: string, color: string, customIconDataUri?: string): string {
  if (customIconDataUri) {
    return customIconDataUri;
  }
  try {
    return generateEncodedSVG(icon as NodeType, color);
  } catch {
    return generateEncodedSVG("pe", color);
  }
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function useIconSelectorState(
  isOpen: boolean,
  initialIcon: string,
  initialColor: string | null,
  initialCornerRadius: number
) {
  const [icon, setIcon] = useState(initialIcon);
  const [color, setColor] = useState(initialColor || DEFAULT_COLOR);
  const [radius, setRadius] = useState(initialCornerRadius);
  const [useColor, setUseColor] = useState(!!initialColor);

  useEffect(() => {
    if (isOpen) {
      setIcon(initialIcon);
      setColor(initialColor || DEFAULT_COLOR);
      setRadius(initialCornerRadius);
      setUseColor(!!initialColor);
    }
  }, [isOpen, initialIcon, initialColor, initialCornerRadius]);

  const displayColor = useColor ? color : DEFAULT_COLOR;
  const resultColor = useColor && color !== DEFAULT_COLOR ? color : null;

  return {
    icon,
    setIcon,
    color,
    setColor,
    radius,
    setRadius,
    useColor,
    setUseColor,
    displayColor,
    resultColor
  };
}

interface IconSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (icon: string, color: string | null, cornerRadius: number) => void;
  initialIcon?: string;
  initialColor?: string | null;
  initialCornerRadius?: number;
}

interface IconTileProps {
  icon: string;
  isSelected: boolean;
  iconSrc: string;
  cornerRadius: number;
  onClick: () => void;
  onDelete?: () => void;
  isCustom?: boolean;
  source?: "workspace" | "global";
}

const IconTile = React.memo<IconTileProps>(function IconTile({
  icon,
  isSelected,
  iconSrc,
  cornerRadius,
  onClick,
  onDelete,
  isCustom,
  source
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        position: "relative",
        borderColor: isSelected
          ? "var(--vscode-list-activeSelectionBackground)"
          : "var(--vscode-input-border)"
      }}
    >
      <ButtonBase
        onClick={onClick}
        sx={{
          p: 1,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 0.5
        }}
        title={(ICON_LABELS[icon] || icon) + (source ? ` (${source})` : "")}
      >
        <Box
          component="img"
          src={iconSrc}
          alt={icon}
          sx={{
            width: 36,
            height: 36,
            borderRadius: `${(cornerRadius / 48) * 36}px`
          }}
        />
        <Typography variant="caption" noWrap>
          {ICON_LABELS[icon] || icon}
        </Typography>
      </ButtonBase>
      {isCustom && source === "global" && onDelete && (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          sx={{
            position: "absolute",
            top: -8,
            right: -8,
            bgcolor: "var(--vscode-errorForeground)",
            color: "white",
            "&:hover": { bgcolor: "var(--vscode-errorForeground)" }
          }}
          title={`Delete ${icon}`}
        >
          <DeleteIcon fontSize="inherit" />
        </IconButton>
      )}
    </Paper>
  );
});

const ColorPicker: React.FC<{
  color: string;
  enabled: boolean;
  onColorChange: (c: string) => void;
  onToggle: (e: boolean) => void;
}> = ({ color, enabled, onColorChange, onToggle }) => (
  <Stack spacing={1}>
    <Typography variant="subtitle2">Icon Color</Typography>
    <Stack direction="row" spacing={1} alignItems="center">
      <Checkbox checked={enabled} onChange={(e) => onToggle(e.target.checked)} size="small" />
      <Box
        component="input"
        type="color"
        value={color}
        onChange={(e) => {
          onColorChange(e.target.value);
          onToggle(true);
        }}
        disabled={!enabled}
        sx={{
          width: 48,
          height: 28,
          border: "1px solid var(--vscode-input-border)",
          borderRadius: 1,
          backgroundColor: "var(--vscode-input-background)"
        }}
      />
      <TextField
        size="small"
        value={enabled ? color : ""}
        onChange={(e) => {
          if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
            onColorChange(e.target.value);
            onToggle(true);
          }
        }}
        placeholder={DEFAULT_COLOR}
        inputProps={{ maxLength: 7 }}
        disabled={!enabled}
        fullWidth
      />
    </Stack>
  </Stack>
);

const RadiusSlider: React.FC<{ value: number; onChange: (v: number) => void }> = ({
  value,
  onChange
}) => (
  <Stack spacing={1}>
    <Typography variant="subtitle2">Corner Radius: {value}px</Typography>
    <Slider
      size="small"
      min={0}
      max={MAX_RADIUS}
      value={value}
      onChange={(_, newValue) => onChange(newValue as number)}
    />
  </Stack>
);

const PreviewCustom: React.FC<{ iconSrc: string; radius: number }> = ({ iconSrc, radius }) => (
  <Stack spacing={1}>
    <Typography variant="subtitle2">Preview</Typography>
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        bgcolor: "var(--vscode-input-background)"
      }}
    >
      <Box
        component="img"
        src={iconSrc}
        alt="Preview"
        sx={{ width: 56, height: 56, borderRadius: `${(radius / 48) * 56}px` }}
      />
    </Paper>
  </Stack>
);

export const IconSelectorModal: React.FC<IconSelectorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialIcon = "pe",
  initialColor = null,
  initialCornerRadius = 0
}) => {
  const customIcons = useCustomIcons();

  const {
    icon,
    setIcon,
    color,
    setColor,
    radius,
    setRadius,
    useColor,
    setUseColor,
    displayColor,
    resultColor
  } = useIconSelectorState(isOpen, initialIcon, initialColor, initialCornerRadius);

  const debouncedGridColor = useDebouncedValue(displayColor, COLOR_DEBOUNCE_MS);

  const currentCustomIcon = useMemo(() => {
    return customIcons.find((ci) => ci.name === icon);
  }, [customIcons, icon]);

  const iconSources = useMemo(() => {
    const sources: Record<string, string> = {};
    for (const i of AVAILABLE_ICONS) {
      sources[i] = getIconSrc(i, debouncedGridColor);
    }
    return sources;
  }, [debouncedGridColor]);

  const handleSave = useCallback(() => {
    onSave(icon, resultColor, radius);
    onClose();
  }, [icon, resultColor, radius, onSave, onClose]);

  const handleUploadIcon = useCallback(() => {
    postCommand("icon-upload");
  }, []);

  const handleDeleteIcon = useCallback((iconName: string) => {
    postCommand("icon-delete", { iconName });
  }, []);

  const previewIconSrc = useMemo(() => {
    if (currentCustomIcon) {
      return currentCustomIcon.dataUri;
    }
    return getIconSrc(icon, displayColor);
  }, [icon, displayColor, currentCustomIcon]);

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Select Icon</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack spacing={1}>
            <Typography variant="subtitle2">Built-in Icons</Typography>
            <Grid container spacing={1}>
              {AVAILABLE_ICONS.map((i) => (
                <Grid item xs={4} sm={3} md={2} key={i}>
                  <IconTile
                    icon={i}
                    isSelected={icon === i}
                    iconSrc={iconSources[i]}
                    cornerRadius={radius}
                    onClick={() => setIcon(i)}
                  />
                </Grid>
              ))}
            </Grid>
          </Stack>

          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">Custom Icons</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={handleUploadIcon}>
                Add
              </Button>
            </Stack>
            {customIcons.length > 0 ? (
              <Grid container spacing={1}>
                {customIcons.map((ci) => (
                  <Grid item xs={4} sm={3} md={2} key={ci.name}>
                    <IconTile
                      icon={ci.name}
                      isSelected={icon === ci.name}
                      iconSrc={ci.dataUri}
                      cornerRadius={radius}
                      onClick={() => setIcon(ci.name)}
                      onDelete={() => handleDeleteIcon(ci.name)}
                      isCustom
                      source={ci.source}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Paper
                variant="outlined"
                sx={{ p: 2, textAlign: "center", color: "var(--vscode-descriptionForeground)" }}
              >
                No custom icons. Click "Add" to upload.
              </Paper>
            )}
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <Stack spacing={2}>
                {isBuiltInIcon(icon) ? (
                  <ColorPicker
                    color={color}
                    enabled={useColor}
                    onColorChange={setColor}
                    onToggle={setUseColor}
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Custom icons use their original colors.
                  </Typography>
                )}
                <RadiusSlider value={radius} onChange={setRadius} />
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <PreviewCustom iconSrc={previewIconSrc} radius={radius} />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained">
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
};
