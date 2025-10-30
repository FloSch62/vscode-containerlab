// file: managerCytoscapeBaseStyles.ts

import cytoscape from 'cytoscape';
import { log } from '../logging/logger';
import { labelEndpointManager as labelEndpointManagerSingleton } from '../core/managerRegistry';
import { generateEncodedSVG, NodeType } from './managerSvgGenerator';
import topoViewerState from '../state';

// Common style literals reused several times
const DATA_NAME = 'data(name)';
const SELECTOR_GROUP = 'node[topoViewerRole="group"]';
const EDGE_LABEL_FONT_FAMILY = '"Segoe UI", "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
const GROUP_NODE_STYLE = {
  shape: 'rectangle',
  'border-width': '0.5px',
  'border-color': '#DDDDDD',
  'background-color': '#d9d9d9',
  width: '80px',
  height: '80px',
  'background-opacity': '0.2',
  color: '#EBECF0',
  'text-outline-color': '#000000',
  'font-size': '0.67em',
  'z-index': '1'
};

/**
 * Cytoscape styles shared between view and edit webviews.
 * Additional styles specific to the editor (edge handles, status nodes, etc.)
 * are included as they are harmless for the read-only view.
 */
const cytoscapeStylesBase: any[] = [
  {
    selector: 'core',
    style: {
      'selection-box-color': '#AAD8FF',
      'selection-box-border-color': '#8BB0D0',
      'selection-box-opacity': '0.5'
    }
  },
  {
    selector: 'node.empty-group',
    style: {
      'background-image': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjODg4IiAvPjwvc3ZnPg==',
      'background-width': '25px',
      'background-height': '25px',
      'background-position-x': '50%',
      'background-position-y': '50%',
      'background-repeat': 'no-repeat'
    }
  },
  {
    selector: 'node',
    style: {
      shape: 'rectangle',
      width: '10',
      height: '10',
      content: DATA_NAME,
      label: DATA_NAME,
      'font-size': '0.58em',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'background-color': '#8F96AC',
      'min-zoomed-font-size': '0.58em',
      color: '#F5F5F5',
      'text-outline-color': '#3C3E41',
      'text-outline-width': '0.3px',
      'text-background-color': '#000000',
      'text-background-opacity': 0.7,
      'text-background-shape': 'roundrectangle',
      'text-background-padding': '1px',
      'z-index': '2'
    }
  },
  {
    selector: 'node[?attr]',
    style: {
      shape: 'rectangle',
      'background-color': '#aaa',
      'text-outline-color': '#aaa',
      width: '10px',
      height: '10px',
      'font-size': '0.67em',
      'z-index': '2'
    }
  },
  {
    selector: 'node[?query]',
    style: { 'background-clip': 'none', 'background-fit': 'contain' }
  },
    { selector: 'node:parent', style: GROUP_NODE_STYLE },
  { selector: SELECTOR_GROUP, style: {} },
  // Alignment for parent nodes
  {
    selector: 'node:parent.top-center',
    style: {
      'text-halign': 'center',
      'text-valign': 'top',
      'text-margin-y': -2
    }
  },
  {
    selector: 'node:parent.top-left',
    style: {
      'text-halign': 'left',
      'text-valign': 'top',
      'text-margin-x': -4,
      'text-margin-y': -2
    }
  },
  {
    selector: 'node:parent.top-right',
    style: {
      'text-halign': 'right',
      'text-valign': 'top',
      'text-margin-x': 4,
      'text-margin-y': -2
    }
  },
  {
    selector: 'node:parent.bottom-center',
    style: {
      'text-halign': 'center',
      'text-valign': 'bottom',
      'text-margin-y': 2
    }
  },
  {
    selector: 'node:parent.bottom-left',
    style: {
      'text-halign': 'left',
      'text-valign': 'bottom',
      'text-margin-x': -4,
      'text-margin-y': 2
    }
  },
  {
    selector: 'node:parent.bottom-right',
    style: {
      'text-halign': 'right',
      'text-valign': 'bottom',
      'text-margin-x': 4,
      'text-margin-y': 2
    }
  },
  {
    selector: 'node:selected',
  },
  {
    selector: 'edge:selected',
  },
  {
    selector: '.link-label-highlight-node',
    style: {
      'border-width': '2px',
      'border-style': 'solid',
      'border-color': '#40A6FF',
      'border-opacity': '1',
      'overlay-color': '#40A6FF',
      'overlay-opacity': '0.25',
      'overlay-padding': '6px',
      'z-index': '9'
    }
  },
  {
    selector: '.link-label-highlight-edge',
    style: {
      'line-color': '#40A6FF',
      'target-arrow-color': '#40A6FF',
      'source-arrow-color': '#40A6FF',
      'width': '3px',
      'opacity': '1',
      'overlay-color': '#40A6FF',
      'overlay-opacity': '0.15',
      'overlay-padding': '4px',
      'z-index': '9'
    }
  },
  // Status indicator nodes
  {
    selector: 'node[name*="statusGreen"]',
    style: {
      display: 'none',
      shape: 'ellipse',
      label: ' ',
      width: '4',
      height: '4',
      'background-color': '#F5F5F5',
      'border-width': '0.5',
      'border-color': '#00A500'
    }
  },
  {
    selector: 'node[name*="statusRed"]',
    style: {
      display: 'none',
      shape: 'ellipse',
      label: ' ',
      width: '4',
      height: '4',
      'background-color': '#FD1C03',
      'border-width': '0.5',
      'border-color': '#AD0000'
    }
  },
    { selector: SELECTOR_GROUP, style: GROUP_NODE_STYLE },
  // Encoded SVG backgrounds for different node roles are added programmatically below.
  {
    selector: 'edge',
    style: {
      targetArrowShape: 'none',
      'font-size': '0.52em',
      'min-zoomed-font-size': '6px',
      'font-family': EDGE_LABEL_FONT_FAMILY,
      'font-weight': '600',
      'source-label': 'data(sourceEndpoint)',
      'target-label': 'data(targetEndpoint)',
      'source-text-offset': 20,
      'target-text-offset': 20,
      'arrow-scale': '0.5',
      color: '#1F232A',
      'text-background-color': '#CACBCC',
      'source-text-background-color': '#CACBCC',
      'target-text-background-color': '#CACBCC',
      'text-opacity': 1,
      'text-background-opacity': 0.9,
      'source-text-background-opacity': 0.9,
      'target-text-background-opacity': 0.9,
      'text-background-shape': 'roundrectangle',
      'text-background-padding': '2px',
      'source-text-background-shape': 'roundrectangle',
      'target-text-background-shape': 'roundrectangle',
      'source-text-background-padding': '2px',
      'target-text-background-padding': '2px',
      'curve-style': 'bezier',
      'control-point-step-size': 20,
      opacity: '0.7',
      'line-color': '#969799',
      width: '1.5',
      label: ' ',
      'overlay-padding': '2px'
    }
  },
  {
    selector: 'edge.link-up',
    style: {
      'text-background-color': '#00df2b',
      'source-text-background-color': '#00df2b',
      'target-text-background-color': '#00df2b',
      'source-text-background-opacity': 1,
      'target-text-background-opacity': 1
    }
  },
  {
    selector: 'edge.link-down',
    style: {
      'text-background-color': '#df2b00',
      'source-text-background-color': '#df2b00',
      'target-text-background-color': '#df2b00',
      'source-text-background-opacity': 1,
      'target-text-background-opacity': 1
    }
  },
  { selector: 'node.unhighlighted', style: { opacity: '0.2' } },
  { selector: 'edge.unhighlighted', style: { opacity: '0.05' } },
  { selector: '.highlighted', style: { 'z-index': '3' } },
  {
    selector: 'node.highlighted',
    style: {
      'border-width': '7px',
      'border-color': '#282828',
      'border-opacity': '0.5',
      'background-color': '#282828',
      'text-outline-color': '#282828'
    }
  },
  {
    selector: '.spf',
    style: {
      opacity: '1',
      'line-color': '#FF0000',
      'line-style': 'solid'
    }
  },
  // Stub link styles for special endpoints
  {
    selector: 'edge.stub-link',
    style: {
      'target-arrow-shape': 'circle',
      'source-arrow-shape': 'circle',
      'target-arrow-color': '#969799',
      'arrow-scale': 0.5,
      'line-style': 'dashed',
      'line-dash-pattern': [6, 3]
    }
  },
  {
    selector: 'node.special-endpoint',
    style: {
      'background-color': '#E8E8E8',
      'border-width': '1px',
      'border-color': '#969799',
      'background-opacity': 0.9,
      shape: 'round-rectangle',
      width: '14',
      height: '14'
    }
  },
  // Cloud node styles for network endpoints
  {
    selector: 'node[topoViewerRole="cloud"]',
    style: {
      'background-color': '#E8E8E8',
      'border-width': '0px',
      'border-color': '#969799',
      'background-opacity': 0.9,
      shape: 'rectangle',
      width: '14',
      height: '14',
      'font-size': '0.5em',
      content: DATA_NAME,
      label: DATA_NAME
    }
  },
  // Edge handles plugin styles
  {
    selector: '.eh-handle',
    style: {
      'background-color': 'red',
      width: 2,
      height: 2,
      shape: 'ellipse',
      'overlay-opacity': 0,
      'border-width': 2,
      'border-opacity': 0
    }
  },
  {
    selector: '.eh-hover',
    style: {
      'background-color': 'red'
    }
  },
  {
    selector: '.eh-source',
    style: {
      'border-width': 2,
      'border-color': 'red'
    }
  },
  {
    selector: '.eh-target',
    style: {
      'border-width': 2,
      'border-color': 'red'
    }
  },
  {
    selector: '.eh-preview, .eh-ghost-edge',
    style: {
      'background-color': 'red',
      'line-color': 'red',
      'target-arrow-color': 'red',
      'source-arrow-color': 'red'
    }
  },
  {
    selector: '.eh-ghost-edge.eh-preview-active',
    style: {
      opacity: 0
    }
  }
];

