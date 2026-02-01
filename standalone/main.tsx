import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "@webview/App";
import "@webview/styles/tailwind.css";
import * as monaco from "monaco-editor";
import "monaco-editor/min/vs/editor/editor.main.css";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { conf as yamlConf, language as yamlLanguage } from "monaco-editor/esm/vs/basic-languages/yaml/yaml";

import clabSchema from "../schema/clab.schema.json";
import { parseSchemaData } from "@shared/schema";
import type { SchemaData } from "@shared/schema";
import type { CustomNodeTemplate } from "@shared/types/editors";
import type { CustomIconInfo } from "@shared/types/icons";
import type { DeploymentState } from "@shared/types/topology";
import {
  getIconFormat,
  isBuiltInIcon,
  isSupportedIconExtension
} from "@shared/types/icons";
import type {
  TopologyHostCommand,
  TopologyHostResponseMessage
} from "@shared/types/messages";
import { TOPOLOGY_HOST_PROTOCOL_VERSION } from "@shared/types/messages";

import { seedCustomIcons, seedCustomNodes } from "./seedData";
import { StandaloneTopologyHost } from "./StandaloneHost";
import { refreshTopologySnapshot } from "@webview/services/topologyHostCommands";
import { isSvgDataUri, sanitizeSvgDataUri } from "@webview/utils/svgSanitize";

// ============================================================================
// Initial Data
// ============================================================================

const schemaData = parseSchemaData(clabSchema as Record<string, unknown>);

type PersistedState = {
  yaml?: string;
  annotations?: string;
  customNodes?: CustomNodeTemplate[];
  customIcons?: CustomIconInfo[];
  defaultNode?: string;
};

const STORAGE_KEY = "topoviewer-standalone-state-v1";
const storage = typeof window !== "undefined" ? window.localStorage : undefined;

function loadPersistedState(): PersistedState | null {
  if (!storage) return null;
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedState;
  } catch (err) {
    console.warn("[Standalone] Failed to parse persisted state:", err);
    return null;
  }
}

const dockerImages = [
  "ghcr.io/nokia/srlinux:latest",
  "ghcr.io/nokia/srlinux:24.10.1",
  "alpine:latest",
  "ubuntu:latest"
];

interface InitialData {
  schemaData: SchemaData;
  dockerImages: string[];
  customNodes: CustomNodeTemplate[];
  defaultNode: string;
  customIcons: CustomIconInfo[];
}

const persisted = loadPersistedState();
const initialCustomNodes =
  persisted?.customNodes?.map((node) => ({ ...node })) ??
  seedCustomNodes.map((node) => ({ ...node }));
const sanitizeCustomIcon = (icon: CustomIconInfo): CustomIconInfo | null => {
  if (isSvgDataUri(icon.dataUri)) {
    const sanitized = sanitizeSvgDataUri(icon.dataUri);
    if (!sanitized) return null;
    return { ...icon, dataUri: sanitized };
  }
  return icon;
};
const initialCustomIcons = (persisted?.customIcons ?? seedCustomIcons)
  .map((icon) => sanitizeCustomIcon({ ...icon }))
  .filter((icon): icon is CustomIconInfo => icon !== null);
const initialDefaultNode =
  persisted?.defaultNode ||
  initialCustomNodes.find((node) => node.setDefault)?.name ||
  initialCustomNodes[0]?.name ||
  "";

const initialData: InitialData = {
  schemaData,
  dockerImages,
  customNodes: initialCustomNodes,
  defaultNode: initialDefaultNode,
  customIcons: initialCustomIcons
};

(window as unknown as Record<string, unknown>).__INITIAL_DATA__ = initialData;
(window as unknown as Record<string, unknown>).__SCHEMA_DATA__ = schemaData;
(window as unknown as Record<string, unknown>).__DOCKER_IMAGES__ = dockerImages;

// ============================================================================
// Standalone Host + Mock VS Code API
// ============================================================================

