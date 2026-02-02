/**
 * PalettePanel - MUI drawer for adding nodes, annotations, and networks.
 */
import React, { type ReactNode, useCallback, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import AddIcon from "@mui/icons-material/Add";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import DnsIcon from "@mui/icons-material/Dns";
import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import DeviceHubIcon from "@mui/icons-material/DeviceHub";
import HubIcon from "@mui/icons-material/Hub";
import LinkIcon from "@mui/icons-material/Link";
import PowerOffIcon from "@mui/icons-material/PowerOff";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import MergeTypeIcon from "@mui/icons-material/MergeType";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import CropSquareIcon from "@mui/icons-material/CropSquare";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import GroupWorkIcon from "@mui/icons-material/GroupWork";

import type { CustomNodeTemplate } from "../../../shared/types/editors";
import { ROLE_SVG_MAP, DEFAULT_ICON_COLOR } from "../../../shared/types/graph";
import { generateEncodedSVG, type NodeType } from "../../icons/SvgGenerator";
import { useCustomNodes, useTopoViewerStore } from "../../stores/topoViewerStore";
import { TabNavigation, type TabDefinition } from "../ui/editor/TabNavigation";

interface PalettePanelProps {
  isVisible: boolean;
  onClose: () => void;
  onEditCustomNode?: (nodeName: string) => void;
  onDeleteCustomNode?: (nodeName: string) => void;
  onSetDefaultCustomNode?: (nodeName: string) => void;
}

interface NetworkTypeDefinition {
  readonly type: string;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly color: string;
}

const NETWORK_TYPE_DEFINITIONS: readonly NetworkTypeDefinition[] = [
  {
    type: "host",
    label: "Host",
    icon: <DnsIcon fontSize="small" />,
    color: "var(--vscode-charts-blue)"
  },
  {
    type: "mgmt-net",
    label: "Mgmt Net",
    icon: <SettingsEthernetIcon fontSize="small" />,
    color: "var(--vscode-charts-green)"
  },
  {
    type: "macvlan",
    label: "Macvlan",
    icon: <DeviceHubIcon fontSize="small" />,
    color: "var(--vscode-charts-yellow)"
  },
  {
    type: "vxlan",
    label: "VXLAN",
    icon: <HubIcon fontSize="small" />,
    color: "var(--vscode-charts-blue)"
  },
  {
    type: "vxlan-stitch",
    label: "VXLAN Stitch",
    icon: <LinkIcon fontSize="small" />,
    color: "var(--vscode-charts-green)"
  },
  {
    type: "dummy",
    label: "Dummy",
    icon: <PowerOffIcon fontSize="small" />,
    color: "var(--vscode-descriptionForeground)"
  },
  {
    type: "bridge",
    label: "Bridge",
    icon: <AltRouteIcon fontSize="small" />,
    color: "var(--vscode-charts-blue)"
  },
  {
    type: "ovs-bridge",
    label: "OVS Bridge",
    icon: <MergeTypeIcon fontSize="small" />,
    color: "var(--vscode-charts-green)"
  }
];

function getRoleSvgType(role: string): NodeType {
  const mapped = ROLE_SVG_MAP[role];
  if (mapped) return mapped as NodeType;
  return "pe";
}

function getTemplateIconUrl(template: CustomNodeTemplate): string {
  const role = template.icon || "pe";
  const color = template.iconColor || DEFAULT_ICON_COLOR;
  const svgType = getRoleSvgType(role);
  return generateEncodedSVG(svgType, color);
}

const REACTFLOW_NODE_MIME_TYPE = "application/reactflow-node";

type AnnotationPayload = {
  annotationType: "text" | "shape" | "group";
  shapeType?: string;
};

interface DraggableNodeProps {
  template: CustomNodeTemplate;
  isDefault?: boolean;
  onEdit?: (name: string) => void;
  onDelete?: (name: string) => void;
  onSetDefault?: (name: string) => void;
}

const DraggableNode: React.FC<DraggableNodeProps> = ({
  template,
  isDefault,
  onEdit,
  onDelete,
  onSetDefault
}) => {
  const onDragStart = useCallback(
    (event: React.DragEvent) => {
      event.dataTransfer.setData(
        REACTFLOW_NODE_MIME_TYPE,
        JSON.stringify({
          type: "node",
          templateName: template.name
        })
      );
      event.dataTransfer.effectAllowed = "move";
    },
    [template.name]
  );

  const iconUrl = useMemo(() => getTemplateIconUrl(template), [template]);

  return (
    <Paper
      elevation={0}
      draggable
      onDragStart={onDragStart}
      sx={{
        p: 1.25,
        cursor: "grab",
        "&:hover": {
          backgroundColor: "action.hover",
          borderColor: "primary.main"
        },
        "& [data-role='palette-actions']": {
          opacity: 0.65,
          transition: "opacity 120ms"
        },
        "&:hover [data-role='palette-actions']": { opacity: 1 }
      }}
      title={`Drag to add ${template.name}`}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar
          variant="rounded"
          src={iconUrl}
          sx={{
            width: 36,
            height: 36,
            borderRadius: template.iconCornerRadius ? `${template.iconCornerRadius}px` : 1,
            bgcolor: "var(--vscode-sideBar-background)"
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {template.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {template.kind}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} data-role="palette-actions">
          <Tooltip title={isDefault ? "Default node" : "Set as default node"}>
            <span>
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isDefault) onSetDefault?.(template.name);
                }}
              >
                {isDefault ? (
                  <StarIcon fontSize="inherit" />
                ) : (
                  <StarBorderIcon fontSize="inherit" />
                )}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Edit custom node">
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(template.name);
              }}
            >
              <EditIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete custom node">
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(template.name);
              }}
            >
              <DeleteIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Paper>
  );
};