// Encoded SVG backgrounds for different node roles.
const commonRoleStyle: cytoscape.Css.Node = {
  width: '14',
  height: '14',
  'background-fit': 'cover'
};

const roleSvgMap: Record<string, NodeType> = {
  router: 'pe',
  default: 'pe',
  pe: 'pe',
  p: 'pe',
  controller: 'controller',
  pon: 'pon',
  dcgw: 'dcgw',
  leaf: 'leaf',
  switch: 'switch',
  rgw: 'rgw',
  'super-spine': 'super-spine',
  spine: 'spine',
  server: 'server',
  bridge: 'bridge',
  ue: 'ue',
  cloud: 'cloud',
  client: 'client'
};

const roleStyleOverrides: Record<string, cytoscape.Css.Node> = {
  router: { 'background-clip': 'none' },
  default: { 'background-clip': 'none' }
};

const roleStyles: any[] = Object.entries(roleSvgMap).map(([role, svgId]) => ({
  selector: `node[topoViewerRole="${role}"]`,
  style: {
    ...commonRoleStyle,
    'background-image': generateEncodedSVG(svgId, '#005aff'),
    ...(roleStyleOverrides[role] || {})
  }
}));

// Free text annotation styles
const freeTextStyles = [
  {
    selector: 'node[topoViewerRole="freeText"]',
    style: {
      shape: 'rectangle',
      'background-color': 'transparent',
      'background-opacity': 0,
      'border-width': 0,
      content: DATA_NAME,
      'text-wrap': 'wrap',
      'text-max-width': '200px',
      // Default font properties - will be overridden by custom styles
      'font-size': '1.17em',
      'color': '#FFFFFF',
      'text-outline-color': '#000000',
      'text-outline-width': 1,
      'text-background-color': '#000000',
      'text-background-opacity': 0.7,
      'text-background-padding': 3,
      'text-background-shape': 'roundrectangle',
      'text-halign': 'center',
      'text-valign': 'center',
      'z-index': 10,
      width: 'label',
      height: 'label',
      'padding': 2,
      'events': 'yes',
      'text-events': 'yes'
    }
  },
  {
    selector: 'node[topoViewerRole="freeText"]:selected',
    style: {
      'border-width': '1px',
      'border-color': '#007ACC',
      'border-style': 'dashed',
      'background-color': 'rgba(0, 122, 204, 0.1)',
      'background-opacity': 0.1,
      width: 'label',
      height: 'label',
      'padding': 2
    }
  },
  {
    selector: 'node[topoViewerRole="freeText"]:grabbed',
    style: {
      'cursor': 'move'
    }
  }
];

