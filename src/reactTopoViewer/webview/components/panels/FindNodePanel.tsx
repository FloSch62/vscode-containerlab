/**
 * FindNodePanel - Search/find nodes in the topology
 * Uses graph store state for node data and viewport operations.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";

import { BasePanel } from "../ui/editor/BasePanel";
import { useGraphState } from "../../stores/graphStore";
import { searchNodes as searchNodesUtil, getNodesBoundingBox } from "../../utils/graphQueryUtils";
import type { TopoNode } from "../../../shared/types/graph";

interface FindNodePanelProps {
  isVisible: boolean;
  onClose: () => void;
  rfInstance: ReactFlowInstance | null;
}

/** Creates a wildcard filter regex */
function createWildcardFilter(trimmed: string): (value: string) => boolean {
  const regex = new RegExp(
    "^" +
      trimmed
        .split("*")
        .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*") +
      "$",
    "i"
  );
  return (value: string) => regex.test(value);
}

/** Creates a prefix filter (starts with +) */
function createPrefixFilter(trimmed: string): (value: string) => boolean {
  const prefix = trimmed.slice(1).toLowerCase();
  return (value: string) => value.toLowerCase().startsWith(prefix);
}

/** Creates a contains filter (default) */
function createContainsFilter(lower: string): (value: string) => boolean {
  return (value: string) => value.toLowerCase().includes(lower);
}

/**
 * Creates a filter function for flexible string matching
 */
function createFilter(pattern: string): (value: string) => boolean {
  const trimmed = pattern.trim();
  if (!trimmed) return () => true;
  if (trimmed.includes("*")) return createWildcardFilter(trimmed);
  if (trimmed.startsWith("+")) return createPrefixFilter(trimmed);
  return createContainsFilter(trimmed.toLowerCase());
}

/** Formats the search result message */
function formatResultMessage(count: number): string {
  if (count === 0) return "No nodes found";
  const plural = count === 1 ? "" : "s";
  return `Found ${count} node${plural}`;
}

/** Component to display search result status */
const SearchResultStatus: React.FC<{ count: number }> = ({ count }) => (
  <Typography
    variant="body2"
    sx={{ color: count > 0 ? "var(--vscode-charts-green)" : "var(--vscode-charts-yellow)" }}
    data-testid="find-node-result"
  >
    {formatResultMessage(count)}
  </Typography>
);

/**
 * Filter nodes using a custom filter function
 */
function filterNodes(nodes: TopoNode[], searchTerm: string): TopoNode[] {
  const filter = createFilter(searchTerm);
  return nodes.filter((node) => {
    if (filter(node.id)) return true;
    const data = node.data as Record<string, unknown>;
    const label = data.label;
    if (typeof label === "string" && filter(label)) return true;
    return false;
  });
}

/** Hook for panel focus management */
function usePanelFocus(isVisible: boolean, inputRef: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    if (isVisible && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isVisible, inputRef]);
}

/** Hook for search state management */
function useSearchState(
  nodes: TopoNode[],
  rfInstance: ReactFlowInstance | null,
  isVisible: boolean
) {
  const [searchTerm, setSearchTerm] = useState("");
  const [matchCount, setMatchCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isVisible) setMatchCount(null);
  }, [isVisible]);

  const handleSearch = useCallback(() => {
    if (!searchTerm.trim()) {
      setMatchCount(null);
      return;
    }

    const basicMatches = searchNodesUtil(nodes, searchTerm);
    const filterMatches = filterNodes(nodes, searchTerm);

    const matchedIds = new Set<string>();
    const combinedMatches: TopoNode[] = [];
    for (const node of [...basicMatches, ...filterMatches]) {
      if (!matchedIds.has(node.id)) {
        matchedIds.add(node.id);
        combinedMatches.push(node);
      }
    }

    setMatchCount(combinedMatches.length);

    if (combinedMatches.length > 0 && rfInstance) {
      const bounds = getNodesBoundingBox(combinedMatches);
      if (bounds) {
        rfInstance
          .fitBounds(
            { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
            { padding: 0.2, duration: 300 }
          )
          .catch(() => {
            /* ignore */
          });
      }
    }
  }, [nodes, searchTerm, rfInstance]);

  const handleClear = useCallback(() => {
    setSearchTerm("");
    setMatchCount(null);
  }, []);

  return { searchTerm, setSearchTerm, matchCount, handleSearch, handleClear };
}

export const FindNodePanel: React.FC<FindNodePanelProps> = ({ isVisible, onClose, rfInstance }) => {
  const { nodes } = useGraphState();
  const inputRef = useRef<HTMLInputElement>(null);
  usePanelFocus(isVisible, inputRef);
  const { searchTerm, setSearchTerm, matchCount, handleSearch, handleClear } = useSearchState(
    nodes as TopoNode[],
    rfInstance,
    isVisible
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch();
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [handleSearch, onClose]
  );

  const handleClearClick = useCallback(() => {
    handleClear();
    inputRef.current?.focus();
  }, [handleClear]);

  return (
    <BasePanel
      title="Find Node"
      isVisible={isVisible}
      onClose={onClose}
      initialPosition={{ x: window.innerWidth - 340, y: 72 }}
      width={300}
      storageKey="findNode"
      zIndex={90}
      footer={false}
      minWidth={250}
      minHeight={150}
      testId="find-node-panel"
    >
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Search for nodes in the topology by name.
        </Typography>

        <TextField
          inputRef={inputRef}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search for nodes ..." autoFocus
          data-testid="find-node-input"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <IconButton onClick={handleClearClick} title="Clear search">
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined
          }}
        />

        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Button variant="contained" onClick={handleSearch} data-testid="find-node-search-btn">
            Search
          </Button>
          {matchCount !== null && <SearchResultStatus count={matchCount} />}
        </Stack>

        <Box>
          <Typography variant="caption" sx={{ display: "block", mb: 1 }}>
            Search tips:
          </Typography>
          <List dense disablePadding>
            <ListItem disableGutters>
              <Typography variant="body2">
                Use <Chip label="*" sx={{ mx: 0.5 }} /> for wildcard (e.g.,{" "}
                <code>srl*</code>)
              </Typography>
            </ListItem>
            <ListItem disableGutters>
              <Typography variant="body2">
                Use <Chip label="+" sx={{ mx: 0.5 }} /> prefix for starts-with
              </Typography>
            </ListItem>
            <ListItem disableGutters>
              <Typography variant="body2">
                Press <Chip label="Enter" sx={{ mx: 0.5 }} /> to search
              </Typography>
            </ListItem>
          </List>
        </Box>
      </Stack>
    </BasePanel>
  );
};
