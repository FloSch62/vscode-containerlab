/**
 * Navbar Component - MUI AppBar for React TopoViewer
 */
import React from "react";
import {
  AppBar,
  Box,
  Button,
  ButtonGroup,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  ListItemIcon,
  Menu,
  MenuItem,
  Slider,
  Stack,
  Toolbar,
  Tooltip,
  Typography
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import AddIcon from "@mui/icons-material/Add";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import GridOnIcon from "@mui/icons-material/GridOn";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import ReplayIcon from "@mui/icons-material/Replay";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckIcon from "@mui/icons-material/Check";

import type { LinkLabelMode } from "../../stores/topoViewerStore";
import {
  useEndpointLabelOffset,
  useIsLocked,
  useIsProcessing,
  useLabName,
  useLinkLabelMode,
  useMode,
  useProcessingMode,
  useShowDummyLinks,
  useTopoViewerActions
} from "../../stores/topoViewerStore";
import {
  DEFAULT_GRID_LINE_WIDTH,
  DEFAULT_GRID_STYLE,
  useDeploymentCommands
} from "../../hooks/ui";
import type { GridStyle, LayoutOption } from "../../hooks/ui";
import { saveViewerSettings } from "../../services";
import {
  ENDPOINT_LABEL_OFFSET_MAX,
  ENDPOINT_LABEL_OFFSET_MIN
} from "../../annotations/endpointLabelOffset";

import { ContainerlabLogo } from "./ContainerlabLogo";

type ProcessingMode = "deploy" | "destroy";

const DEPLOY_MODE: ProcessingMode = "deploy";
const DESTROY_MODE: ProcessingMode = "destroy";

interface NavbarProps {
  onZoomToFit?: () => void;
  onToggleLayout?: () => void;
  layout: LayoutOption;
  onLayoutChange: (layout: LayoutOption) => void;
  gridLineWidth: number;
  onGridLineWidthChange: (width: number) => void;
  gridStyle: GridStyle;
  onGridStyleChange: (style: GridStyle) => void;
  onLabSettings?: () => void;
  onToggleSplit?: () => void;
  onFindNode?: () => void;
  onCaptureViewport?: () => void;
  onShowShortcuts?: () => void;
  onShowAbout?: () => void;
  onOpenNodePalette?: () => void;
  onLockedAction?: () => void;
  lockShakeActive?: boolean;
  shortcutDisplayEnabled?: boolean;
  onToggleShortcutDisplay?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onLogoClick?: () => void;
  logoClickProgress?: number;
  isPartyMode?: boolean;
}

const LINK_LABEL_MODES: { value: LinkLabelMode; label: string }[] = [
  { value: "show-all", label: "Show Labels" },
  { value: "on-select", label: "Show Link Labels on Select" },
  { value: "hide", label: "No Labels" }
];

const LAYOUT_OPTIONS: { value: LayoutOption; label: string }[] = [
  { value: "preset", label: "Preset" },
  { value: "force", label: "Force-Directed" },
  { value: "geo", label: "GeoMap" }
];

const GRID_STYLE_OPTIONS: { value: GridStyle; label: string }[] = [
  { value: "dotted", label: "Dotted" },
  { value: "quadratic", label: "Quadractic" }
];

function getLayoutLabel(option: LayoutOption): string {
  const match = LAYOUT_OPTIONS.find((o) => o.value === option);
  return match ? match.label : option;
}

function useMenuState() {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  return {
    anchorEl,
    isOpen: Boolean(anchorEl),
    openMenu: (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget),
    closeMenu: () => setAnchorEl(null)
  };
}

const NavIconButton: React.FC<{
  title: string;
  icon: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  active?: boolean;
  disabled?: boolean;
  testId?: string;
  className?: string;
  ariaPressed?: boolean;
}> = ({ title, icon, onClick, active, disabled, testId, className, ariaPressed }) => (
  <Tooltip title={title}>
    <span>
      <IconButton
        size="medium"
        onClick={onClick}
        disabled={disabled}
        data-testid={testId}
        aria-pressed={ariaPressed}
        color={active ? "primary" : "default"}
        className={className}
        sx={{
          width: 36,
          height: 36,
          "& svg": { fontSize: 20 }
        }}
      >
        {icon}
      </IconButton>
    </span>
  </Tooltip>
);

export const Navbar: React.FC<NavbarProps> = ({
  onZoomToFit,
  onToggleLayout,
  layout,
  onLayoutChange,
  gridLineWidth,
  onGridLineWidthChange,
  gridStyle,
  onGridStyleChange,
  onLabSettings,
  onToggleSplit,
  onFindNode,
  onCaptureViewport,
  onShowShortcuts,
  onShowAbout,
  onOpenNodePalette,
  onLockedAction,
  lockShakeActive = false,
  shortcutDisplayEnabled = false,
  onToggleShortcutDisplay,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onLogoClick,
  logoClickProgress = 0,
  isPartyMode = false
}) => {
  const appBarRef = React.useRef<HTMLDivElement | null>(null);
  const mode = useMode();
  const labName = useLabName();
  const isLocked = useIsLocked();
  const isProcessing = useIsProcessing();
  const processingMode = useProcessingMode();

  const { toggleLock } = useTopoViewerActions();

  const isViewerMode = mode === "view";
  const isEditMode = mode === "edit" && !isProcessing;

  const handleOpenNodePalette = React.useCallback(() => {
    if (isLocked) {
      onLockedAction?.();
      return;
    }
    onOpenNodePalette?.();
  }, [isLocked, onLockedAction, onOpenNodePalette]);

  React.useLayoutEffect(() => {
    if (!appBarRef.current) return;
    const root = document.documentElement;
    const updateHeight = () => {
      const height = appBarRef.current?.getBoundingClientRect().height;
      if (!height) return;
      root.style.setProperty("--navbar-offset", `${Math.round(height)}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(appBarRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <AppBar
      ref={appBarRef}
      position="fixed"
      elevation={0}
      sx={{
        backgroundColor: "var(--vscode-panel-background)",
        color: "var(--vscode-panel-foreground)",
        borderBottom: "1px solid var(--vscode-panel-border)"
      }}
    >
      <Toolbar
        sx={{
          minHeight: "var(--navbar-height)",
          height: "var(--navbar-height)",
          gap: 2,
          px: 1.5,
          py: 0
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1 }}>
          <NavbarLogo
            onClick={onLogoClick}
            clickProgress={logoClickProgress}
            isPartyMode={isPartyMode}
          />
          <NavbarTitle mode={mode} labName={labName} isProcessing={isProcessing} />
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
          <NavIconButton
            icon={<SettingsOutlinedIcon fontSize="small" />}
            title="Lab Settings"
            onClick={onLabSettings}
            testId="navbar-lab-settings"
          />

          <NavIconButton
            icon={isLocked ? <LockOutlinedIcon fontSize="small" /> : <LockOpenOutlinedIcon fontSize="small" />}
            title={isLocked ? "Unlock Lab" : "Lock Lab"}
            onClick={toggleLock}
            disabled={isProcessing}
            className={lockShakeActive ? "lock-shake" : undefined}
            ariaPressed={isLocked}
            testId="navbar-lock"
          />

          <DeployControl
            isViewerMode={isViewerMode}
            isProcessing={isProcessing}
            processingMode={processingMode}
          />

          {isEditMode && (
            <NavIconButton
              icon={<AddIcon fontSize="small" />}
              title="Open Palette"
              onClick={handleOpenNodePalette}
              testId="navbar-node-palette"
            />
          )}

          {isEditMode && (
            <NavIconButton
              icon={<UndoIcon fontSize="small" />}
              title="Undo (Ctrl+Z)"
              onClick={onUndo}
              disabled={!canUndo}
              testId="navbar-undo"
            />
          )}

          {isEditMode && (
            <NavIconButton
              icon={<RedoIcon fontSize="small" />}
              title="Redo (Ctrl+Y)"
              onClick={onRedo}
              disabled={!canRedo}
              testId="navbar-redo"
            />
          )}

          <NavIconButton
            icon={<FitScreenIcon fontSize="small" />}
            title="Fit to Viewport"
            onClick={onZoomToFit}
            testId="navbar-fit-viewport"
          />

          <NavIconButton
            icon={<ViewColumnIcon fontSize="small" />}
            title="Toggle YAML Split View"
            onClick={onToggleSplit}
            testId="navbar-split-view"
          />

          <LayoutDropdown layout={layout} onLayoutChange={onLayoutChange} onToggleLayout={onToggleLayout} />

          <GridDropdown
            value={gridLineWidth}
            gridStyle={gridStyle}
            onChange={onGridLineWidthChange}
            onGridStyleChange={onGridStyleChange}
          />

          <NavIconButton
            icon={<TravelExploreIcon fontSize="small" />}
            title="Find Node"
            onClick={onFindNode}
            testId="navbar-find-node"
          />

          <LinkLabelDropdown />

          <NavIconButton
            icon={<PhotoCameraIcon fontSize="small" />}
            title="Capture Viewport as SVG"
            onClick={onCaptureViewport}
            testId="navbar-capture"
          />

          <NavIconButton
            icon={<KeyboardIcon fontSize="small" />}
            title="Shortcuts"
            onClick={onShowShortcuts}
            testId="navbar-shortcuts"
          />

          <NavIconButton
            icon={
              shortcutDisplayEnabled ? (
                <VisibilityIcon fontSize="small" />
              ) : (
                <VisibilityOffIcon fontSize="small" />
              )
            }
            title="Toggle Shortcut Display"
            onClick={onToggleShortcutDisplay}
            active={shortcutDisplayEnabled}
            testId="navbar-shortcut-display"
          />

          <NavIconButton
            icon={<InfoOutlinedIcon fontSize="small" />}
            title="About TopoViewer"
            onClick={onShowAbout}
            testId="navbar-about"
          />
        </Stack>
      </Toolbar>

      <NavbarLoadingIndicator isActive={isProcessing} mode={processingMode} />
    </AppBar>
  );
};

const LinkLabelDropdown: React.FC = () => {
  const linkLabelMode = useLinkLabelMode();
  const showDummyLinks = useShowDummyLinks();
  const endpointLabelOffset = useEndpointLabelOffset();
  const isLocked = useIsLocked();
  const { setLinkLabelMode, toggleDummyLinks, setEndpointLabelOffset } = useTopoViewerActions();
  const menu = useMenuState();

  const saveEndpointLabelOffset = React.useCallback(() => {
    void saveViewerSettings({ endpointLabelOffset });
  }, [endpointLabelOffset]);

  return (
    <>
      <NavIconButton
        icon={<LocalOfferIcon fontSize="small" />}
        title="Link Labels"
        onClick={menu.openMenu}
        active={menu.isOpen}
        testId="navbar-link-labels"
      />
      <Menu anchorEl={menu.anchorEl} open={menu.isOpen} onClose={menu.closeMenu}>
        {LINK_LABEL_MODES.map(({ value, label }) => (
          <MenuItem
            key={value}
            selected={linkLabelMode === value}
            onClick={() => {
              setLinkLabelMode(value);
              menu.closeMenu();
            }}
          >
            {linkLabelMode === value && (
              <ListItemIcon>
                <CheckIcon fontSize="small" />
              </ListItemIcon>
            )}
            {label}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          onClick={() => {
            toggleDummyLinks();
          }}
        >
          <ListItemIcon>
            {showDummyLinks ? <CheckIcon fontSize="small" /> : null}
          </ListItemIcon>
          Show Dummy Links
        </MenuItem>
        <Divider />
        <Box sx={{ px: 2, py: 1, width: 240 }}>
          <Typography variant="caption" sx={{ display: "block", mb: 1 }}>
            Endpoint offset: {endpointLabelOffset.toFixed(0)}
          </Typography>
          <Slider
            size="small"
            min={ENDPOINT_LABEL_OFFSET_MIN}
            max={ENDPOINT_LABEL_OFFSET_MAX}
            step={1}
            value={endpointLabelOffset}
            onChange={(_, value) => setEndpointLabelOffset(value as number)}
            onChangeCommitted={saveEndpointLabelOffset}
            disabled={isLocked}
          />
        </Box>
      </Menu>
    </>
  );
};

const LayoutDropdown: React.FC<{
  layout: LayoutOption;
  onLayoutChange: (layout: LayoutOption) => void;
  onToggleLayout?: () => void;
}> = ({ layout, onLayoutChange, onToggleLayout }) => {
  const menu = useMenuState();

  return (
    <>
      <NavIconButton
        icon={<AccountTreeIcon fontSize="small" />}
        title={`Layout: ${getLayoutLabel(layout)}`}
        onClick={menu.openMenu}
        active={menu.isOpen}
        testId="navbar-layout"
      />
      <Menu anchorEl={menu.anchorEl} open={menu.isOpen} onClose={menu.closeMenu}>
        {LAYOUT_OPTIONS.map(({ value, label }) => (
          <MenuItem
            key={value}
            selected={layout === value}
            onClick={() => {
              onLayoutChange(value);
              onToggleLayout?.();
              menu.closeMenu();
            }}
          >
            {layout === value && (
              <ListItemIcon>
                <CheckIcon fontSize="small" />
              </ListItemIcon>
            )}
            {label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

const GridDropdown: React.FC<{
  value: number;
  gridStyle: GridStyle;
  onChange: (width: number) => void;
  onGridStyleChange: (style: GridStyle) => void;
}> = ({ value, gridStyle, onChange, onGridStyleChange }) => {
  const menu = useMenuState();

  return (
    <>
      <NavIconButton
        icon={<GridOnIcon fontSize="small" />}
        title="Grid settings"
        onClick={menu.openMenu}
        active={menu.isOpen}
        testId="navbar-grid"
      />
      <Menu anchorEl={menu.anchorEl} open={menu.isOpen} onClose={menu.closeMenu}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" sx={{ display: "block", mb: 1 }}>
            Grid style
          </Typography>
          {GRID_STYLE_OPTIONS.map(({ value: styleValue, label }) => (
            <MenuItem
              key={styleValue}
              selected={gridStyle === styleValue}
              onClick={() => onGridStyleChange(styleValue)}
            >
              {gridStyle === styleValue && (
                <ListItemIcon>
                  <CheckIcon fontSize="small" />
                </ListItemIcon>
              )}
              {label}
            </MenuItem>
          ))}
          <MenuItem onClick={() => onGridStyleChange(DEFAULT_GRID_STYLE)}>
            Reset to {DEFAULT_GRID_STYLE}
          </MenuItem>
        </Box>
        <Divider />
        <Box sx={{ px: 2, py: 1, width: 240 }}>
          <Typography variant="caption" sx={{ display: "block", mb: 1 }}>
            Grid line width: {value.toFixed(2)}
          </Typography>
          <Slider
            size="small"
            min={0.00001}
            max={2}
            step={0.05}
            value={value}
            onChange={(_, next) => onChange(next as number)}
          />
          <Button size="small" onClick={() => onChange(DEFAULT_GRID_LINE_WIDTH)}>
            Reset to {DEFAULT_GRID_LINE_WIDTH}
          </Button>
        </Box>
      </Menu>
    </>
  );
};

const DeployControl: React.FC<{
  isViewerMode: boolean;
  isProcessing: boolean;
  processingMode: ProcessingMode | null;
}> = ({ isViewerMode, isProcessing, processingMode }) => {
  const { setProcessing } = useTopoViewerActions();
  const deploymentCommands = useDeploymentCommands();
  const activeProcessingMode = processingMode ?? (isViewerMode ? DESTROY_MODE : DEPLOY_MODE);
  const menu = useMenuState();

  const handleDeployClick = React.useCallback(() => {
    const nextMode = isViewerMode ? DESTROY_MODE : DEPLOY_MODE;
    setProcessing(true, nextMode);
    if (isViewerMode) {
      deploymentCommands.onDestroy();
    } else {
      deploymentCommands.onDeploy();
    }
  }, [deploymentCommands, isViewerMode, setProcessing]);

  const handleDeployCleanup = React.useCallback(() => {
    setProcessing(true, DEPLOY_MODE);
    deploymentCommands.onDeployCleanup();
  }, [deploymentCommands, setProcessing]);

  const handleDestroyCleanup = React.useCallback(() => {
    setProcessing(true, DESTROY_MODE);
    deploymentCommands.onDestroyCleanup();
  }, [deploymentCommands, setProcessing]);

  const handleRedeploy = React.useCallback(() => {
    setProcessing(true, DEPLOY_MODE);
    deploymentCommands.onRedeploy();
  }, [deploymentCommands, setProcessing]);

  const handleRedeployCleanup = React.useCallback(() => {
    setProcessing(true, DEPLOY_MODE);
    deploymentCommands.onRedeployCleanup();
  }, [deploymentCommands, setProcessing]);

  const menuItems = isViewerMode
    ? [
        { label: "Destroy (cleanup)", icon: <CleaningServicesIcon fontSize="small" />, onClick: handleDestroyCleanup, danger: true },
        { label: "Redeploy", icon: <ReplayIcon fontSize="small" />, onClick: handleRedeploy, danger: false },
        {
          label: "Redeploy (cleanup)",
          icon: <ReplayIcon fontSize="small" />,
          onClick: handleRedeployCleanup,
          danger: true
        }
      ]
    : [
        { label: "Deploy (cleanup)", icon: <CleaningServicesIcon fontSize="small" />, onClick: handleDeployCleanup, danger: true }
      ];

  return (
    <>
      <ButtonGroup
        variant="contained"
        size="small"
        color={isViewerMode ? "error" : "primary"}
        disabled={isProcessing}
      >
        <Button
          onClick={handleDeployClick}
          startIcon={isViewerMode ? <StopIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          data-testid="navbar-deploy"
        >
          {isViewerMode ? "Destroy" : "Deploy"}
        </Button>
        <Button onClick={menu.openMenu} aria-label="Deploy options">
          <ArrowDropDownIcon fontSize="small" />
        </Button>
      </ButtonGroup>
      <Menu anchorEl={menu.anchorEl} open={menu.isOpen} onClose={menu.closeMenu}>
        {menuItems.map((item) => (
          <MenuItem
            key={item.label}
            onClick={() => {
              item.onClick();
              menu.closeMenu();
            }}
            sx={item.danger ? { color: "var(--vscode-errorForeground)" } : undefined}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            {item.label}
          </MenuItem>
        ))}
      </Menu>
      {isProcessing && (
        <Typography variant="caption" sx={{ ml: 1, textTransform: "uppercase" }}>
          {activeProcessingMode}
        </Typography>
      )}
    </>
  );
};

const NavbarLogo: React.FC<{
  onClick?: () => void;
  clickProgress?: number;
  isPartyMode?: boolean;
}> = ({ onClick, clickProgress = 0, isPartyMode = false }) => (
  <IconButton
    onClick={onClick}
    aria-label="Containerlab logo"
    size="medium"
    className="navbar-logo-button"
    sx={{ width: 40, height: 40 }}
  >
    <ContainerlabLogo
      className="navbar-logo"
      clickProgress={clickProgress}
      isExploded={isPartyMode}
    />
  </IconButton>
);

const NavbarTitle: React.FC<{
  mode: "view" | "edit";
  labName: string | null;
  isProcessing?: boolean;
}> = ({ mode, labName, isProcessing = false }) => {
  const theme = useTheme();
  const displayName = labName || "Unknown Lab";
  const modeLabel = isProcessing ? "processing" : mode === "view" ? "viewer" : "editor";
  const modeColor = isProcessing
    ? "var(--vscode-charts-yellow)"
    : mode === "view"
      ? "var(--vscode-charts-blue)"
      : "var(--vscode-charts-green)";
  const chipTextColor =
    theme.palette.mode === "dark"
      ? "var(--vscode-editor-background)"
      : "var(--vscode-editor-foreground)";

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Chip
        size="small"
        label={modeLabel}
        sx={{
          textTransform: "uppercase",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.4,
          bgcolor: modeColor,
          color: chipTextColor
        }}
      />
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {displayName}
      </Typography>
    </Stack>
  );
};

const NavbarLoadingIndicator: React.FC<{ isActive: boolean; mode: "deploy" | "destroy" | null }> = ({
  isActive,
  mode
}) => (
  <Box
    sx={{
      height: 2,
      width: "100%",
      opacity: isActive ? 1 : 0,
      transition: "opacity 150ms"
    }}
  >
    {isActive && (
      <LinearProgress color={mode === "destroy" ? "error" : "primary"} />
    )}
  </Box>
);