const insertIndex = cytoscapeStylesBase.findIndex((s: any) => s.selector === 'edge');
cytoscapeStylesBase.splice(insertIndex, 0, ...roleStyles, ...freeTextStyles);

type CytoscapeStyleMap = Record<string, any>;

interface EdgeLabelPalette {
  foreground: string;
  background: string;
  backgroundOpacity: number;
  padding: string;
}

interface EdgeStatusPalette {
  foreground: string;
  backgroundOpacity: number;
}

interface ThemeContext {
  theme: 'light' | 'dark';
  selectionColor: string;
  selectionBoxColor: string;
  selectionBoxBorderColor: string;
  edgeLabelPalette: EdgeLabelPalette;
  linkUpPalette: EdgeStatusPalette;
  linkDownPalette: EdgeStatusPalette;
}

function trimCssValue(style: CSSStyleDeclaration, property: string): string {
  return style.getPropertyValue(property).trim();
}

function buildThemeContext(theme: 'light' | 'dark', rootStyle: CSSStyleDeclaration): ThemeContext {
  const selectionColor = trimCssValue(rootStyle, '--vscode-focusBorder');
  const selectionBoxColor = trimCssValue(rootStyle, '--vscode-list-focusBackground');
  const selectionBoxBorderColor = trimCssValue(rootStyle, '--vscode-focusBorder');
  const editorForeground = trimCssValue(rootStyle, '--vscode-editor-foreground');
  const editorBackground = trimCssValue(rootStyle, '--vscode-editor-background');
  const panelBackground = trimCssValue(rootStyle, '--vscode-panel-background');
  const widgetBackground = trimCssValue(rootStyle, '--vscode-editorWidget-background');

  const fallbackForeground = theme === 'dark' ? '#F4F6FB' : '#1F232A';
  const labelForeground = editorForeground || fallbackForeground;
  const labelBackground = theme === 'dark'
    ? widgetBackground || editorBackground || '#2F3339'
    : panelBackground || editorBackground || '#E4E5E7';
  const labelBackgroundOpacity = theme === 'dark' ? 0.92 : 0.88;

  return {
    theme,
    selectionColor,
    selectionBoxColor,
    selectionBoxBorderColor,
    edgeLabelPalette: {
      foreground: labelForeground,
      background: labelBackground,
      backgroundOpacity: labelBackgroundOpacity,
      padding: '2px'
    },
    linkUpPalette: {
      foreground: '#FFFFFF',
      backgroundOpacity: 1
    },
    linkDownPalette: {
      foreground: '#FFFFFF',
      backgroundOpacity: 1
    }
  };
}