const host = new StandaloneTopologyHost({
  initialYaml:
    persisted?.yaml ??
    `name: standalone-lab\ntopology:\n  nodes: {}\n  links: []\n`,
  initialAnnotations: persisted?.annotations ?? undefined
});

const monacoGlobal = self as typeof self & {
  MonacoEnvironment?: {
    getWorker: (workerId: string, label: string) => Worker;
  };
};

if (!monacoGlobal.MonacoEnvironment) {
  monacoGlobal.MonacoEnvironment = {
    getWorker: (_workerId: string, label: string) => {
      return new EditorWorker();
    }
  };
}

const customNodesState: { nodes: CustomNodeTemplate[]; defaultNode: string } = {
  nodes: initialCustomNodes,
  defaultNode: initialDefaultNode
};

const customIconsState: { icons: CustomIconInfo[] } = {
  icons: initialCustomIcons
};

function postWebviewMessage(payload: Record<string, unknown>): void {
  window.postMessage(payload, window.location.origin);
}

function postCustomNodesUpdated(): void {
  postWebviewMessage({
    type: "custom-nodes-updated",
    customNodes: customNodesState.nodes,
    defaultNode: customNodesState.defaultNode
  });
}

function postCustomNodeError(error: string): void {
  postWebviewMessage({ type: "custom-node-error", error });
}

function postIconList(): void {
  postWebviewMessage({ type: "icon-list-response", icons: customIconsState.icons });
}

