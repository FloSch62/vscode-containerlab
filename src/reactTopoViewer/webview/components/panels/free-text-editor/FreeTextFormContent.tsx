/**
 * FreeTextFormContent - Sleek, modern form for text annotation editing
 * Supports markdown rendering in preview
 */
import React, { useMemo } from "react";
import {
  Box,
  Button,
  Divider,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import type { FreeTextAnnotation } from "../../../../shared/types/topology";
import { renderMarkdown } from "../../../utils/markdownRenderer";
import { Toggle, ColorSwatch, PREVIEW_GRID_BG } from "../../ui/form";

const FONTS = [
  "monospace",
  "sans-serif",
  "serif",
  "Arial",
  "Helvetica",
  "Courier New",
  "Times New Roman",
  "Georgia"
];

// Helper functions to avoid duplicate calculations
const isBackgroundTransparent = (bg: string | undefined): boolean => bg === "transparent";
const isBackgroundRounded = (rounded: boolean | undefined): boolean => rounded !== false;

interface Props {
  formData: FreeTextAnnotation;
  updateField: <K extends keyof FreeTextAnnotation>(field: K, value: FreeTextAnnotation[K]) => void;
  isNew: boolean;
  onDelete?: () => void;
}

// Formatting toolbar
const Toolbar: React.FC<{ formData: FreeTextAnnotation; updateField: Props["updateField"] }> = ({
  formData,
  updateField
}) => {
  const isBold = formData.fontWeight === "bold";
  const isItalic = formData.fontStyle === "italic";
  const isUnderline = formData.textDecoration === "underline";
  const align = formData.textAlign || "left";

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        p: 1,
        borderRadius: 1,
        bgcolor: "rgba(0,0,0,0.2)",
        backdropFilter: "blur(6px)"
      }}
    >
      <Stack direction="row" spacing={0.5}>
        <ToggleButton
          value="bold"
          selected={isBold}
          onChange={() => updateField("fontWeight", isBold ? "normal" : "bold")}
        >
          <FormatBoldIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton
          value="italic"
          selected={isItalic}
          onChange={() => updateField("fontStyle", isItalic ? "normal" : "italic")}
        >
          <FormatItalicIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton
          value="underline"
          selected={isUnderline}
          onChange={() => updateField("textDecoration", isUnderline ? "none" : "underline")}
        >
          <FormatUnderlinedIcon fontSize="small" />
        </ToggleButton>
      </Stack>
      <Divider orientation="vertical" flexItem />
      <ToggleButtonGroup exclusive
        value={align}
        onChange={(_, value) => {
          if (value) updateField("textAlign", value);
        }}
      >
        <ToggleButton value="left">
          <FormatAlignLeftIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="center">
          <FormatAlignCenterIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="right">
          <FormatAlignRightIcon fontSize="small" />
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
};

// Font controls
const FontControls: React.FC<{
  formData: FreeTextAnnotation;
  updateField: Props["updateField"];
}> = ({ formData, updateField }) => (
  <Stack direction="row" spacing={2}>
    <TextField select
      fullWidth
      label="Font"
      value={formData.fontFamily || "monospace"}
      onChange={(e) => updateField("fontFamily", e.target.value)}
    >
      {FONTS.map((font) => (
        <MenuItem key={font} value={font}>
          {font}
        </MenuItem>
      ))}
    </TextField>
    <TextField label="Size"
      type="number"
      value={formData.fontSize || 14}
      onChange={(e) => updateField("fontSize", parseInt(e.target.value, 10) || 14)}
      inputProps={{ min: 1, max: 72 }}
      sx={{ width: 120 }}
      InputProps={{
        endAdornment: <InputAdornment position="end">px</InputAdornment>
      }}
    />
  </Stack>
);