function adjustGroupStyle(style: CytoscapeStyleMap, theme: 'light' | 'dark'): void {
  if (theme === 'light') {
    style['background-color'] = '#a6a6a6';
    style['background-opacity'] = '0.4';
    style['border-width'] = '0.5px';
    style['border-color'] = '#aaaaaa';
  } else {
    style['background-color'] = '#d9d9d9';
    style['background-opacity'] = '0.2';
  }
}

function applyEdgeLabelPalette(style: CytoscapeStyleMap, palette: EdgeLabelPalette): void {
  style.color = palette.foreground;
  style['text-background-color'] = palette.background;
  style['source-text-background-color'] = palette.background;
  style['target-text-background-color'] = palette.background;
  style['text-background-opacity'] = palette.backgroundOpacity;
  style['source-text-background-opacity'] = palette.backgroundOpacity;
  style['target-text-background-opacity'] = palette.backgroundOpacity;
  style['text-background-padding'] = palette.padding;
  style['source-text-background-padding'] = palette.padding;
  style['target-text-background-padding'] = palette.padding;
}

function applyLinkStatusPalette(style: CytoscapeStyleMap, palette: EdgeStatusPalette): void {
  style.color = palette.foreground;
  style['text-background-opacity'] = palette.backgroundOpacity;
  style['source-text-background-opacity'] = palette.backgroundOpacity;
  style['target-text-background-opacity'] = palette.backgroundOpacity;
}

