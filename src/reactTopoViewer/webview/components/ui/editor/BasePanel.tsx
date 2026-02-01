/**
 * BasePanel - MUI-based floating panel.
 */
import type { ReactNode } from "react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Portal,
  Stack,
  Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const DEFAULT_POSITION = { x: 24, y: 88 };
const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 180;
const DEFAULT_PANEL_HEIGHT = 360;

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number | undefined;
}

export interface BasePanelProps {
  readonly title: string;
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly onPrimaryClick?: () => void;
  readonly onSecondaryClick?: () => void;
  readonly primaryLabel?: string;
  readonly secondaryLabel?: string;
  readonly hasChanges?: boolean;
  readonly footer?: boolean;
  readonly width?: number;
  readonly height?: number;
  readonly initialPosition?: { x: number; y: number };
  readonly storageKey?: string;
  readonly backdrop?: boolean;
  readonly zIndex?: number;
  readonly resizable?: boolean;
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly testId?: string;
}

const noop = () => {};

function resolvePosition(
  initialPosition: BasePanelProps["initialPosition"],
  width: number
): Position {
  if (initialPosition) return initialPosition;
  const x = Math.max(24, (window.innerWidth - width) / 2);
  const y = DEFAULT_POSITION.y;
  return { x, y };
}

function clampPosition(pos: Position, size: Size): Position {
  const width = size.width;
  const height = size.height ?? DEFAULT_PANEL_HEIGHT;
  return {
    x: Math.max(12, Math.min(pos.x, window.innerWidth - Math.max(80, width))),
    y: Math.max(12, Math.min(pos.y, window.innerHeight - Math.max(60, height)))
  };
}

function clampSize(size: Size, minWidth: number, minHeight: number, pos: Position): Size {
  return {
    width: Math.max(minWidth, Math.min(size.width, window.innerWidth - pos.x - 12)),
    height:
      size.height === undefined
        ? undefined
        : Math.max(minHeight, Math.min(size.height, window.innerHeight - pos.y - 12))
  };
}

function loadPanelState(
  storageKey: string | undefined,
  fallbackPosition: Position,
  fallbackSize: Size,
  minWidth: number,
  minHeight: number
): { position: Position; size: Size } {
  if (!storageKey) {
    return {
      position: clampPosition(fallbackPosition, fallbackSize),
      size: clampSize(fallbackSize, minWidth, minHeight, fallbackPosition)
    };
  }
  try {
    const raw = window.localStorage.getItem(`panel-state-${storageKey}`);
    if (!raw) {
      return {
        position: clampPosition(fallbackPosition, fallbackSize),
        size: clampSize(fallbackSize, minWidth, minHeight, fallbackPosition)
      };
    }
    const parsed = JSON.parse(raw) as {
      position?: Position;
      size?: Size;
    };
    const position = parsed.position ?? fallbackPosition;
    const size = parsed.size ?? fallbackSize;
    return {
      position: clampPosition(position, size),
      size: clampSize(size, minWidth, minHeight, position)
    };
  } catch {
    return {
      position: clampPosition(fallbackPosition, fallbackSize),
      size: clampSize(fallbackSize, minWidth, minHeight, fallbackPosition)
    };
  }
}

function savePanelState(
  storageKey: string | undefined,
  position: Position,
  size: Size
): void {
  if (!storageKey) return;
  try {
    window.localStorage.setItem(
      `panel-state-${storageKey}`,
      JSON.stringify({ position, size })
    );
  } catch {
    /* ignore */
  }
}

function shouldIgnoreDrag(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("button, [role='button'], input, textarea, select"));
}

function getButtonDefaults(p: BasePanelProps) {
  return {
    onPrimaryClick: p.onPrimaryClick ?? noop,
    onSecondaryClick: p.onSecondaryClick ?? noop,
    primaryLabel: p.primaryLabel ?? "OK",
    secondaryLabel: p.secondaryLabel ?? "Apply",
    hasChanges: p.hasChanges ?? false,
    footer: p.footer ?? true
  };
}

