/**
 * FreeShapeFormContent - Sleek, modern form for shape annotation editing
 * Matches the style of FreeTextFormContent
 */
import React, { useMemo } from "react";
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Slider,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import type { FreeShapeAnnotation } from "../../../../shared/types/topology";
import {
  DEFAULT_SHAPE_WIDTH,
  DEFAULT_SHAPE_HEIGHT,
  DEFAULT_FILL_COLOR,
  DEFAULT_FILL_OPACITY,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_BORDER_STYLE,
  DEFAULT_ARROW_SIZE,
  DEFAULT_CORNER_RADIUS
} from "../../../annotations/constants";
import { Toggle, ColorSwatch, NumberInput, PREVIEW_GRID_BG } from "../../ui/form";

import { buildShapeSvg } from "./FreeShapeSvg";

interface Props {
  formData: FreeShapeAnnotation;
  updateField: <K extends keyof FreeShapeAnnotation>(
    field: K,
    value: FreeShapeAnnotation[K]
  ) => void;
  isNew: boolean;
  onDelete?: () => void;
}

// Shape type selector
const ShapeTypeSelector: React.FC<{
  value: FreeShapeAnnotation["shapeType"];
  onChange: (v: FreeShapeAnnotation["shapeType"]) => void;
}> = ({ value, onChange }) => (
  <TextField
    label="Shape Type" select
    value={value}
    onChange={(e) => onChange(e.target.value as FreeShapeAnnotation["shapeType"])}
  >
    <MenuItem value="rectangle">Rectangle</MenuItem>
    <MenuItem value="circle">Circle</MenuItem>
    <MenuItem value="line">Line</MenuItem>
  </TextField>
);

// Size controls
const SizeControls: React.FC<{
  formData: FreeShapeAnnotation;
  updateField: Props["updateField"];
}> = ({ formData, updateField }) => {
  if (formData.shapeType === "line") return null;
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6 }}>
        <NumberInput
          label="Width"
          value={formData.width ?? DEFAULT_SHAPE_WIDTH}
          onChange={(v) => updateField("width", v)}
          min={5}
          max={2000}
          unit="px"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <NumberInput
          label="Height"
          value={formData.height ?? DEFAULT_SHAPE_HEIGHT}
          onChange={(v) => updateField("height", v)}
          min={5}
          max={2000}
          unit="px"
        />
      </Grid>
    </Grid>
  );
};

