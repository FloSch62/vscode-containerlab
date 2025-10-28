// file: managerLabelEndpoint.ts

import cytoscape from 'cytoscape';
import type { VirtualElement } from '@popperjs/core';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { log } from '../logging/logger';
import topoViewerState from '../state';
import { normalizeLinkLabelMode, type LinkLabelMode, linkLabelModeLabel } from '../types/linkLabelMode';
import { extractLineRateValue as extractLineRateCandidate, type LineRateValue } from '../utilities/linkRateUtils';

const EDGE_HIGHLIGHT_CLASS = 'link-label-highlight-edge';
const NODE_HIGHLIGHT_CLASS = 'link-label-highlight-node';
const STYLE_TEXT_OPACITY = 'text-opacity';
const STYLE_TEXT_BACKGROUND_OPACITY = 'text-background-opacity';
const LINK_LABEL_BUTTON_ID = 'viewport-link-label-button';
const LINK_LABEL_MENU_ID = 'viewport-link-label-menu';
const LINK_RATE_TOOLTIP_THEME = 'link-rate';
const LINK_RATE_MIN_SCALE = 0.55;
const LINK_RATE_MAX_SCALE = 1.15;
const LINK_RATE_BASE_FONT_SIZE_PX = 8.8;
const LINK_RATE_BASE_PADDING_X_PX = 3;
const LINK_RATE_BASE_PADDING_Y_PX = 1;
const LINK_RATE_BASE_OFFSET_PX = 16;
const LINK_RATE_PARALLEL_SPACING_PX = 14;
const LINK_RATE_BACKGROUND_RGBA = 'rgba(202, 203, 204, 0.6)';

interface LineRateTooltipEntry {
  instance: TippyInstance;
  reference: VirtualElement;
}

class RollingWindowRateSmoother {
  private readonly samples: Array<{ value: number; timestamp: number }> = [];
  private readonly windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  public push(value: number, timestamp: number = Date.now()): number {
    this.samples.push({ value, timestamp });
    const cutoff = timestamp - this.windowMs;
    while (this.samples.length > 0 && this.samples[0].timestamp < cutoff) {
      this.samples.shift();
    }

    if (this.samples.length === 0) {
      return value;
    }

    const total = this.samples.reduce((sum, sample) => sum + sample.value, 0);
    return total / this.samples.length;
  }

  public reset(): void {
    this.samples.length = 0;
  }
}

const LINE_RATE_SMOOTHING_WINDOW_MS = 3500;

/**
 * Manages link label visibility and highlighting behaviour for edges.
 */
export class ManagerLabelEndpoint {
  private cy: cytoscape.Core | null = null;
  private currentMode: LinkLabelMode = topoViewerState.linkLabelMode;
  private readonly selectionHandler = (): void => {
    if (this.currentMode === 'on-select') {
      this.applyMode(this.currentMode);
    }
  };

  private readonly viewportChangeHandler = (): void => {
    if (this.currentMode === 'show-rate') {
      this.updateLineRateTooltipPositions();
    }
  };

  private readonly positionChangeHandler = (): void => {
    if (this.currentMode === 'show-rate') {
      this.updateLineRateTooltipPositions();
    }
  };

  private readonly edgeDataChangeHandler: cytoscape.EventHandler = (event: cytoscape.EventObject) => {
    if (this.currentMode !== 'show-rate') {
      return;
    }
    const edge = event.target as cytoscape.EdgeSingular | undefined;
    if (edge && edge.isEdge && edge.isEdge()) {
      this.updateLineRateTooltipForEdge(edge);
    }
  };

  private readonly edgeRemovalHandler: cytoscape.EventHandler = (event: cytoscape.EventObject) => {
    const edge = event.target as cytoscape.EdgeSingular | undefined;
    if (edge && edge.isEdge && edge.isEdge()) {
      this.destroyLineRateTooltip(edge.id());
    }
  };