async function persistState(): Promise<void> {
  if (!storage) return;
  try {
    const yaml = await host.getYamlContent();
    const annotations = await host.getAnnotationsContent();
    const payload: PersistedState = {
      yaml,
      annotations,
      customNodes: customNodesState.nodes,
      customIcons: customIconsState.icons,
      defaultNode: customNodesState.defaultNode
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("[Standalone] Failed to persist state:", err);
  }
}

function ensureUniqueName(name: string, existing: Set<string>): string {
  const base = name.trim() || "custom-icon";
  if (!existing.has(base)) return base;
  let idx = 1;
  while (existing.has(`${base}-${idx}`)) idx += 1;
  return `${base}-${idx}`;
}

function sanitizeIconName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function pickIconFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".svg,.png";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

async function handleIconUpload(): Promise<void> {
  const file = await pickIconFile();
  if (!file) return;

  const extMatch = /\.[^.]+$/.exec(file.name);
  const ext = extMatch ? extMatch[0].toLowerCase() : "";
  if (!isSupportedIconExtension(ext)) {
    alert("Unsupported icon format. Use .svg or .png.");
    return;
  }

  let dataUri = await fileToDataUrl(file);
  if (ext === ".svg") {
    const sanitized = sanitizeSvgDataUri(dataUri);
    if (!sanitized) {
      alert("SVG contains unsupported or unsafe content.");
      return;
    }
    dataUri = sanitized;
  }
  const existing = new Set(customIconsState.icons.map((icon) => icon.name));
  const rawName = sanitizeIconName(file.name) || "custom-icon";
  const safeName = ensureUniqueName(
    isBuiltInIcon(rawName) ? `${rawName}-custom` : rawName,
    existing
  );

  customIconsState.icons = [
    ...customIconsState.icons,
    {
      name: safeName,
      source: "workspace",
      format: getIconFormat(ext),
      dataUri
    }
  ];
  postIconList();
  void persistState();
}

function handleIconDelete(iconName: string): void {
  customIconsState.icons = customIconsState.icons.filter((icon) => icon.name !== iconName);
  postIconList();
  void persistState();
}

function applyDefaultNode(name: string | null): void {
  const trimmed = typeof name === "string" ? name.trim() : "";
  const nextDefault = trimmed || customNodesState.nodes[0]?.name || "";
  customNodesState.defaultNode = nextDefault;
  customNodesState.nodes = customNodesState.nodes.map((node) => ({
    ...node,
    setDefault: node.name === nextDefault
  }));
}

function upsertCustomNode(data: CustomNodeTemplate & { oldName?: string }): void {
  const name = data.name?.trim();
  const kind = data.kind?.trim();
  if (!name || !kind) {
    postCustomNodeError("Custom node requires a name and kind.");
    return;
  }

  const oldName = data.oldName?.trim();
  const index = customNodesState.nodes.findIndex((node) => node.name === (oldName || name));
  const template: CustomNodeTemplate = { ...data, name, kind };
  delete (template as { oldName?: string }).oldName;

  if (index >= 0) {
    customNodesState.nodes[index] = template;
  } else {
    customNodesState.nodes = [...customNodesState.nodes, template];
  }

  if (customNodesState.defaultNode === oldName && oldName && oldName !== name) {
    applyDefaultNode(name);
  }

  if (template.setDefault) {
    applyDefaultNode(name);
  } else if (!customNodesState.defaultNode) {
    applyDefaultNode(name);
  }

  postCustomNodesUpdated();
  void persistState();
}

function deleteCustomNode(name: string): void {
  const nextNodes = customNodesState.nodes.filter((node) => node.name !== name);
  customNodesState.nodes = nextNodes;
  if (customNodesState.defaultNode === name) {
    applyDefaultNode(nextNodes[0]?.name ?? null);
  }
  postCustomNodesUpdated();
  void persistState();
}

function setDefaultCustomNode(name: string): void {
  applyDefaultNode(name);
  postCustomNodesUpdated();
  void persistState();
}

applyDefaultNode(customNodesState.defaultNode);

function setStandaloneMode(mode: "edit" | "view", deploymentState: DeploymentState): void {
  host.updateContext({ mode, deploymentState });
  postWebviewMessage({
    type: "topo-mode-changed",
    data: {
      mode: mode === "view" ? "viewer" : "editor",
      deploymentState
    }
  });
  postWebviewMessage({ type: "lab-lifecycle-status" });
}

// ============================================================================
// Standalone Split View (Monaco)
// ============================================================================

const SPLIT_VIEW_REFRESH_DEBOUNCE_MS = 200;
const MONACO_THEME_LIGHT = "standalone-vscode-light";
const MONACO_THEME_DARK = "standalone-vscode-dark";
const SPLIT_VIEW_FONT_FAMILY = "Consolas, Monaco, 'Courier New', monospace";
const YAML_DIRTY_ID = "splitViewYamlDirty";
const YAML_SAVE_ID = "splitViewYamlSave";
const SAVE_ALL_ID = "splitViewSaveAll";
const EXPORT_ID = "splitViewExport";
const CLEAR_LAB_ID = "splitViewClearLab";

let yamlEditor: monaco.editor.IStandaloneCodeEditor | null = null;
let yamlModel: monaco.editor.ITextModel | null = null;
let yamlRemoteUpdate = false;
let splitViewRefreshTimer: number | null = null;
let splitViewLayoutListenerBound = false;
let monacoInitialized = false;
let yamlLanguageRegistered = false;
let yamlDirty = false;

const currentFilePath = host.getYamlPath();

function registerYamlLanguage(): void {
  if (yamlLanguageRegistered) return;
  if (monaco.languages.getLanguages().some((lang) => lang.id === "yaml")) {
    yamlLanguageRegistered = true;
    return;
  }

  monaco.languages.register({ id: "yaml" });
  monaco.languages.setMonarchTokensProvider("yaml", yamlLanguage);
  monaco.languages.setLanguageConfiguration("yaml", yamlConf);
  yamlLanguageRegistered = true;
}

function getCssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function applyMonacoTheme(): void {
  const isLight = document.documentElement.classList.contains("light");
  const themeName = isLight ? MONACO_THEME_LIGHT : MONACO_THEME_DARK;
  const background = getCssVar("--vscode-editor-background", isLight ? "#ffffff" : "#1e1e1e");
  const foreground = getCssVar("--vscode-editor-foreground", isLight ? "#333333" : "#cccccc");
  const selection = getCssVar("--vscode-editor-selectionBackground", isLight ? "#add6ff" : "#264f78");
  const inactiveSelection = getCssVar(
    "--vscode-editor-inactiveSelectionBackground",
    isLight ? "#e5ebf1" : "#3a3d41"
  );

  monaco.editor.defineTheme(themeName, {
    base: isLight ? "vs" : "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": background,
      "editor.foreground": foreground,
      "editor.selectionBackground": selection,
      "editor.inactiveSelectionBackground": inactiveSelection
    }
  });

  monaco.editor.setTheme(themeName);
}

