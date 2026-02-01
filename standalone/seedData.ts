import type { CustomNodeTemplate } from "@shared/types/editors";
import type { CustomIconInfo } from "@shared/types/icons";

export const seedCustomNodes: CustomNodeTemplate[] = [
  {
    name: "SRLinux Latest",
    kind: "nokia_srlinux",
    type: "ixrd1",
    image: "ghcr.io/nokia/srlinux:latest",
    icon: "router",
    baseName: "srl",
    interfacePattern: "e1-{n}",
    setDefault: true
  },
  {
    name: "Network Multitool",
    kind: "linux",
    image: "ghcr.io/srl-labs/network-multitool:latest",
    icon: "client",
    baseName: "client",
    interfacePattern: "eth{n}",
    setDefault: false
  },
  {
    name: "Arista cEOS",
    kind: "arista_ceos",
    image: "ceos:latest",
    icon: "router",
    baseName: "ceos",
    interfacePattern: "Ethernet{n}",
    setDefault: false
  }
];

export const seedCustomIcons: CustomIconInfo[] = [];