// Style options (colors, toggles, rotation)
const StyleOptions: React.FC<{
  formData: FreeTextAnnotation;
  updateField: Props["updateField"];
}> = ({ formData, updateField }) => {
  const isTransparent = isBackgroundTransparent(formData.backgroundColor);
  const isRounded = isBackgroundRounded(formData.roundedBackground);

  return (
    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
      <ColorSwatch
        label="Text"
        value={formData.fontColor || "#FFFFFF"}
        onChange={(v) => updateField("fontColor", v)}
      />
      <ColorSwatch
        label="Fill"
        value={isTransparent ? "#000000" : formData.backgroundColor || "#000000"}
        onChange={(v) => updateField("backgroundColor", v)}
        disabled={isTransparent}
      />
      <Stack direction="row" spacing={1}>
        <Toggle
          active={isTransparent}
          onClick={() => updateField("backgroundColor", isTransparent ? "#000000" : "transparent")}
        >
          No Fill
        </Toggle>
        <Toggle active={isRounded} onClick={() => updateField("roundedBackground", !isRounded)}>
          Rounded
        </Toggle>
      </Stack>
      <TextField
        label="Rotate" type="number"
        value={formData.rotation || 0}
        onChange={(e) => updateField("rotation", parseInt(e.target.value, 10) || 0)}
        inputProps={{ min: -360, max: 360 }}
        sx={{ width: 140 }}
      />
    </Stack>
  );
};

// Compute preview content style
function computePreviewStyle(formData: FreeTextAnnotation): React.CSSProperties {
  const isTransparent = isBackgroundTransparent(formData.backgroundColor);
  const isRounded = isBackgroundRounded(formData.roundedBackground);
  return {
    fontFamily: formData.fontFamily || "monospace",
    fontSize: Math.min(formData.fontSize || 14, 22),
    fontWeight: formData.fontWeight || "normal",
    fontStyle: formData.fontStyle || "normal",
    textDecoration: formData.textDecoration || "none",
    textAlign: formData.textAlign || "left",
    color: formData.fontColor || "#FFFFFF",
    backgroundColor: formData.backgroundColor || "transparent",
    padding: !isTransparent ? "6px 12px" : 0,
    borderRadius: isRounded ? 6 : 0,
    transform: `rotate(${formData.rotation || 0}deg)`,
    maxWidth: "100%",
    boxShadow: !isTransparent ? "0 2px 8px rgba(0,0,0,0.3)" : "none"
  };
}

// Preview header component
const PreviewHeader: React.FC = () => (
  <Stack direction="row" justifyContent="space-between" alignItems="center">
    <Typography variant="caption" color="text.secondary">
      Preview
    </Typography>
    <Typography variant="caption" color="text.secondary">
      Markdown supported
    </Typography>
  </Stack>
);

// Live preview with markdown rendering
const Preview: React.FC<{ formData: FreeTextAnnotation }> = ({ formData }) => {
  const renderedHtml = useMemo(() => renderMarkdown(formData.text || ""), [formData.text]);
  const isEmpty = !formData.text?.trim();
  const style = computePreviewStyle(formData);

  return (
    <Stack spacing={1}>
      <PreviewHeader />
      <Box
        sx={{
          position: "relative",
          p: 3,
          borderRadius: 1,
          minHeight: 80,
          border: "1px solid",
          borderColor: "divider",
          backgroundColor: "rgba(0,0,0,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden"
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage: PREVIEW_GRID_BG,
            opacity: 0.5
          }}
        />
        <Box
          className="free-text-markdown"
          sx={{ position: "relative", zIndex: 1, transition: "transform 200ms" }}
          style={style}
        >
          {isEmpty ? (
            <Typography variant="body2" sx={{ opacity: 0.6, fontStyle: "italic" }}>
              Start typing to see preview...
            </Typography>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          )}
        </Box>
      </Box>
    </Stack>
  );
};

// Main component
export const FreeTextFormContent: React.FC<Props> = ({
  formData,
  updateField,
  isNew,
  onDelete
}) => (
  <Stack spacing={2}>
    <TextField
      multiline
      minRows={5}
      maxRows={12}
      value={formData.text}
      onChange={(e) => updateField("text", e.target.value)}
      placeholder="Enter your text... (Markdown and fenced code blocks supported)"
      autoFocus
    />
    <Toolbar formData={formData} updateField={updateField} />
    <FontControls formData={formData} updateField={updateField} />
    <StyleOptions formData={formData} updateField={updateField} />
    <Preview formData={formData} />
    {!isNew && onDelete && (
      <Button color="error"
        startIcon={<DeleteOutlineIcon fontSize="small" />}
        onClick={onDelete}
        sx={{ alignSelf: "flex-start", textTransform: "none" }}
      >
        Delete
      </Button>
    )}
  </Stack>
);