function ensureMonacoInitialized(): void {
  if (monacoInitialized) return;
  registerYamlLanguage();
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({ validate: false });
  applyMonacoTheme();
  monacoInitialized = true;
}

function layoutSplitViewEditors(): void {
  yamlEditor?.layout();
}

function scheduleSplitViewLayout(): void {
  if (!yamlEditor) return;
  requestAnimationFrame(() => {
    layoutSplitViewEditors();
    window.setTimeout(layoutSplitViewEditors, 350);
  });
}

function clearSplitViewSaveTimers(): void {
  if (splitViewRefreshTimer) {
    window.clearTimeout(splitViewRefreshTimer);
    splitViewRefreshTimer = null;
  }
}

function scheduleSplitViewRefresh(): void {
  clearSplitViewSaveTimers();
  splitViewRefreshTimer = window.setTimeout(() => {
    void updateSplitViewContent();
  }, SPLIT_VIEW_REFRESH_DEBOUNCE_MS);
}

function updateDirtyUI(): void {
  const yamlDirtyEl = document.getElementById(YAML_DIRTY_ID);
  const yamlSaveBtn = document.getElementById(YAML_SAVE_ID) as HTMLButtonElement | null;
  const saveAllBtn = document.getElementById(SAVE_ALL_ID) as HTMLButtonElement | null;

  if (yamlDirtyEl) {
    yamlDirtyEl.style.visibility = yamlDirty ? "visible" : "hidden";
  }
  if (yamlSaveBtn) {
    yamlSaveBtn.disabled = !yamlDirty;
  }
  if (saveAllBtn) {
    saveAllBtn.disabled = !yamlDirty;
  }
}

function setYamlDirty(next: boolean): void {
  yamlDirty = next;
  updateDirtyUI();
}

async function saveYamlFromEditor(): Promise<void> {
  if (!yamlModel) return;
  await host.saveYaml(yamlModel.getValue());
  setYamlDirty(false);
  await refreshTopologySnapshot();
  await persistState();
}

async function saveAllFromEditor(): Promise<void> {
  await saveYamlFromEditor();
}

function ensureSplitViewEditors(): void {
  if (yamlEditor) return;

  const yamlContainer = document.getElementById("yamlEditor");

  if (!yamlContainer) {
    console.warn("[Standalone] Split view editor containers not found");
    return;
  }

  ensureMonacoInitialized();

  yamlModel = monaco.editor.createModel("# Loading...", "yaml");
  yamlEditor = monaco.editor.create(yamlContainer, {
    model: yamlModel,
    minimap: { enabled: false },
    wordWrap: "on",
    fontFamily: SPLIT_VIEW_FONT_FAMILY,
    fontSize: 12,
    scrollBeyondLastLine: false,
    padding: { top: 8, bottom: 8 },
    automaticLayout: false
  });

  yamlEditor.onDidChangeModelContent(() => {
    if (yamlRemoteUpdate) return;
    setYamlDirty(true);
  });

  if (!splitViewLayoutListenerBound) {
    window.addEventListener("resize", layoutSplitViewEditors);
    splitViewLayoutListenerBound = true;
  }

  scheduleSplitViewLayout();
}

function setYamlContent(value: string): void {
  if (!yamlModel) return;
  if (yamlModel.getValue() === value) return;
  if (yamlDirty) {
    console.warn("[Standalone] Skipping YAML refresh; editor has unsaved changes.");
    return;
  }
  yamlRemoteUpdate = true;
  yamlModel.setValue(value);
  yamlRemoteUpdate = false;
  setYamlDirty(false);
}