  private readonly edgeAdditionHandler: cytoscape.EventHandler = (event: cytoscape.EventObject) => {
    if (this.currentMode !== 'show-rate') {
      return;
    }
    const edge = event.target as cytoscape.EdgeSingular | undefined;
    if (edge && edge.isEdge && edge.isEdge()) {
      this.updateLineRateTooltipForEdge(edge);
      this.updateLineRateTooltipPositions();
    }
  };

  private lineRateTooltips: Map<string, LineRateTooltipEntry> = new Map();
  private readonly lineRateSmoothers: Map<string, RollingWindowRateSmoother> = new Map();

  /**
   * Bind the manager to a Cytoscape instance.
   */
  public initialize(cy: cytoscape.Core): void {
    if (this.cy === cy) {
      this.applyMode(this.currentMode);
      this.syncMenu();
      return;
    }

    if (this.cy) {
      this.detachEventHandlers(this.cy);
    }

    this.cy = cy;
    this.currentMode = topoViewerState.linkLabelMode;
    this.attachEventHandlers(cy);
    this.applyMode(this.currentMode);
    this.syncMenu();
    log.debug(`Link label manager initialized with mode: ${this.currentMode}`);
  }

  /**
   * Update the active link label mode.
   */
  public setMode(mode: string | LinkLabelMode): void {
    const normalized = normalizeLinkLabelMode(mode);
    if (normalized === this.currentMode && topoViewerState.linkLabelMode === normalized) {
      this.syncMenu();
      return;
    }

    this.currentMode = normalized;
    topoViewerState.linkLabelMode = normalized;

    log.info(`Link label mode set to: ${normalized}`);
    if (this.cy) {
      this.applyMode(normalized);
    }
    this.syncMenu();
  }

  /**
   * Re-apply the mode after Cytoscape styles are refreshed.
   */
  public refreshAfterStyle(): void {
    if (!this.cy) {
      return;
    }
    this.applyMode(this.currentMode);
    this.syncMenu();
  }

  private attachEventHandlers(cy: cytoscape.Core): void {
    cy.on('select', 'node,edge', this.selectionHandler);
    cy.on('unselect', 'node,edge', this.selectionHandler);
    cy.on('pan zoom viewport', this.viewportChangeHandler);
    cy.on('position', 'node,edge', this.positionChangeHandler);
    cy.on('data', 'edge', this.edgeDataChangeHandler);
    cy.on('add', 'edge', this.edgeAdditionHandler);
    cy.on('remove', 'edge', this.edgeRemovalHandler);
  }

  private detachEventHandlers(cy: cytoscape.Core): void {
    cy.off('select', 'node,edge', this.selectionHandler);
    cy.off('unselect', 'node,edge', this.selectionHandler);
    cy.off('pan zoom viewport', this.viewportChangeHandler as any);
    cy.off('position', 'node,edge', this.positionChangeHandler);
    cy.off('data', 'edge', this.edgeDataChangeHandler);
    cy.off('add', 'edge', this.edgeAdditionHandler);
    cy.off('remove', 'edge', this.edgeRemovalHandler);
    this.destroyAllLineRateTooltips();
  }

  private applyMode(mode: LinkLabelMode): void {
    const cy = this.cy;
    if (!cy) {
      return;
    }

    cy.nodes().removeClass(NODE_HIGHLIGHT_CLASS);
    cy.edges().removeClass(EDGE_HIGHLIGHT_CLASS);

    if (mode !== 'show-rate') {
      this.destroyAllLineRateTooltips();
    }

    if (mode === 'hide') {
      cy.edges().forEach(edge => {
        edge.style(STYLE_TEXT_OPACITY, 0);
        edge.style(STYLE_TEXT_BACKGROUND_OPACITY, 0);
      });
      return;
    }

    if (mode === 'show-rate') {
      cy.edges().forEach(edge => {
        edge.style(STYLE_TEXT_OPACITY, 0);
        edge.style(STYLE_TEXT_BACKGROUND_OPACITY, 0);
      });
      this.updateLineRateTooltips();
      return;
    }

    if (mode === 'show-all') {
      cy.edges().forEach(edge => {
        edge.style(STYLE_TEXT_OPACITY, 1);
        edge.style(STYLE_TEXT_BACKGROUND_OPACITY, 0.7);
      });
      return;
    }

    // on-select behaviour
    cy.edges().forEach(edge => {
      edge.style(STYLE_TEXT_OPACITY, 0);
      edge.style(STYLE_TEXT_BACKGROUND_OPACITY, 0);
    });

    const selectedNodes = cy.nodes(':selected');
    const selectedEdges = cy.edges(':selected');

    const edgesToHighlight = selectedEdges.union(selectedNodes.connectedEdges());
    edgesToHighlight.forEach(edge => {
      edge.addClass(EDGE_HIGHLIGHT_CLASS);
      edge.style(STYLE_TEXT_OPACITY, 1);
      edge.style(STYLE_TEXT_BACKGROUND_OPACITY, 0.7);
    });

    const nodesToHighlight = selectedNodes.union(selectedEdges.connectedNodes());
    nodesToHighlight.forEach(node => {
      node.addClass(NODE_HIGHLIGHT_CLASS);
    });
  }