interface DraggableNetworkProps {
  network: NetworkTypeDefinition;
}

const DraggableNetwork: React.FC<DraggableNetworkProps> = ({ network }) => {
  const onDragStart = useCallback(
    (event: React.DragEvent) => {
      event.dataTransfer.setData(
        REACTFLOW_NODE_MIME_TYPE,
        JSON.stringify({
          type: "network",
          networkType: network.type
        })
      );
      event.dataTransfer.effectAllowed = "move";
    },
    [network.type]
  );

  return (
    <Paper
      elevation={0}
      draggable
      onDragStart={onDragStart}
      sx={{
        p: 1.25,
        cursor: "grab",
        borderLeft: `3px solid ${network.color}`,
        "&:hover": {
          backgroundColor: "action.hover",
          borderColor: "primary.main"
        }
      }}
      title={`Drag to add ${network.label}`}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar
          variant="rounded"
          sx={{
            width: 32,
            height: 32,
            bgcolor: network.color,
            color: "var(--vscode-button-foreground)"
          }}
        >
          {network.icon}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap sx={{ color: network.color }}>
            {network.label}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {network.type}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
};

const NewCustomNodeButton: React.FC<{ onAddNew: () => void }> = ({ onAddNew }) => (
  <Button startIcon={<AddIcon />} onClick={onAddNew}>
    New custom node...
  </Button>
);

interface DraggableAnnotationProps {
  label: string;
  kind: string;
  icon: React.ReactNode;
  payload: AnnotationPayload;
  accentColor: string;
  iconColor?: string;
  tag?: string;
  description?: string;
  onDragStart: (event: React.DragEvent, payload: AnnotationPayload) => void;
}

const DraggableAnnotation: React.FC<DraggableAnnotationProps> = ({
  label,
  kind,
  icon,
  payload,
  accentColor,
  iconColor,
  tag,
  description,
  onDragStart
}) => (
  <Paper
    elevation={0}
    draggable
    onDragStart={(event) => onDragStart(event, payload)}
    sx={{
      p: 1.25,
      cursor: "grab",
      borderLeft: `3px solid ${accentColor}`,
      backgroundColor: "background.paper",
      transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
      "&:hover": {
        backgroundColor: "action.hover",
        borderColor: accentColor,
        transform: "translateY(-1px)",
        boxShadow: "0 8px 16px rgba(0, 0, 0, 0.2)"
      }
    }}
    title="Drag onto the canvas"
  >
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Avatar
        variant="rounded"
        sx={{
          width: 32,
          height: 32,
          bgcolor: accentColor,
          color: iconColor ?? "var(--vscode-button-foreground)"
        }}
      >
        {icon}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {description ?? kind}
        </Typography>
      </Box>
      <Chip
        label={(tag ?? kind).toUpperCase()}
        variant="outlined"
        sx={{
          height: 20,
          fontSize: 10,
          borderColor: accentColor,
          color: accentColor,
          fontWeight: 600,
          letterSpacing: 0.3
        }}
      />
    </Stack>
  </Paper>
);

const TAB_DEFINITIONS: readonly TabDefinition[] = [
  { id: "nodes", label: "Nodes" },
  { id: "annotations", label: "Annotations" }
];

const DRAG_INSTRUCTION_TEXT = "Drag items onto the canvas to add them";

export const PalettePanel: React.FC<PalettePanelProps> = ({
  isVisible,
  onClose,
  onEditCustomNode,
  onDeleteCustomNode,
  onSetDefaultCustomNode
}) => {
  const customNodes = useCustomNodes();
  const defaultNode = useTopoViewerStore((state) => state.defaultNode);
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState("nodes");

  const filteredNodes = useMemo(() => {
    if (!filter) return customNodes;
    const search = filter.toLowerCase();
    return customNodes.filter(
      (node) =>
        node.name.toLowerCase().includes(search) ||
        node.kind.toLowerCase().includes(search) ||
        (node.icon && node.icon.toLowerCase().includes(search))
    );
  }, [customNodes, filter]);

  const filteredNetworks = useMemo(() => {
    if (!filter) return NETWORK_TYPE_DEFINITIONS;
    const search = filter.toLowerCase();
    return NETWORK_TYPE_DEFINITIONS.filter(
      (net) => net.label.toLowerCase().includes(search) || net.type.toLowerCase().includes(search)
    );
  }, [filter]);

  const handleAddNewNode = useCallback(() => {
    onEditCustomNode?.("__new__");
  }, [onEditCustomNode]);

  const handleAnnotationDragStart = useCallback(
    (event: React.DragEvent, payload: AnnotationPayload) => {
      event.dataTransfer.setData(
        REACTFLOW_NODE_MIME_TYPE,
        JSON.stringify({ type: "annotation", ...payload })
      );
      event.dataTransfer.effectAllowed = "move";
    },
    []
  );

  return (
    <PaletteDrawer isOpen={isVisible} onClose={onClose} title="Palette">
      <Box sx={{ px: 2, pt: 1 }}>
        <TabNavigation
          tabs={[...TAB_DEFINITIONS]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          showArrows={false}
        />
      </Box>

      <Box
        sx={{
          p: 2,
          overflow: "auto",
          flex: 1,
          minHeight: 0,
          scrollbarWidth: "thin",
          scrollbarColor: "var(--vscode-scrollbarSlider-background) transparent",
          scrollbarGutter: "stable",
          "&::-webkit-scrollbar": {
            width: 10
          },
          "&::-webkit-scrollbar:horizontal": {
            display: "none"
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent"
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "var(--vscode-scrollbarSlider-background)",
            borderRadius: 999,
            border: "2px solid transparent",
            backgroundClip: "content-box"
          },
          "&::-webkit-scrollbar-thumb:hover": {
            backgroundColor: "var(--vscode-scrollbarSlider-hoverBackground)"
          }
        }}
      >
        {activeTab === "nodes" && (
          <Stack spacing={2}>
            <TextField placeholder="Search nodes..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: filter ? (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setFilter("")}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined
              }}
            />

            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <DnsIcon fontSize="small" />
                <Typography variant="subtitle2">Node Templates</Typography>
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))"
                }}
              >
                {filteredNodes.length === 0 && (
                  <Paper
                    variant="outlined"
                    sx={{ p: 2, textAlign: "center", gridColumn: "1 / -1" }}
                  >
                    {filter ? "No matching templates" : "No node templates defined"}
                  </Paper>
                )}
                {filteredNodes.map((template) => (
                  <DraggableNode
                    key={template.name}
                    template={template}
                    isDefault={template.name === defaultNode || template.setDefault}
                    onEdit={onEditCustomNode}
                    onDelete={onDeleteCustomNode}
                    onSetDefault={onSetDefaultCustomNode}
                  />
                ))}
              </Box>
              {!filter && <NewCustomNodeButton onAddNew={handleAddNewNode} />}
            </Stack>

            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <HubIcon fontSize="small" />
                <Typography variant="subtitle2">Networks</Typography>
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))"
                }}
              >
                {filteredNetworks.length === 0 ? (
                  <Paper
                    variant="outlined"
                    sx={{ p: 2, textAlign: "center", gridColumn: "1 / -1" }}
                  >
                    No matching networks
                  </Paper>
                ) : (
                  filteredNetworks.map((network) => (
                    <DraggableNetwork key={network.type} network={network} />
                  ))
                )}
              </Box>
            </Stack>

            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderLeft: "3px solid var(--vscode-charts-blue)",
                backgroundColor: "background.default"
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <InfoBannerIcon />
                <Typography variant="body2" sx={{ fontStyle: "italic", opacity: 0.9 }}>
                  {DRAG_INSTRUCTION_TEXT}
                </Typography>
              </Stack>
            </Paper>
          </Stack>
        )}

        {activeTab === "annotations" && (
          <Stack spacing={2}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextFieldsIcon fontSize="small" />
                <Typography variant="subtitle2">Text</Typography>
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))"
                }}
              >
                <DraggableAnnotation
                  label="Text"
                  kind="annotation"
                  icon={<TextFieldsIcon fontSize="small" />}
                  payload={{ annotationType: "text" }}
                  accentColor="var(--vscode-charts-blue)"
                  tag="text"
                  description="Free text label"
                  onDragStart={handleAnnotationDragStart}
                />
              </Box>
            </Stack>

            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CropSquareIcon fontSize="small" />
                <Typography variant="subtitle2">Shapes</Typography>
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))"
                }}
              >
                <DraggableAnnotation
                  label="Rectangle"
                  kind="shape"
                  icon={<CropSquareIcon fontSize="small" />}
                  payload={{ annotationType: "shape", shapeType: "rectangle" }}
                  accentColor="var(--vscode-charts-yellow)"
                  iconColor="#1b1b1b"
                  tag="shape"
                  description="Rectangular frame"
                  onDragStart={handleAnnotationDragStart}
                />
                <DraggableAnnotation
                  label="Circle"
                  kind="shape"
                  icon={<RadioButtonUncheckedIcon fontSize="small" />}
                  payload={{ annotationType: "shape", shapeType: "circle" }}
                  accentColor="var(--vscode-charts-yellow)"
                  iconColor="#1b1b1b"
                  tag="shape"
                  description="Circular frame"
                  onDragStart={handleAnnotationDragStart}
                />
                <DraggableAnnotation
                  label="Line"
                  kind="shape"
                  icon={<HorizontalRuleIcon fontSize="small" />}
                  payload={{ annotationType: "shape", shapeType: "line" }}
                  accentColor="var(--vscode-charts-yellow)"
                  iconColor="#1b1b1b"
                  tag="shape"
                  description="Connector line"
                  onDragStart={handleAnnotationDragStart}
                />
              </Box>
            </Stack>

            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <GroupWorkIcon fontSize="small" />
                <Typography variant="subtitle2">Groups</Typography>
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))"
                }}
              >
                <DraggableAnnotation
                  label="Group"
                  kind="annotation"
                  icon={<GroupWorkIcon fontSize="small" />}
                  payload={{ annotationType: "group" }}
                  accentColor="var(--vscode-charts-green)"
                  tag="group"
                  description="Draggable group container"
                  onDragStart={handleAnnotationDragStart}
                />
              </Box>
            </Stack>

            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderLeft: "3px solid var(--vscode-charts-blue)",
                backgroundColor: "background.default"
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <InfoBannerIcon />
                <Typography variant="body2" sx={{ fontStyle: "italic", opacity: 0.9 }}>
                  {DRAG_INSTRUCTION_TEXT}
                </Typography>
              </Stack>
            </Paper>
          </Stack>
        )}
      </Box>
    </PaletteDrawer>
  );
};

const InfoBannerIcon = () => (
  <InfoOutlinedIcon fontSize="small" sx={{ color: "var(--vscode-charts-blue)" }} />
);

interface PaletteDrawerProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

const PaletteDrawer: React.FC<PaletteDrawerProps> = ({ title, isOpen, onClose, children }) => (
  <Drawer
    anchor="left"
    open={isOpen}
    variant="persistent"
    data-testid="node-palette-drawer"
    ModalProps={{ hideBackdrop: true, keepMounted: true }}
    PaperProps={{
      sx: {
        width: 380,
        bgcolor: "var(--vscode-sideBar-background)",
        color: "var(--vscode-sideBar-foreground)",
        boxSizing: "border-box"
      }
    }}
    sx={{
      zIndex: (theme) => theme.zIndex.appBar - 1,
      "& .MuiDrawer-paper": {
        top: "var(--navbar-offset, var(--navbar-height, 52px))",
        bottom: 0,
        height: "auto"
      }
    }}
  >
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
        <Typography variant="subtitle1">{title}</Typography>
        <IconButton onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Divider />
      {children}
    </Box>
  </Drawer>
);