function updateSplitViewTheme(): void {
  applyMonacoTheme();
}

function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportTopologyFiles(): Promise<void> {
  const yaml = await host.getYamlContent();
  const annotations = await host.getAnnotationsContent();
  downloadTextFile("topology.clab.yml", yaml);
  downloadTextFile("topology.annotations.json", annotations);
}

async function clearLab(): Promise<void> {
  await host.reset();
  await refreshTopologySnapshot();
  scheduleSplitViewRefresh();
  await persistState();
}

async function updateSplitViewContent(): Promise<void> {
  ensureSplitViewEditors();

  if (!yamlModel) return;

  const filePathLabel = document.getElementById("splitViewFilePath");
  const yamlLabel = document.getElementById("splitViewYamlLabel");
  const filename = currentFilePath.split("/").pop() || currentFilePath;
  if (filePathLabel) filePathLabel.textContent = `File: ${filename}`;
  if (yamlLabel) yamlLabel.textContent = filename;

  updateDirtyUI();

  try {
    const yamlContent = await host.getYamlContent();
    setYamlContent(yamlContent);
  } catch (error) {
    console.error("[Standalone] Failed to update split view content:", error);
    setYamlContent("# Error loading content");
  }
}

function bindSplitViewButtons(): void {
  const yamlSaveBtn = document.getElementById(YAML_SAVE_ID);
  const saveAllBtn = document.getElementById(SAVE_ALL_ID);
  const exportBtn = document.getElementById(EXPORT_ID);
  const clearLabBtn = document.getElementById(CLEAR_LAB_ID);

  yamlSaveBtn?.addEventListener("click", () => {
    void saveYamlFromEditor();
  });
  saveAllBtn?.addEventListener("click", () => {
    void saveAllFromEditor();
  });
  exportBtn?.addEventListener("click", () => {
    void exportTopologyFiles();
  });
  clearLabBtn?.addEventListener("click", () => {
    void clearLab();
  });
}

function initializeSplitView(): void {
  ensureSplitViewEditors();
  bindSplitViewButtons();
  void updateSplitViewContent();
  scheduleSplitViewLayout();
}

async function handleTopologyHostMessage(message: Record<string, unknown>): Promise<boolean> {
  const type = typeof message.type === "string" ? message.type : "";
  if (type !== "topology-host:get-snapshot" && type !== "topology-host:command") {
    return false;
  }

  const requestId = typeof message.requestId === "string" ? message.requestId : "";
  const protocolVersion = Number(message.protocolVersion ?? 0);
  if (protocolVersion !== TOPOLOGY_HOST_PROTOCOL_VERSION) {
    postWebviewMessage({
      type: "topology-host:error",
      protocolVersion: TOPOLOGY_HOST_PROTOCOL_VERSION,
      requestId,
      error: `Unsupported topology host protocol version: ${protocolVersion || "unknown"}`
    });
    return true;
  }

  try {
    if (type === "topology-host:get-snapshot") {
      const snapshot = await host.getSnapshot();
      postWebviewMessage({
        type: "topology-host:snapshot",
        protocolVersion: TOPOLOGY_HOST_PROTOCOL_VERSION,
        requestId,
        snapshot
      });
      return true;
    }

    const command = message.command as TopologyHostCommand | undefined;
    const baseRevision = Number(message.baseRevision ?? 0);
    if (!command || !command.command) {
      postWebviewMessage({
        type: "topology-host:error",
        protocolVersion: TOPOLOGY_HOST_PROTOCOL_VERSION,
        requestId,
        error: "Invalid topology host command payload"
      });
      return true;
    }

    const response = await host.applyCommand(command, baseRevision);
    const responseWithId: TopologyHostResponseMessage = {
      ...response,
      requestId: requestId || response.requestId
    };
    postWebviewMessage(responseWithId as unknown as Record<string, unknown>);
    void persistState();
    return true;
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    postWebviewMessage({
      type: "topology-host:error",
      protocolVersion: TOPOLOGY_HOST_PROTOCOL_VERSION,
      requestId,
      error: messageText
    });
    return true;
  }
}