export function BasePanel(props: Readonly<BasePanelProps>): React.ReactElement | null {
  const {
    title,
    isVisible,
    onClose,
    children,
    height,
    width = DEFAULT_WIDTH,
    minWidth = MIN_WIDTH,
    minHeight = MIN_HEIGHT,
    initialPosition,
    backdrop = false,
    zIndex = 1300,
    testId,
    storageKey,
    resizable = true
  } = props;
  const btn = getButtonDefaults(props);

  const fallbackPosition = useMemo(
    () => resolvePosition(initialPosition, width),
    [initialPosition, width]
  );
  const fallbackSize = useMemo<Size>(() => ({ width, height }), [width, height]);
  const initialState = useMemo(
    () => loadPanelState(storageKey, fallbackPosition, fallbackSize, minWidth, minHeight),
    [storageKey, fallbackPosition, fallbackSize, minWidth, minHeight]
  );

  const [position, setPosition] = useState<Position>(initialState.position);
  const [size, setSize] = useState<Size>(initialState.size);
  const positionRef = useRef(position);
  const sizeRef = useRef(size);
  const setPositionSafe = (next: Position) => {
    positionRef.current = next;
    setPosition(next);
  };

  const setSizeSafe = (next: Size) => {
    sizeRef.current = next;
    setSize(next);
  };

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origin: Position } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origin: Size } | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setPositionSafe(clampPosition(positionRef.current, sizeRef.current));
      setSizeSafe(clampSize(sizeRef.current, minWidth, minHeight, positionRef.current));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [minWidth, minHeight]);

  const handleDragStart = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    if (shouldIgnoreDrag(event.target)) return;
    event.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origin: positionRef.current
    };
    const handleMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current) return;
      const next = {
        x: dragRef.current.origin.x + (moveEvent.clientX - dragRef.current.startX),
        y: dragRef.current.origin.y + (moveEvent.clientY - dragRef.current.startY)
      };
      setPositionSafe(clampPosition(next, sizeRef.current));
    };
    const handleUp = () => {
      setIsDragging(false);
      dragRef.current = null;
      savePanelState(storageKey, positionRef.current, sizeRef.current);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const handleResizeStart = (event: React.PointerEvent) => {
    if (!resizable || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origin: sizeRef.current
    };
    const handleMove = (moveEvent: PointerEvent) => {
      if (!resizeRef.current) return;
      const deltaX = moveEvent.clientX - resizeRef.current.startX;
      const deltaY = moveEvent.clientY - resizeRef.current.startY;
      const nextSize: Size = {
        width: resizeRef.current.origin.width + deltaX,
        height:
          (resizeRef.current.origin.height ?? DEFAULT_PANEL_HEIGHT) + deltaY
      };
      setSizeSafe(clampSize(nextSize, minWidth, minHeight, positionRef.current));
    };
    const handleUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
      savePanelState(storageKey, positionRef.current, sizeRef.current);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  if (!isVisible) return null;

  return (
    <Portal>
      {backdrop && (
        <Box
          onClick={onClose}
          sx={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.3)",
            zIndex: zIndex - 1
          }}
        />
      )}
      <Paper
        elevation={8}
        data-testid={testId}
        sx={{
          position: "fixed",
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height ?? "auto",
          maxHeight: `calc(100vh - ${position.y + 16}px)`,
          minWidth,
          minHeight,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid var(--vscode-panel-border)",
          userSelect: isDragging || isResizing ? "none" : "auto",
          zIndex
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: isDragging ? "grabbing" : "grab"
          }}
          onPointerDown={handleDragStart}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            {title}
          </Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider />
        <Box sx={{ p: 2, overflow: "auto", flex: 1, minHeight: 0 }}>{children}</Box>
        {btn.footer && (
          <>
            <Divider />
            <Stack direction="row" spacing={1} sx={{ p: 2, justifyContent: "flex-end" }}>
              <Button
                variant={btn.hasChanges ? "contained" : "outlined"}
                color={btn.hasChanges ? "warning" : "secondary"}
                onClick={btn.onSecondaryClick}
                data-testid="panel-apply-btn"
              >
                {btn.secondaryLabel}
              </Button>
              <Button
                variant="contained"
                onClick={btn.onPrimaryClick}
                data-testid="panel-ok-btn"
              >
                {btn.primaryLabel}
              </Button>
            </Stack>
          </>
        )}
        {resizable && (
          <Box
            onPointerDown={handleResizeStart}
            sx={{
              position: "absolute",
              right: 6,
              bottom: 6,
              width: 14,
              height: 14,
              cursor: "nwse-resize",
              borderRight: "2px solid var(--vscode-panel-border)",
              borderBottom: "2px solid var(--vscode-panel-border)"
            }}
          />
        )}
      </Paper>
    </Portal>
  );
}
