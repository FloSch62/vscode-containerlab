/**
 * Context Menu Component - MUI Menu.
 */
import React, { useRef, useState } from "react";
import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  iconComponent?: React.ReactNode;
  disabled?: boolean;
  divider?: boolean;
  danger?: boolean;
  onClick?: () => void;
  children?: ContextMenuItem[];
}

interface ContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose: () => void;
}

function renderMenuIcon(item: ContextMenuItem): React.ReactElement | null {
  if (item.iconComponent) return <>{item.iconComponent}</>;
  if (item.icon) return <i className={item.icon} />;
  return null;
}

interface ContextMenuListProps {
  items: ContextMenuItem[];
  onCloseAll: () => void;
}

const ContextMenuList: React.FC<ContextMenuListProps> = ({ items, onCloseAll }) => (
  <>
    {items.map((item) => {
      if (item.divider) {
        return <Divider key={item.id} />;
      }
      const icon = renderMenuIcon(item);
      const hasChildren = Boolean(item.children && item.children.length > 0);
      return (
        <MenuItem
          key={item.id}
          disabled={item.disabled}
          onClick={
            hasChildren
              ? undefined
              : () => {
                  if (!item.disabled && item.onClick) {
                    item.onClick();
                  }
                  onCloseAll();
                }
          }
          data-menu-item-id={item.id}
          sx={item.danger ? { color: "var(--vscode-errorForeground)" } : undefined}
        >
          {icon && <ListItemIcon>{icon}</ListItemIcon>}
          <ListItemText primary={item.label} />
          {hasChildren && <ChevronRightIcon fontSize="small" />}
        </MenuItem>
      );
    })}
  </>
);

interface ContextMenuLevelProps {
  open: boolean;
  anchorPosition?: { top: number; left: number };
  anchorEl?: HTMLElement | null;
  items: ContextMenuItem[];
  onCloseAll: () => void;
  minWidth?: number;
  onParentHover?: () => void;
}

const ContextMenuLevel: React.FC<ContextMenuLevelProps> = ({
  open,
  anchorPosition,
  anchorEl,
  items,
  onCloseAll,
  minWidth = 220,
  onParentHover
}) => {
  const [submenuAnchor, setSubmenuAnchor] = useState<HTMLElement | null>(null);
  const [submenuItems, setSubmenuItems] = useState<ContextMenuItem[] | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    onParentHover?.();
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setSubmenuAnchor(null);
      setSubmenuItems(null);
      setActiveItemId(null);
      closeTimerRef.current = null;
    }, 160);
  };

  const closeSubmenu = () => {
    clearCloseTimer();
    setSubmenuAnchor(null);
    setSubmenuItems(null);
    setActiveItemId(null);
  };

  const handleItemHover = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    const itemEl = target?.closest("[data-menu-item-id]") as HTMLElement | null;
    const id = itemEl?.getAttribute("data-menu-item-id");
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    if (id === activeItemId) return;
    setActiveItemId(id);
    if (!item.children || item.children.length === 0 || item.disabled) {
      closeSubmenu();
      return;
    }
    if (submenuAnchor === itemEl && submenuItems === item.children) return;
    setSubmenuAnchor(itemEl);
    setSubmenuItems(item.children);
  };

  return (
    <>
      <Menu
        open={open}
        onClose={onCloseAll}
        anchorReference={anchorPosition ? "anchorPosition" : "anchorEl"}
        anchorPosition={anchorPosition}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        MenuListProps={{
          onMouseEnter: clearCloseTimer,
          onMouseLeave: scheduleClose,
          onMouseMove: handleItemHover
        }}
        slotProps={{ paper: { sx: { minWidth } } }}
      >
        <ContextMenuList items={items} onCloseAll={onCloseAll} />
      </Menu>
      {submenuItems && submenuAnchor && (
        <ContextMenuLevel
          open={true}
          anchorEl={submenuAnchor}
          items={submenuItems}
          onCloseAll={onCloseAll}
          minWidth={200}
          onParentHover={clearCloseTimer}
        />
      )}
    </>
  );
};

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isVisible,
  position,
  items,
  onClose
}) => {
  if (!isVisible || items.length === 0) return null;

  return (
    <ContextMenuLevel
      open={isVisible}
      anchorPosition={{ top: position.y, left: position.x }}
      items={items}
      onCloseAll={onClose}
    />
  );
};