  private updateLineRateTooltips(): void {
    const cy = this.cy;
    if (!cy || this.currentMode !== 'show-rate') {
      return;
    }

    const seen = new Set<string>();
    cy.edges().forEach(edge => {
      const edgeId = edge.id();
      seen.add(edgeId);
      this.updateLineRateTooltipForEdge(edge);
    });

    for (const edgeId of Array.from(this.lineRateTooltips.keys())) {
      if (!seen.has(edgeId)) {
        this.destroyLineRateTooltip(edgeId);
      }
    }

    this.updateLineRateTooltipPositions();
  }

  private updateLineRateTooltipForEdge(edge: cytoscape.EdgeSingular): void {
    if (this.currentMode !== 'show-rate') {
      return;
    }

    const edgeId = edge.id();
    const raw = this.getLineRateValue(edge);
    const smoothed = this.applyLineRateSmoothing(edgeId, raw);
    const formatted = smoothed !== undefined ? this.formatLineRate(smoothed) : null;

    if (!formatted) {
      this.destroyLineRateTooltip(edgeId);
      return;
    }

    const existing = this.lineRateTooltips.get(edgeId);
    if (existing) {
      existing.instance.setContent(formatted);
      this.syncLineRateTooltipAppearance(existing.instance);
      existing.instance.popperInstance?.update();
      return;
    }

    this.createLineRateTooltip(edge, formatted);
  }

  private updateLineRateTooltipPositions(): void {
    if (this.currentMode !== 'show-rate' || this.lineRateTooltips.size === 0) {
      return;
    }

    this.lineRateTooltips.forEach(({ instance }) => {
      this.syncLineRateTooltipAppearance(instance);
      instance.popperInstance?.update();
    });
  }

  private createLineRateTooltip(edge: cytoscape.EdgeSingular, label: string): void {
    const reference = this.createVirtualReference(edge);
    const anchor = document.createElement('div');
    const scale = this.computeLineRateScale(this.cy?.zoom() ?? 1);
    const instance = tippy(anchor, {
      content: label,
      allowHTML: false,
      trigger: 'manual',
      interactive: false,
      placement: 'top',
      theme: LINK_RATE_TOOLTIP_THEME,
      offset: [0, this.computeLineRateOffset(scale)],
      hideOnClick: false,
      arrow: false,
      appendTo: () => this.cy?.container() ?? document.body,
      getReferenceClientRect: reference.getBoundingClientRect,
    });
    instance.show();
    this.syncLineRateTooltipAppearance(instance);
    instance.popperInstance?.update();
    this.lineRateTooltips.set(edge.id(), { instance, reference });
  }

  private destroyLineRateTooltip(edgeId: string): void {
    const entry = this.lineRateTooltips.get(edgeId);
    if (!entry) {
      return;
    }
    entry.instance.destroy();
    this.lineRateTooltips.delete(edgeId);
    this.lineRateSmoothers.delete(edgeId);
  }

  private destroyAllLineRateTooltips(): void {
    if (this.lineRateTooltips.size === 0) {
      return;
    }
    this.lineRateTooltips.forEach(({ instance }) => instance.destroy());
    this.lineRateTooltips.clear();
    this.lineRateSmoothers.clear();
  }

