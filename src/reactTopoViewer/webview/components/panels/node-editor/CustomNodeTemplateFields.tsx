/**
 * Custom Node Template Fields
 *
 * Fields shown when creating/editing custom node templates:
 * - Template Name, Base Name, Interface Pattern, Set as default
 */
import React, { useState, useCallback } from "react";
import {
  Box,
  ButtonBase,
  Collapse,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { FormField, InputField, CheckboxField, Section } from "../../ui/form";
import { copyToClipboard } from "../../../utils/clipboard";

import type { TabProps } from "./types";

/**
 * Interface pattern example with description
 */
interface PatternExample {
  pattern: string;
  description: string;
  result: string;
}

const PATTERN_EXAMPLES: PatternExample[] = [
  { pattern: "e1-{n}", description: "Sequential from 1", result: "e1-1, e1-2, e1-3..." },
  { pattern: "eth{n:0}", description: "Sequential from 0", result: "eth0, eth1, eth2..." },
  {
    pattern: "Gi0/0/{n:1-4}",
    description: "Range 1-4 only",
    result: "Gi0/0/1, Gi0/0/2, Gi0/0/3, Gi0/0/4"
  },
  { pattern: "xe-0/0/{n:0}", description: "Juniper style", result: "xe-0/0/0, xe-0/0/1..." }
];

/**
 * Copyable code snippet with copy button
 */
const CopyableCode: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [text]);

  return (
    <ButtonBase
      onClick={() => void handleCopy()}
      title="Click to copy"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        fontFamily: "monospace",
        fontSize: "0.75rem",
        px: 1,
        py: 0.5,
        borderRadius: 0.5,
        bgcolor: "var(--vscode-textCodeBlock-background)",
        color: "var(--vscode-textPreformat-foreground)",
        border: "1px solid var(--vscode-widget-border)",
        transition: "background-color 120ms",
        "&:hover": { bgcolor: "var(--vscode-list-hoverBackground)" }
      }}
    >
      <Box component="span">{text}</Box>
      {copied ? (
        <CheckCircleIcon sx={{ fontSize: 14, color: "var(--vscode-testing-iconPassed)" }} />
      ) : (
        <ContentCopyIcon sx={{ fontSize: 14, opacity: 0.6 }} />
      )}
    </ButtonBase>
  );
};

/**
 * Interface pattern info panel with examples
 */
const InterfacePatternInfo: React.FC<{ isExpanded: boolean; onToggle: () => void }> = ({
  isExpanded,
  onToggle
}) => {
  return (
    <Box
      sx={{
        mt: 2,
        borderRadius: 1,
        border: "1px solid var(--vscode-widget-border)",
        overflow: "hidden"
      }}
    >
      <ButtonBase
        onClick={onToggle}
        sx={{
          width: "100%",
          px: 2,
          py: 1,
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 1,
          bgcolor: "var(--vscode-editor-inactiveSelectionBackground)",
          "&:hover": { bgcolor: "var(--vscode-list-hoverBackground)" }
        }}
      >
        <ChevronRightIcon
          sx={{
            fontSize: 16,
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 150ms"
          }}
        />
        <InfoOutlinedIcon sx={{ fontSize: 16, color: "var(--vscode-textLink-foreground)" }} />
        <Typography variant="caption" color="text.secondary">
          Pattern syntax: Use{" "}
          <Box
            component="code"
            sx={{
              px: 0.5,
              bgcolor: "var(--vscode-textCodeBlock-background)",
              borderRadius: 0.5
            }}
          >
            {"{n}"}
          </Box>{" "}
          for sequential numbering
        </Typography>
      </ButtonBase>

      <Collapse in={isExpanded}>
        <Box sx={{ px: 2, py: 1.5, bgcolor: "var(--vscode-editor-background)" }}>
          <Table sx={{ "& td, & th": { borderBottom: "none" } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: 11, color: "text.secondary", fontWeight: 600 }}>
                  Pattern
                </TableCell>
                <TableCell sx={{ fontSize: 11, color: "text.secondary", fontWeight: 600 }}>
                  Description
                </TableCell>
                <TableCell sx={{ fontSize: 11, color: "text.secondary", fontWeight: 600 }}>
                  Result
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {PATTERN_EXAMPLES.map((example) => (
                <TableRow key={example.pattern}>
                  <TableCell sx={{ fontSize: 12 }}>
                    <CopyableCode text={example.pattern} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>
                    {example.description}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary", fontFamily: "monospace" }}>
                    {example.result}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Collapse>
    </Box>
  );
};

/**
 * Custom Node Template fields - shown only when editing custom node templates
 */
export const CustomNodeTemplateFields: React.FC<TabProps> = ({ data, onChange }) => {
  const [showPatternInfo, setShowPatternInfo] = useState(false);

  return (
    <Section title="Custom Node Template">
      <Stack spacing={2}>
        <FormField label="Template Name">
          <InputField
            id="node-custom-name"
            value={data.customName || ""}
            onChange={(value) => onChange({ customName: value })}
            placeholder="Template name"
          />
        </FormField>
        <FormField label="Base Name (for canvas)">
          <InputField
            id="node-base-name"
            value={data.baseName || ""}
            onChange={(value) => onChange({ baseName: value })}
            placeholder="e.g., srl (will become srl1, srl2, etc.)"
          />
        </FormField>
        <CheckboxField
          id="node-custom-default"
          label="Set as default"
          checked={data.isDefaultCustomNode || false}
          onChange={(checked) => onChange({ isDefaultCustomNode: checked })}
        />
        <Stack spacing={1.5}>
          <FormField label="Interface Pattern">
            <InputField
              id="node-interface-pattern"
              value={data.interfacePattern || ""}
              onChange={(value) => onChange({ interfacePattern: value })}
              placeholder="e.g., e1-{n} or Gi0/0/{n:0}"
            />
          </FormField>
          <InterfacePatternInfo
            isExpanded={showPatternInfo}
            onToggle={() => setShowPatternInfo(!showPatternInfo)}
          />
        </Stack>
      </Stack>
    </Section>
  );
};
