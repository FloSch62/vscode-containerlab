/**
 * ConfirmBulkLinksModal - Confirmation dialog for bulk link creation
 */
import React from "react";
import { Button, Paper, Stack, Typography } from "@mui/material";

import { BasePanel } from "../../ui/editor/BasePanel";

interface ConfirmBulkLinksModalProps {
  isOpen: boolean;
  count: number;
  sourcePattern: string;
  targetPattern: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmBulkLinksModal: React.FC<ConfirmBulkLinksModalProps> = ({
  isOpen,
  count,
  sourcePattern,
  targetPattern,
  onCancel,
  onConfirm
}) => (
  <BasePanel
    title="Bulk Link Creation"
    isVisible={isOpen}
    onClose={onCancel}
    storageKey="bulk-link-confirm"
    backdrop={true}
    width={420}
    zIndex={10000}
    footer={false}
  >
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2">
          Create <strong>{count}</strong> new link{count === 1 ? "" : "s"}?
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          Source: <code>{sourcePattern}</code>
          <br />
          Target: <code>{targetPattern}</code>
        </Typography>
      </Paper>

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" onClick={onConfirm}>
          Create Links
        </Button>
      </Stack>
    </Stack>
  </BasePanel>
);