  private syncLineRateTooltipAppearance(instance: TippyInstance): void {
    const zoom = this.cy?.zoom() ?? 1;
    const scale = this.computeLineRateScale(zoom);
    const offset = this.computeLineRateOffset(scale);

    instance.setProps({ offset: [0, offset], hideOnClick: false, arrow: false });

    const box = instance.popper.querySelector('.tippy-box') as HTMLElement | null;
    if (!box) {
      return;
    }

    const fontSize = this.computeLineRateFontSize(scale);
    const paddingX = this.computeLineRatePaddingX(scale);
    const paddingY = this.computeLineRatePaddingY(scale);

    box.style.fontSize = `${fontSize}px`;
    box.style.padding = `${paddingY}px ${paddingX}px`;
    box.style.backgroundColor = LINK_RATE_BACKGROUND_RGBA;
    box.style.lineHeight = '1';
  }

  private computeLineRateScale(zoom: number): number {
    const clamped = Math.min(LINK_RATE_MAX_SCALE, Math.max(LINK_RATE_MIN_SCALE, zoom));
    return Number(clamped.toFixed(3));
  }

  private computeLineRateOffset(scale: number = 1): number {
    const offset = LINK_RATE_BASE_OFFSET_PX + (scale - 1) * 10;
    return Math.max(10, Math.min(24, offset));
  }

  private computeLineRateFontSize(scale: number): number {
    const size = LINK_RATE_BASE_FONT_SIZE_PX * scale;
    return Math.max(7.5, Math.min(10.5, size));
  }

  private computeLineRatePaddingX(scale: number): number {
    const padding = LINK_RATE_BASE_PADDING_X_PX * scale;
    return Math.max(1.5, Math.min(5, padding));
  }

  private computeLineRatePaddingY(scale: number): number {
    const padding = LINK_RATE_BASE_PADDING_Y_PX * scale;
    return Math.max(0.8, Math.min(2.5, padding));
  }

  // eslint-disable-next-line sonarjs/function-return-type
  private applyLineRateSmoothing(edgeId: string, value: LineRateValue | undefined): LineRateValue | undefined {
    if (value === undefined) {
      this.lineRateSmoothers.delete(edgeId);
      return undefined;
    }

    if (typeof value !== 'number') {
      this.lineRateSmoothers.delete(edgeId);
      return value;
    }

    const smoother = this.lineRateSmoothers.get(edgeId) ?? new RollingWindowRateSmoother(LINE_RATE_SMOOTHING_WINDOW_MS);
    const smoothed = smoother.push(value);
    this.lineRateSmoothers.set(edgeId, smoother);
    return smoothed;
  }

  private computeLineRateNormalOffset(edge: cytoscape.EdgeSingular): { x: number; y: number } {
    const parallelEdges = this.getParallelEdges(edge);
    if (parallelEdges.length <= 1) {
      return { x: 0, y: 0 };
    }

    const index = parallelEdges.findIndex(candidate => candidate.id() === edge.id());
    if (index === -1) {
      return { x: 0, y: 0 };
    }

    const offsetIndex = index - (parallelEdges.length - 1) / 2;
    if (Math.abs(offsetIndex) < 1e-6) {
      return { x: 0, y: 0 };
    }

    const scale = this.computeLineRateScale(this.cy?.zoom() ?? 1);
    const distance = LINK_RATE_PARALLEL_SPACING_PX * scale * offsetIndex;

    const source = edge.source();
    const target = edge.target();
    if (!source || !target) {
      return { x: 0, y: 0 };
    }
    const sourcePos = source.renderedPosition();
    const targetPos = target.renderedPosition();
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length < 1e-3) {
      return { x: 0, y: 0 };
    }

