/**
 * Node Info Panel Component
 * Shows properties of a selected node with selectable/copyable values
 */
import React, { useCallback } from "react";
import { Box, Grid, Stack, Typography } from "@mui/material";

import type { NodeData } from "../../hooks/ui";

import { FloatingPanel } from "./InfoFloatingPanel";

interface NodeInfoPanelProps {
  isVisible: boolean;
  nodeData: NodeData | null;
  onClose: () => void;
}

/**
 * Extract a string property from extraData with fallback to top-level nodeData
 */
function getNodeProperty(
  extraData: Record<string, unknown>,
  nodeData: NodeData,
  extraKey: string,
  topLevelKey: keyof NodeData
): string {
  return (extraData[extraKey] as string) || (nodeData[topLevelKey] as string) || "";
}

/**
 * Extract display properties from node data
 */
function extractNodeDisplayProps(nodeData: NodeData) {
  const extraData = (nodeData.extraData as Record<string, unknown>) || {};

  return {
    nodeName: nodeData.label || nodeData.name || nodeData.id || "Unknown",
    kind: getNodeProperty(extraData, nodeData, "kind", "kind"),
    state: getNodeProperty(extraData, nodeData, "state", "state"),
    image: getNodeProperty(extraData, nodeData, "image", "image"),
    mgmtIpv4: getNodeProperty(extraData, nodeData, "mgmtIpv4Address", "mgmtIpv4"),
    mgmtIpv6: getNodeProperty(extraData, nodeData, "mgmtIpv6Address", "mgmtIpv6"),
    fqdn: getNodeProperty(extraData, nodeData, "fqdn", "fqdn")
  };
}

/**
 * Copyable value component with hover effect
 */
const CopyableValue: React.FC<{ value: string; sx?: Record<string, unknown> }> = ({
  value,
  sx
}) => {
  const handleCopy = useCallback(() => {
    if (value) {
      window.navigator.clipboard.writeText(value).catch(() => {});
    }
  }, [value]);

  if (!value) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.6 }}>
        —
      </Typography>
    );
  }

  return (
    <Box
      component="span"
      onClick={handleCopy}
      title="Click to copy"
      sx={{
        cursor: "pointer",
        userSelect: "text",
        borderRadius: 0.5,
        px: 0.5,
        mx: -0.5,
        transition: "background-color 150ms",
        "&:hover": { bgcolor: "var(--vscode-toolbar-hoverBackground)" },
        "&:active": { bgcolor: "var(--vscode-toolbar-activeBackground)" },
        ...sx
      }}
    >
      {value}
    </Box>
  );
};

/**
 * Property row with label and copyable value
 */
const InfoRow: React.FC<{
  label: string;
  value: string;
  valueSx?: Record<string, unknown>;
  fullWidth?: boolean;
}> = ({ label, value, valueSx, fullWidth = false }) => (
  <Stack spacing={0.5} sx={{ gridColumn: fullWidth ? "1 / -1" : "auto" }}>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}
    >
      {label}
    </Typography>
    <CopyableValue value={value} sx={valueSx} />
  </Stack>
);

/**
 * Get state indicator dot color
 */
function getStateIndicatorColor(lowerState: string): string {
  if (lowerState === "running" || lowerState === "healthy") {
    return "#4ade80";
  }
  if (lowerState === "stopped" || lowerState === "exited") {
    return "#f87171";
  }
  return "var(--vscode-badge-foreground)";
}

/**
 * State badge with color coding
 */
const StateBadge: React.FC<{ state: string }> = ({ state }) => {
  if (!state) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.6 }}>
        —
      </Typography>
    );
  }

  const lowerState = state.toLowerCase();

  let bgColor = "var(--vscode-badge-background)";
  let textColor = "var(--vscode-badge-foreground)";

  if (lowerState === "running" || lowerState === "healthy") {
    bgColor = "rgba(34, 197, 94, 0.2)";
    textColor = "#4ade80";
  } else if (lowerState === "stopped" || lowerState === "exited") {
    bgColor = "rgba(239, 68, 68, 0.2)";
    textColor = "#f87171";
  }

  const indicatorColor = getStateIndicatorColor(lowerState);

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 1,
        py: 0.25,
        borderRadius: 999,
        fontSize: "0.75rem",
        fontWeight: 600,
        bgcolor: bgColor,
        color: textColor
      }}
    >
      <Box
        component="span"
        sx={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          mr: 0.75,
          bgcolor: indicatorColor
        }}
      />
      {state}
    </Box>
  );
};

export const NodeInfoPanel: React.FC<NodeInfoPanelProps> = ({ isVisible, nodeData, onClose }) => {
  if (!nodeData) return null;

  const { nodeName, kind, state, image, mgmtIpv4, mgmtIpv6, fqdn } =
    extractNodeDisplayProps(nodeData);

  return (
    <FloatingPanel
      title="Node Properties"
      isVisible={isVisible}
      onClose={onClose}
      initialPosition={{ x: 20, y: 100 }}
      width={340}
      minWidth={280}
      minHeight={200}
    >
      <Stack spacing={3} sx={{ userSelect: "text" }}>
        <Box sx={{ pb: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}
          >
            Name
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <CopyableValue value={nodeName} sx={{ fontSize: 16, fontWeight: 600 }} />
          </Box>
        </Box>

        <Grid container spacing={2}>
          <Grid size={6}>
            <Stack spacing={0.5}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}
              >
                Kind
              </Typography>
              <CopyableValue value={kind} sx={{ fontSize: 14 }} />
            </Stack>
          </Grid>
          <Grid size={6}>
            <Stack spacing={0.5}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}
              >
                State
              </Typography>
              <StateBadge state={state} />
            </Stack>
          </Grid>
        </Grid>

        <InfoRow label="Image" value={image} fullWidth />

        <Box sx={{ pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Grid container spacing={2}>
            <Grid size={6}>
              <InfoRow label="Mgmt IPv4" value={mgmtIpv4} valueSx={{ fontFamily: "monospace" }} />
            </Grid>
            <Grid size={6}>
              <InfoRow label="Mgmt IPv6" value={mgmtIpv6} valueSx={{ fontFamily: "monospace" }} />
            </Grid>
          </Grid>
        </Box>

        <InfoRow label="FQDN" value={fqdn} fullWidth valueSx={{ fontFamily: "monospace" }} />
      </Stack>
    </FloatingPanel>
  );
};