function setupStandaloneCommandInterceptor(): void {
  type VscodeMessage = {
    command?: string;
    type?: string;
    level?: string;
    message?: string;
    fileLine?: string;
    name?: string;
    iconName?: string;
  };

  const warnedCommands = new Set<string>();
  const logLevelMap: Record<string, (...args: unknown[]) => void> = {
    debug: console.warn.bind(console),
    info: console.warn.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  };

  const warnOnce = (command: string) => {
    if (warnedCommands.has(command)) return;
    warnedCommands.add(command);
    console.warn(`[Standalone] Unhandled VS Code command: ${command}`);
  };

  const handleViewerLog = (msg: VscodeMessage) => {
    const level = typeof msg.level === "string" ? msg.level : "info";
    const logger = logLevelMap[level] ?? console.warn.bind(console);
    const fileLine = typeof msg.fileLine === "string" ? msg.fileLine : "";
    const message = typeof msg.message === "string" ? msg.message : "";
    const prefix = fileLine ? `[${fileLine}] ` : "";
    logger(`${prefix}${message}`);
  };

  const commandHandlers: Record<string, (msg: VscodeMessage) => void | Promise<void>> = {
    "topo-toggle-split-view": () => {
      scheduleSplitViewLayout();
    },
    deployLab: () => setStandaloneMode("view", "deployed"),
    deployLabCleanup: () => setStandaloneMode("view", "deployed"),
    redeployLab: () => setStandaloneMode("view", "deployed"),
    redeployLabCleanup: () => setStandaloneMode("view", "deployed"),
    destroyLab: () => setStandaloneMode("edit", "undeployed"),
    destroyLabCleanup: () => setStandaloneMode("edit", "undeployed"),
    "save-custom-node": (msg) => upsertCustomNode(msg as CustomNodeTemplate & { oldName?: string }),
    "delete-custom-node": (msg) => {
      const name = typeof msg.name === "string" ? msg.name : "";
      if (name) deleteCustomNode(name);
    },
    "set-default-custom-node": (msg) => {
      const name = typeof msg.name === "string" ? msg.name : "";
      if (name) setDefaultCustomNode(name);
    },
    "icon-upload": () => void handleIconUpload(),
    "icon-delete": (msg) => {
      const name = typeof msg.iconName === "string" ? msg.iconName : "";
      if (name) handleIconDelete(name);
    },
    "icon-list": () => postIconList(),
    "icon-reconcile": () => undefined,
    reactTopoViewerLog: handleViewerLog,
    topoViewerLog: handleViewerLog
  };

  const mockVscodeApi = {
    postMessage: (message: Record<string, unknown>) => {
      const isTopologyHost =
        typeof message.type === "string" && message.type.startsWith("topology-host:");
      if (isTopologyHost) {
        void handleTopologyHostMessage(message);
        return;
      }

      const msg = message as VscodeMessage | undefined;
      if (!msg?.command) return;

      const handler = commandHandlers[msg.command];
      if (handler) {
        void handler(msg);
        return;
      }

      warnOnce(msg.command);
    }
  };

  (window as unknown as { vscode: typeof mockVscodeApi }).vscode = mockVscodeApi;
}

// ============================================================================
// Bootstrap
// ============================================================================

setupStandaloneCommandInterceptor();

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

const root = createRoot(container);
root.render(
  <>
    <App initialData={initialData} />
  </>
);

(window as unknown as { __DEV__?: Record<string, unknown> }).__DEV__ = {
  onHostUpdate: scheduleSplitViewRefresh,
  updateSplitViewTheme,
  saveSplitViewYaml: saveYamlFromEditor,
  saveSplitViewAll: saveAllFromEditor
};

initializeSplitView();