// Fill controls
const FillControls: React.FC<{
  formData: FreeShapeAnnotation;
  updateField: Props["updateField"];
}> = ({ formData, updateField }) => {
  if (formData.shapeType === "line") return null;

  const opacity = formData.fillOpacity ?? DEFAULT_FILL_OPACITY;
  const isTransparent = opacity === 0;
  const opacityPercent = Math.round(opacity * 100);

  return (
    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
      <ColorSwatch
        label="Fill"
        value={formData.fillColor ?? DEFAULT_FILL_COLOR}
        onChange={(v) => updateField("fillColor", v)}
        disabled={isTransparent}
      />
      <Box sx={{ flex: 1, minWidth: 160 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Opacity
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {opacityPercent}%
          </Typography>
        </Stack>
        <Slider min={0}
          max={100}
          value={opacityPercent}
          onChange={(_, next) => updateField("fillOpacity", (next as number) / 100)}
        />
      </Box>
      <Toggle
        active={isTransparent}
        onClick={() => updateField("fillOpacity", isTransparent ? 1 : 0)}
      >
        Transparent
      </Toggle>
    </Stack>
  );
};

// Border/Line controls
const BorderControls: React.FC<{
  formData: FreeShapeAnnotation;
  updateField: Props["updateField"];
}> = ({ formData, updateField }) => {
  const isLine = formData.shapeType === "line";
  const borderWidth = formData.borderWidth ?? DEFAULT_BORDER_WIDTH;
  const noBorder = borderWidth === 0;

  return (
    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
      <ColorSwatch
        label={isLine ? "Line" : "Border"}
        value={formData.borderColor ?? DEFAULT_BORDER_COLOR}
        onChange={(v) => updateField("borderColor", v)}
        disabled={noBorder}
      />
      <NumberInput
        label={isLine ? "Width" : "Border"}
        value={borderWidth}
        onChange={(v) => updateField("borderWidth", v)}
        min={0}
        max={20}
        unit="px"
      />
      <TextField
        label="Style" select
        value={formData.borderStyle ?? DEFAULT_BORDER_STYLE}
        onChange={(e) =>
          updateField("borderStyle", e.target.value as FreeShapeAnnotation["borderStyle"])
        }
        sx={{ minWidth: 140 }}
      >
        <MenuItem value="solid">Solid</MenuItem>
        <MenuItem value="dashed">Dashed</MenuItem>
        <MenuItem value="dotted">Dotted</MenuItem>
      </TextField>
      {!isLine && (
        <Toggle
          active={noBorder}
          onClick={() => updateField("borderWidth", noBorder ? DEFAULT_BORDER_WIDTH : 0)}
        >
          No Border
        </Toggle>
      )}
    </Stack>
  );
};

// Corner radius (rectangle only)
const CornerRadiusControl: React.FC<{
  formData: FreeShapeAnnotation;
  updateField: Props["updateField"];
}> = ({ formData, updateField }) => {
  if (formData.shapeType !== "rectangle") return null;
  return (
    <NumberInput
      label="Corner Radius"
      value={formData.cornerRadius ?? DEFAULT_CORNER_RADIUS}
      onChange={(v) => updateField("cornerRadius", v)}
      min={0}
      max={100}
      unit="px"
    />
  );
};

// Line arrow controls
const ArrowControls: React.FC<{
  formData: FreeShapeAnnotation;
  updateField: Props["updateField"];
}> = ({ formData, updateField }) => {
  if (formData.shapeType !== "line") return null;
  const hasArrows = formData.lineStartArrow || formData.lineEndArrow;
  return (
    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
      <Stack direction="row" spacing={1}>
        <Toggle
          active={formData.lineStartArrow ?? false}
          onClick={() => updateField("lineStartArrow", !formData.lineStartArrow)}
        >
          Start Arrow
        </Toggle>
        <Toggle
          active={formData.lineEndArrow ?? false}
          onClick={() => updateField("lineEndArrow", !formData.lineEndArrow)}
        >
          End Arrow
        </Toggle>
      </Stack>
      {hasArrows && (
        <NumberInput
          label="Arrow Size"
          value={formData.lineArrowSize ?? DEFAULT_ARROW_SIZE}
          onChange={(v) => updateField("lineArrowSize", v)}
          min={5}
          max={50}
          unit="px"
        />
      )}
    </Stack>
  );
};

// Rotation control (not for lines)
const RotationControl: React.FC<{
  formData: FreeShapeAnnotation;
  updateField: Props["updateField"];
}> = ({ formData, updateField }) => {
  if (formData.shapeType === "line") return null;
  return (
    <NumberInput
      label="Rotation"
      value={formData.rotation ?? 0}
      onChange={(v) => updateField("rotation", v)}
      min={-360}
      max={360}
      unit="deg"
    />
  );
};

// Preview component
const Preview: React.FC<{ formData: FreeShapeAnnotation }> = ({ formData }) => {
  const { svg, width, height } = useMemo(() => buildShapeSvg(formData), [formData]);

  // Scale down preview if shape is too large
  const maxPreviewSize = 120;
  const scale = Math.min(1, maxPreviewSize / Math.max(width, height));
  const rotation = formData.shapeType === "line" ? 0 : (formData.rotation ?? 0);

  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        Preview
      </Typography>
      <Box
        sx={{
          position: "relative",
          p: 3,
          borderRadius: 1,
          minHeight: 100,
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
          sx={{
            position: "relative",
            zIndex: 1,
            transform: `rotate(${rotation}deg) scale(${scale})`,
            width,
            height,
            transition: "transform 200ms"
          }}
        >
          {svg}
        </Box>
      </Box>
    </Stack>
  );
};

// Main component
export const FreeShapeFormContent: React.FC<Props> = ({
  formData,
  updateField,
  isNew,
  onDelete
}) => (
  <Stack spacing={2}>
    <ShapeTypeSelector value={formData.shapeType} onChange={(v) => updateField("shapeType", v)} />
    <SizeControls formData={formData} updateField={updateField} />
    <FillControls formData={formData} updateField={updateField} />
    <BorderControls formData={formData} updateField={updateField} />
    <CornerRadiusControl formData={formData} updateField={updateField} />
    <ArrowControls formData={formData} updateField={updateField} />
    <RotationControl formData={formData} updateField={updateField} />
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