function applyNodeSelectedPalette(style: CytoscapeStyleMap, selectionColor: string): void {
  style['border-color'] = selectionColor;
  style['overlay-color'] = selectionColor;
  style['border-width'] = '3px';
  style['border-opacity'] = '1';
  style['border-style'] = 'solid';
  style['overlay-opacity'] = '0.3';
  style['overlay-padding'] = '3px';
}

function applyEdgeSelectedPalette(style: CytoscapeStyleMap, selectionColor: string): void {
  style['line-color'] = selectionColor;
  style['target-arrow-color'] = selectionColor;
  style['source-arrow-color'] = selectionColor;
  style['overlay-color'] = selectionColor;
  style['overlay-opacity'] = '0.2';
  style['overlay-padding'] = '6px';
  style['width'] = '4px';
  style['opacity'] = '1';
  style['z-index'] = '10';
}

function applySelectionBoxPalette(style: CytoscapeStyleMap, selectionBoxColor: string, selectionBoxBorderColor: string): void {
  style['selection-box-color'] = selectionBoxColor;
  style['selection-box-border-color'] = selectionBoxBorderColor;
  style['selection-box-opacity'] = '0.5';
}

function applyThemeAdjustments(selector: unknown, style: CytoscapeStyleMap, context: ThemeContext): void {
  if (typeof selector !== 'string') {
    return;
  }

  switch (selector) {
    case SELECTOR_GROUP:
      adjustGroupStyle(style, context.theme);
      break;
    case 'edge':
      applyEdgeLabelPalette(style, context.edgeLabelPalette);
      break;
    case 'edge.link-up':
      applyLinkStatusPalette(style, context.linkUpPalette);
      break;
    case 'edge.link-down':
      applyLinkStatusPalette(style, context.linkDownPalette);
      break;
    case 'node:selected':
      applyNodeSelectedPalette(style, context.selectionColor);
      break;
    case 'edge:selected':
      applyEdgeSelectedPalette(style, context.selectionColor);
      break;
    case '.link-label-highlight-node':
      style['border-color'] = context.selectionColor;
      style['overlay-color'] = context.selectionColor;
      break;
    case '.link-label-highlight-edge':
      style['line-color'] = context.selectionColor;
      style['target-arrow-color'] = context.selectionColor;
      style['source-arrow-color'] = context.selectionColor;
      style['overlay-color'] = context.selectionColor;
      break;
    case 'core':
      applySelectionBoxPalette(style, context.selectionBoxColor, context.selectionBoxBorderColor);
      break;
    default:
      break;
  }
}

