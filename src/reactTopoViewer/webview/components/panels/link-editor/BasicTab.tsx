/**
 * BasicTab - Basic link configuration (endpoints)
 */
import React from "react";
import { Button, Stack, Slider, TextField } from "@mui/material";

import { FormField, ReadOnlyBadge, InputField, Section } from "../../ui/form";
import {
  DEFAULT_ENDPOINT_LABEL_OFFSET,
  ENDPOINT_LABEL_OFFSET_MIN,
  ENDPOINT_LABEL_OFFSET_MAX
} from "../../../annotations/endpointLabelOffset";

import type { LinkTabProps } from "./types";

export const BasicTab: React.FC<LinkTabProps> = ({ data, onChange, onAutoApplyOffset }) => {
  const rawEndpointOffset =
    typeof data.endpointLabelOffset === "number" ? data.endpointLabelOffset : Number.NaN;
  const endpointOffsetValue = Number.isFinite(rawEndpointOffset)
    ? rawEndpointOffset
    : DEFAULT_ENDPOINT_LABEL_OFFSET;
  const isDefaultOffset = endpointOffsetValue === DEFAULT_ENDPOINT_LABEL_OFFSET;

  const handleOffsetChange = (value: number) => {
    const nextOffset = Number.isFinite(value) ? value : 0;
    const nextData = {
      ...data,
      endpointLabelOffset: nextOffset,
      endpointLabelOffsetEnabled: true
    };
    onChange({
      endpointLabelOffset: nextOffset,
      endpointLabelOffsetEnabled: true
    });
    onAutoApplyOffset?.(nextData);
  };

  const handleOffsetReset = () => {
    const nextData = {
      ...data,
      endpointLabelOffset: DEFAULT_ENDPOINT_LABEL_OFFSET,
      endpointLabelOffsetEnabled: true
    };
    onChange({
      endpointLabelOffset: DEFAULT_ENDPOINT_LABEL_OFFSET,
      endpointLabelOffsetEnabled: true
    });
    onAutoApplyOffset?.(nextData);
  };

  return (
    <Stack spacing={3}>
      <Section title="Source Endpoint">
        <FormField label="Node">
          <ReadOnlyBadge>{data.source || "Unknown"}</ReadOnlyBadge>
        </FormField>
        {data.sourceIsNetwork ? (
          <FormField label="Interface">
            <ReadOnlyBadge>{data.source || "Unknown"}</ReadOnlyBadge>
          </FormField>
        ) : (
          <FormField label="Interface" required>
            <InputField
              id="link-source-interface"
              value={data.sourceEndpoint || ""}
              onChange={(value: string) => onChange({ sourceEndpoint: value })}
              placeholder="e.g., eth1, e1-1"
            />
          </FormField>
        )}
      </Section>

      <Section title="Target Endpoint">
        <FormField label="Node">
          <ReadOnlyBadge>{data.target || "Unknown"}</ReadOnlyBadge>
        </FormField>
        {data.targetIsNetwork ? (
          <FormField label="Interface">
            <ReadOnlyBadge>{data.target || "Unknown"}</ReadOnlyBadge>
          </FormField>
        ) : (
          <FormField label="Interface" required>
            <InputField
              id="link-target-interface"
              value={data.targetEndpoint || ""}
              onChange={(value: string) => onChange({ targetEndpoint: value })}
              placeholder="e.g., eth1, e1-1"
            />
          </FormField>
        )}
      </Section>

      <Section title="Label Offset" hasBorder={false}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Slider min={ENDPOINT_LABEL_OFFSET_MIN}
            max={ENDPOINT_LABEL_OFFSET_MAX}
            step={1}
            value={endpointOffsetValue}
            onChange={(_, value) => handleOffsetChange(value as number)}
          />
          <TextField value={endpointOffsetValue.toFixed(0)}
            inputProps={{ readOnly: true, "aria-label": "Offset value" }}
            sx={{ width: 72 }}
          />
          {!isDefaultOffset ? (
            <Button variant="outlined" onClick={handleOffsetReset}>
              Reset
            </Button>
          ) : null}
        </Stack>
      </Section>
    </Stack>
  );
};