    let nx = dy / length;
    let ny = -dx / length;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }

    return { x: nx * distance, y: ny * distance };
  }

  private getParallelEdges(edge: cytoscape.EdgeSingular): cytoscape.EdgeSingular[] {
    const cy = this.cy;
    if (!cy) {
      return [edge];
    }

    const sourceId = edge.source()?.id();
    const targetId = edge.target()?.id();
    if (!sourceId || !targetId) {
      return [edge];
    }

    const result: cytoscape.EdgeSingular[] = [];
    cy.edges().forEach(candidate => {
      const candidateSource = candidate.source()?.id();
      const candidateTarget = candidate.target()?.id();
      if (!candidateSource || !candidateTarget) {
        return;
      }
      const sameDirection = candidateSource === sourceId && candidateTarget === targetId;
      const oppositeDirection = candidateSource === targetId && candidateTarget === sourceId;
      if (sameDirection || oppositeDirection) {
        result.push(candidate);
      }
    });

    return result.sort((a, b) => a.id().localeCompare(b.id()));
  }

  private createVirtualReference(edge: cytoscape.EdgeSingular): VirtualElement {
    return {
      getBoundingClientRect: () => {
        const container = this.cy?.container();
        const rect = container?.getBoundingClientRect();
        const midpoint = edge.renderedMidpoint();
        const offset = this.computeLineRateNormalOffset(edge);
        const left = (rect?.left ?? 0) + midpoint.x + offset.x;
        const top = (rect?.top ?? 0) + midpoint.y + offset.y;
        return new DOMRect(left, top, 0, 0);
      },
      contextElement: this.cy?.container() ?? document.body,
    };
  }

  // eslint-disable-next-line sonarjs/function-return-type
  private getLineRateValue(edge: cytoscape.EdgeSingular): LineRateValue | undefined {
    const data = edge.data() as Record<string, unknown>;
    let result: LineRateValue | undefined;

    const directCandidates: unknown[] = [
      data.lineRate,
      (data as any).linerate,
      (data as any)['line-rate'],
      (data as any)['line_rate'],
      (data.extraData as Record<string, unknown> | undefined)?.extLineRate,
    ];

    for (const candidate of directCandidates) {
      const normalized = extractLineRateCandidate(candidate);
      if (normalized !== undefined) {
        result = normalized;
        break;
      }
    }

    if (result === undefined) {
      result = extractLineRateCandidate(data.extraData);
    }

    if (result === undefined) {
      result = extractLineRateCandidate(data);
    }

    return result;
  }

  private formatLineRate(value: LineRateValue): string | null {
    if (typeof value === 'number') {
      return this.formatNumericLineRate(value);
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private formatNumericLineRate(value: number): string {
    const abs = Math.abs(value);
    const units: Array<{ threshold: number; suffix: string; divisor: number }> = [
      { threshold: 1e12, suffix: 'Tbps', divisor: 1e12 },
      { threshold: 1e9, suffix: 'Gbps', divisor: 1e9 },
      { threshold: 1e6, suffix: 'Mbps', divisor: 1e6 },
      { threshold: 1e3, suffix: 'Kbps', divisor: 1e3 },
    ];

    for (const { threshold, suffix, divisor } of units) {
      if (abs >= threshold) {
        const scaled = value / divisor;
        const digits = Math.abs(scaled) >= 10 ? 0 : 2;
        return `${scaled.toFixed(digits)} ${suffix}`;
      }
    }

    return `${value.toFixed(0)} bps`;
  }

  private syncMenu(): void {
    const menu = document.getElementById(LINK_LABEL_MENU_ID);
    if (menu) {
      const options = menu.querySelectorAll<HTMLButtonElement>('[data-mode]');
      options.forEach(option => {
        const optionMode = normalizeLinkLabelMode(option.dataset.mode ?? '');
        const isSelected = optionMode === this.currentMode;
        option.dataset.selected = isSelected ? 'true' : 'false';
        option.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      });
    }

    const trigger = document.getElementById(LINK_LABEL_BUTTON_ID) as HTMLButtonElement | null;
    if (trigger) {
      const label = linkLabelModeLabel(this.currentMode);
      const description = `Link labels: ${label}`;
      trigger.dataset.mode = this.currentMode;
      trigger.setAttribute('aria-label', description);
      trigger.setAttribute('title', description);
    }
  }
}
