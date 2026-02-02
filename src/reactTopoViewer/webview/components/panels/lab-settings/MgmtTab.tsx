/**
 * MgmtTab - Management network settings tab for Lab Settings panel
 */
import React from "react";
import {
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";

import type { IpType, DriverOption } from "./types";

interface MgmtTabProps {
  networkName: string;
  ipv4Type: IpType;
  ipv4Subnet: string;
  ipv4Gateway: string;
  ipv4Range: string;
  ipv6Type: IpType;
  ipv6Subnet: string;
  ipv6Gateway: string;
  mtu: string;
  bridge: string;
  externalAccess: boolean;
  driverOptions: DriverOption[];
  isViewMode: boolean;
  onNetworkNameChange: (value: string) => void;
  onIpv4TypeChange: (value: IpType) => void;
  onIpv4SubnetChange: (value: string) => void;
  onIpv4GatewayChange: (value: string) => void;
  onIpv4RangeChange: (value: string) => void;
  onIpv6TypeChange: (value: IpType) => void;
  onIpv6SubnetChange: (value: string) => void;
  onIpv6GatewayChange: (value: string) => void;
  onMtuChange: (value: string) => void;
  onBridgeChange: (value: string) => void;
  onExternalAccessChange: (value: boolean) => void;
  onAddDriverOption: () => void;
  onRemoveDriverOption: (index: number) => void;
  onUpdateDriverOption: (index: number, field: "key" | "value", value: string) => void;
}

/** IPv4 settings section */
const Ipv4Section: React.FC<
  Pick<
    MgmtTabProps,
    | "ipv4Type"
    | "ipv4Subnet"
    | "ipv4Gateway"
    | "ipv4Range"
    | "isViewMode"
    | "onIpv4TypeChange"
    | "onIpv4SubnetChange"
    | "onIpv4GatewayChange"
    | "onIpv4RangeChange"
  >
> = (props) => (
  <Stack spacing={1.5}>
    <Typography variant="subtitle2">IPv4</Typography>
    <TextField
      select label="Subnet"
      value={props.ipv4Type}
      onChange={(e) => props.onIpv4TypeChange(e.target.value as IpType)}
      disabled={props.isViewMode}
    >
      <MenuItem value="default">Default (172.20.20.0/24)</MenuItem>
      <MenuItem value="auto">Auto-assign</MenuItem>
      <MenuItem value="custom">Custom</MenuItem>
    </TextField>
    {props.ipv4Type === "custom" && (
      <Stack spacing={1.5}>
        <TextField label="IPv4 Subnet"
          placeholder="e.g., 172.100.100.0/24"
          value={props.ipv4Subnet}
          onChange={(e) => props.onIpv4SubnetChange(e.target.value)}
          disabled={props.isViewMode}
        />
        <TextField label="IPv4 Gateway"
          placeholder="e.g., 172.100.100.1"
          value={props.ipv4Gateway}
          onChange={(e) => props.onIpv4GatewayChange(e.target.value)}
          disabled={props.isViewMode}
        />
        <TextField label="IPv4 Range"
          placeholder="e.g., 172.100.100.128/25"
          value={props.ipv4Range}
          onChange={(e) => props.onIpv4RangeChange(e.target.value)}
          disabled={props.isViewMode}
        />
      </Stack>
    )}
  </Stack>
);

/** IPv6 settings section */
const Ipv6Section: React.FC<
  Pick<
    MgmtTabProps,
    | "ipv6Type"
    | "ipv6Subnet"
    | "ipv6Gateway"
    | "isViewMode"
    | "onIpv6TypeChange"
    | "onIpv6SubnetChange"
    | "onIpv6GatewayChange"
  >
> = (props) => (
  <Stack spacing={1.5}>
    <Typography variant="subtitle2">IPv6</Typography>
    <TextField
      select label="Subnet"
      value={props.ipv6Type}
      onChange={(e) => props.onIpv6TypeChange(e.target.value as IpType)}
      disabled={props.isViewMode}
    >
      <MenuItem value="default">Default (3fff:172:20:20::/64)</MenuItem>
      <MenuItem value="auto">Auto-assign</MenuItem>
      <MenuItem value="custom">Custom</MenuItem>
    </TextField>
    {props.ipv6Type === "custom" && (
      <Stack spacing={1.5}>
        <TextField label="IPv6 Subnet"
          placeholder="e.g., 3fff:172:100:100::/80"
          value={props.ipv6Subnet}
          onChange={(e) => props.onIpv6SubnetChange(e.target.value)}
          disabled={props.isViewMode}
        />
        <TextField label="IPv6 Gateway"
          placeholder="e.g., 3fff:172:100:100::1"
          value={props.ipv6Gateway}
          onChange={(e) => props.onIpv6GatewayChange(e.target.value)}
          disabled={props.isViewMode}
        />
      </Stack>
    )}
  </Stack>
);

/** Driver options section */
const DriverOptionsSection: React.FC<
  Pick<
    MgmtTabProps,
    | "driverOptions"
    | "isViewMode"
    | "onAddDriverOption"
    | "onRemoveDriverOption"
    | "onUpdateDriverOption"
  >
> = (props) => (
  <Stack spacing={1.5}>
    <Typography variant="subtitle2">Bridge Driver Options</Typography>
    <Stack spacing={1}>
      {props.driverOptions.map((opt, idx) => (
        <Stack direction="row" spacing={1} alignItems="center" key={`driver-opt-${idx}`}>
          <TextField label="Key"
            value={opt.key}
            onChange={(e) => props.onUpdateDriverOption(idx, "key", e.target.value)}
            disabled={props.isViewMode}
            fullWidth
          />
          <TextField label="Value"
            value={opt.value}
            onChange={(e) => props.onUpdateDriverOption(idx, "value", e.target.value)}
            disabled={props.isViewMode}
            fullWidth
          />
          {!props.isViewMode && (
            <IconButton onClick={() => props.onRemoveDriverOption(idx)}
              aria-label="Remove option"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      ))}
    </Stack>
    {!props.isViewMode && (
      <Button variant="outlined"
        onClick={props.onAddDriverOption}
        startIcon={<AddIcon fontSize="small" />}
      >
        Add Option
      </Button>
    )}
  </Stack>
);

export const MgmtTab: React.FC<MgmtTabProps> = (props) => {
  return (
    <Stack spacing={2}>
      <TextField label="Network Name"
        placeholder="clab"
        value={props.networkName}
        onChange={(e) => props.onNetworkNameChange(e.target.value)}
        disabled={props.isViewMode}
        helperText="Docker network name (default: clab)"
      />

      <Ipv4Section {...props} />
      <Ipv6Section {...props} />

      <TextField label="MTU"
        type="number"
        placeholder="Default: auto"
        value={props.mtu}
        onChange={(e) => props.onMtuChange(e.target.value)}
        disabled={props.isViewMode}
        helperText="MTU size (defaults to docker0 interface MTU)"
      />

      <TextField label="Bridge Name"
        placeholder="Default: auto"
        value={props.bridge}
        onChange={(e) => props.onBridgeChange(e.target.value)}
        disabled={props.isViewMode}
        helperText="Custom Linux bridge name (default: br-<network-id>)"
      />

      <Stack spacing={0.5}>
        <FormControlLabel
          control={
            <Checkbox
              checked={props.externalAccess}
              onChange={(e) => props.onExternalAccessChange(e.target.checked)}
              disabled={props.isViewMode}
            />
          }
          label="Enable External Access"
        />
        <Typography variant="caption" color="text.secondary">
          Allow external systems to reach lab nodes
        </Typography>
      </Stack>

      <DriverOptionsSection {...props} />
    </Stack>
  );
};