/**
 * Returns a cloned Cytoscape style array adjusted for the given theme.
 * When `theme` is "light" group nodes appear darker with higher opacity.
 */
export function getCytoscapeStyles(theme: 'light' | 'dark') {
  const rootStyle = window.getComputedStyle(document.documentElement);
  const themeContext = buildThemeContext(theme, rootStyle);

  const styles = cytoscapeStylesBase.map((def: any) => {
    const clone: any = { selector: def.selector, style: { ...(def.style || {}) } };
    applyThemeAdjustments(def.selector, clone.style, themeContext);
    return clone;
  });

  const edgeStyle = styles.find((s: any) => s.selector === 'edge');
  if (edgeStyle) {
    const mode = topoViewerState.linkLabelMode;
    if (mode === 'show-all' || mode === 'show-all-rate') {
      edgeStyle.style['text-opacity'] = 1;
      edgeStyle.style['text-background-opacity'] = 0.7;
    } else {
      edgeStyle.style['text-opacity'] = 0;
      edgeStyle.style['text-background-opacity'] = 0;
    }
  }
  return styles;
}

function prefersDarkTheme(): boolean {
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function resolveThemeOverride(theme?: 'light' | 'dark'): 'light' | 'dark' {
  const engine = topoViewerState.editorEngine;
  const forced = engine?.layoutAlgoManager?.geoTheme;
  if (theme) {
    return theme;
  }
  if (forced) {
    return forced;
  }
  const detected = engine?.detectColorScheme?.();
  if (detected === 'dark' || detected === 'light') {
    return detected;
  }
  return prefersDarkTheme() ? 'dark' : 'light';
}

/**
 * Loads and applies Cytoscape styles to the provided Cytoscape instance.
 *
 * This method removes existing inline styles and applies the predefined styles.
 *
 * @param cy - The Cytoscape instance to style.
 */
export default async function loadCytoStyle(
  cy: cytoscape.Core,
  theme?: 'light' | 'dark',
  options?: { preserveExisting?: boolean }
): Promise<void> {
  try {
    const preserveExisting = options?.preserveExisting === true;
    if (!preserveExisting) {
      cy.nodes().removeStyle();
      cy.edges().removeStyle();
    }

    const selectedTheme = resolveThemeOverride(theme);
    const styles = getCytoscapeStyles(selectedTheme === 'light' ? 'light' : 'dark');
    cy.style().fromJson(styles).update();
    (window as any).updateTopoGridTheme?.(selectedTheme === 'light' ? 'light' : 'dark');
    labelEndpointManagerSingleton.refreshAfterStyle();
    log.info('Cytoscape styles applied successfully.');

    const layoutMgr = topoViewerState.editorEngine?.layoutAlgoManager;
    if (layoutMgr?.isGeoMapInitialized) {
      layoutMgr.applyGeoScale(true);
    }
  } catch (error) {
    log.error(`Error applying Cytoscape styles: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extracts node types from the style definitions.
 */
export function extractNodeIcons(): string[] {
  const nodeTypesSet = new Set<string>();
  const regex = /node\[topoViewerRole="([^"]+)"\]/;
  const skipList = ['group', 'freeText'];

  for (const styleDef of cytoscapeStylesBase) {
    if (typeof styleDef.selector === 'string') {
      const match = styleDef.selector.match(regex);
      if (match && match[1] && typeof match[1] === 'string' && !skipList.includes(match[1])) {
        // Only add if it's truly a string and not an object
        if (match[1] !== '[object Object]') {
          nodeTypesSet.add(match[1]);
        }
      }
    }
  }

  // Filter out any non-string values that might have snuck in
  return Array.from(nodeTypesSet)
    .filter(item => typeof item === 'string' && item !== '[object Object]')
    .sort();
}

// Expose globally for external consumers
(globalThis as any).loadCytoStyle = loadCytoStyle;
