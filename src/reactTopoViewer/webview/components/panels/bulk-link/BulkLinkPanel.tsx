/**
 * BulkLinkPanel - Create multiple links based on name patterns
 */
import React from "react";
import { Alert, Box, Grid, Paper, Stack, TextField, Typography } from "@mui/material";

import { BasePanel } from "../../ui/editor/BasePanel";
import type { TopoNode, TopoEdge } from "../../../../shared/types/graph";
import { useGraphActions, useGraphState } from "../../../stores/graphStore";

import { CopyableCode } from "./CopyableCode";
import { ConfirmBulkLinksModal } from "./ConfirmBulkLinksModal";
import type { LinkCandidate } from "./bulkLinkUtils";
import { computeAndValidateCandidates, confirmAndCreateLinks } from "./bulkLinkHandlers";

interface BulkLinkPanelProps {
  isVisible: boolean;
  mode: "edit" | "view";
  isLocked: boolean;
  onClose: () => void;
  storageKey?: string;
}

const ExamplesSection: React.FC = () => (
  <Paper variant="outlined" sx={{ p: 2 }}>
    <Typography variant="subtitle2" sx={{ mb: 1 }}>
      Examples
    </Typography>
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Typography variant="body2" color="text.secondary">
          1.
        </Typography>
        <Box>
          <Typography variant="body2">All leaves to all spines:</Typography>
          <Box sx={{ mt: 0.5 }}>
            <CopyableCode>leaf*</CopyableCode> → <CopyableCode>spine*</CopyableCode>
          </Box>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Typography variant="body2" color="text.secondary">
          2.
        </Typography>
        <Box>
          <Typography variant="body2">Pair by number (leaf1→spine1):</Typography>
          <Box sx={{ mt: 0.5 }}>
            <CopyableCode>leaf(\d+)</CopyableCode> → <CopyableCode>spine$1</CopyableCode>
          </Box>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Typography variant="body2" color="text.secondary">
          3.
        </Typography>
        <Box>
          <Typography variant="body2">Single char match:</Typography>
          <Box sx={{ mt: 0.5 }}>
            <CopyableCode>srl?</CopyableCode> → <CopyableCode>client*</CopyableCode>
          </Box>
        </Box>
      </Stack>
    </Stack>
    <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
      <Grid container spacing={1}>
        <Grid size={6}>
          <Typography variant="body2">
            <CopyableCode>*</CopyableCode> any chars
          </Typography>
        </Grid>
        <Grid size={6}>
          <Typography variant="body2">
            <CopyableCode>?</CopyableCode> single char
          </Typography>
        </Grid>
        <Grid size={6}>
          <Typography variant="body2">
            <CopyableCode>#</CopyableCode> single digit
          </Typography>
        </Grid>
        <Grid size={6}>
          <Typography variant="body2">
            <CopyableCode>$1</CopyableCode> capture group
          </Typography>
        </Grid>
      </Grid>
    </Box>
  </Paper>
);

type UseBulkLinkPanelOptions = Omit<BulkLinkPanelProps, "storageKey">;

function useBulkLinkPanel({ isVisible, mode, isLocked, onClose }: UseBulkLinkPanelOptions) {
  // Get nodes and edges from graph store
  const { nodes, edges } = useGraphState();
  const { addEdge } = useGraphActions();

  const [sourcePattern, setSourcePattern] = React.useState("");
  const [targetPattern, setTargetPattern] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);
  const [pendingCandidates, setPendingCandidates] = React.useState<LinkCandidate[] | null>(null);
  const sourceInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (isVisible) {
      setStatus(null);
      setPendingCandidates(null);
      setTimeout(() => sourceInputRef.current?.focus(), 0);
    }
  }, [isVisible]);

  const canApply = mode === "edit" && !isLocked;

  const handleCancel = React.useCallback(() => {
    setPendingCandidates(null);
    setStatus(null);
    onClose();
  }, [onClose]);

  const handleCompute = React.useCallback(() => {
    computeAndValidateCandidates(
      nodes as TopoNode[],
      edges as TopoEdge[],
      sourcePattern,
      targetPattern,
      setStatus,
      setPendingCandidates
    );
  }, [nodes, edges, sourcePattern, targetPattern]);

  const handleConfirmCreate = React.useCallback(async () => {
    await confirmAndCreateLinks({
      nodes: nodes as TopoNode[],
      edges: edges as TopoEdge[],
      pendingCandidates,
      canApply,
      addEdge,
      setStatus,
      setPendingCandidates,
      onClose
    });
  }, [nodes, edges, pendingCandidates, canApply, addEdge, onClose]);

  const handleDismissConfirm = React.useCallback(() => {
    setPendingCandidates(null);
  }, []);

  return {
    sourcePattern,
    setSourcePattern,
    targetPattern,
    setTargetPattern,
    status,
    pendingCandidates,
    sourceInputRef,
    canApply,
    handleCancel,
    handleCompute,
    handleConfirmCreate,
    handleDismissConfirm
  };
}

export const BulkLinkPanel: React.FC<BulkLinkPanelProps> = ({
  isVisible,
  mode,
  isLocked,
  onClose,
  storageKey = "bulk-link"
}) => {
  const {
    sourcePattern,
    setSourcePattern,
    targetPattern,
    setTargetPattern,
    status,
    pendingCandidates,
    sourceInputRef,
    canApply,
    handleCancel,
    handleCompute,
    handleConfirmCreate,
    handleDismissConfirm
  } = useBulkLinkPanel({ isVisible, mode, isLocked, onClose });

  return (
    <>
      <BasePanel
        title="Bulk Link Devices"
        isVisible={isVisible}
        onClose={handleCancel}
        storageKey={storageKey}
        width={400}
        initialPosition={{ x: 400, y: 150 }}
        primaryLabel="Apply"
        secondaryLabel="Cancel"
        onPrimaryClick={handleCompute}
        onSecondaryClick={handleCancel}
      >
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Create multiple links by matching node names with patterns.
          </Typography>

          <ExamplesSection />

          <Stack spacing={2}>
            <TextField
              label="Source Pattern"
              required
              inputRef={sourceInputRef}
              value={sourcePattern}
              onChange={(e) => setSourcePattern(e.target.value)}
              placeholder="e.g. leaf*, srl(\\d+)"
              disabled={mode !== "edit"} />
            <TextField
              label="Target Pattern"
              required
              value={targetPattern}
              onChange={(e) => setTargetPattern(e.target.value)}
              placeholder="e.g. spine*, client$1"
              disabled={mode !== "edit"} />
          </Stack>

          {status && <Alert severity="info">{status}</Alert>}

          {!canApply && (
            <Alert severity="warning">
              Bulk linking is disabled while locked or in view mode.
            </Alert>
          )}
        </Stack>
      </BasePanel>

      <ConfirmBulkLinksModal
        isOpen={!!pendingCandidates}
        count={pendingCandidates?.length ?? 0}
        sourcePattern={sourcePattern.trim()}
        targetPattern={targetPattern.trim()}
        onCancel={handleDismissConfirm}
        onConfirm={() => void handleConfirmCreate()}
      />
    </>
  );
};
