/* eslint-disable sonarjs/pseudo-random */
import type cytoscape from 'cytoscape';
import { log } from '../logging/logger';

type NodeWithSilentPosition = cytoscape.NodeSingular & {
  // eslint-disable-next-line no-unused-vars
  silentPosition?: (position: cytoscape.Position) => void;
};

interface PositionSnapshot {
  x: number;
  y: number;
}

interface NodeStyleSnapshot {
  backgroundColor: string;
  borderColor: string;
  borderWidth: string;
  backgroundRotationAngle: string;
  locked: boolean;
}

interface MovementParams {
  baseX: number;
  baseY: number;
  radius: number;
  speedX: number;
  speedY: number;
  offsetX: number;
  offsetY: number;
}

const ROTATION_VALUE_REGEX = /(-?\d+(?:\.\d+)?)/;

/**
 * PartyModeController animates the Cytoscape canvas with disco-like effects.
 * It is activated via a VS Code command and lives entirely in the webview.
 */
export class PartyModeController {
  private cy: cytoscape.Core | null = null;
  private isActive = false;
  private readonly originalPositions = new Map<string, PositionSnapshot>();
  private readonly originalStyles = new Map<string, NodeStyleSnapshot>();
  private readonly currentRotation = new Map<string, number>();
  private readonly movementParams = new Map<string, MovementParams>();
  private colorIntervalId: number | null = null;
  private rotationIntervalId: number | null = null;
  private movementFrameId: number | null = null;
  private addNodeHandler: cytoscape.EventHandler | null = null;

  private readonly movementRadius = 45;

  public attachCy(cy: cytoscape.Core): void {
    if (this.cy === cy) {
      return;
    }
    if (this.cy && this.addNodeHandler) {
      this.cy.off('add', 'node', this.addNodeHandler);
    }
    this.cy = cy;
    if (this.isActive) {
      this.restartEffects();
      log.info('TopoViewer party mode activated.');
    }
  }

  public start(cy?: cytoscape.Core): void {
    if (cy) {
      this.attachCy(cy);
    }
    if (this.isActive) {
      return;
    }
    this.isActive = true;
    if (!this.cy) {
      log.warn('Party mode queued until Cytoscape becomes available.');
      return;
    }
    this.applyEffects();
    log.info('TopoViewer party mode activated.');
  }

  public stop(): void {
    if (!this.isActive) {
      return;
    }
    this.isActive = false;
    this.teardown(true);
    log.info('TopoViewer party mode deactivated.');
  }

  public handleTopologyReload(): void {
    if (!this.isActive || !this.cy) {
      return;
    }
    this.restartEffects();
  }

  public dispose(): void {
    this.stop();
    if (this.cy && this.addNodeHandler) {
      this.cy.off('add', 'node', this.addNodeHandler);
    }
    this.addNodeHandler = null;
    this.cy = null;
  }

  private applyEffects(): void {
    const cy = this.cy;
    if (!cy) {
      return;
    }
    this.captureOriginalState(cy);
    this.startMovement(cy);
    this.startColorFlashes(cy);
    this.startRotations(cy);
    this.registerNodeAddHandler(cy);
  }

  private restartEffects(): void {
    this.teardown(false);
    this.applyEffects();
  }

  private teardown(restore: boolean): void {
    if (this.rotationIntervalId !== null) {
      window.clearInterval(this.rotationIntervalId);
      this.rotationIntervalId = null;
    }
    if (this.movementFrameId !== null) {
      window.cancelAnimationFrame(this.movementFrameId);
      this.movementFrameId = null;
    }
    if (this.colorIntervalId !== null) {
      window.clearInterval(this.colorIntervalId);
      this.colorIntervalId = null;
    }
    const cy = this.cy;
    if (cy) {
      if (this.addNodeHandler) {
        cy.off('add', 'node', this.addNodeHandler);
        this.addNodeHandler = null;
      }
      if (restore) {
        this.restoreNodes(cy);
      }
    }
    this.originalPositions.clear();
    this.originalStyles.clear();
    this.currentRotation.clear();
    this.movementParams.clear();
  }

  private captureOriginalState(cy: cytoscape.Core): void {
    cy.nodes().forEach(node => {
      this.initializeNode(node);
    });
  }

  private initializeNode(node: cytoscape.NodeSingular): void {
    this.storeNodeState(node);
    if (node.locked()) {
      node.unlock();
    }
  }

  private storeNodeState(node: cytoscape.NodeSingular): void {
    const pos = node.position();
    this.originalPositions.set(node.id(), { x: pos.x, y: pos.y });
    const backgroundColor = node.style('background-color') ?? '';
    const borderColor = node.style('border-color') ?? '';
    const borderWidth = node.style('border-width') ?? '';
    const backgroundRotationAngle = node.style('background-rotation-angle') ?? '';
    this.originalStyles.set(node.id(), {
      backgroundColor,
      borderColor,
      borderWidth,
      backgroundRotationAngle,
      locked: node.locked(),
    });
    this.currentRotation.set(node.id(), this.parseRotation(backgroundRotationAngle));
    this.movementParams.set(node.id(), this.generateMovementParams(pos));
  }

  private registerNodeAddHandler(cy: cytoscape.Core): void {
    const handler: cytoscape.EventHandler = (event) => {
      const target = event.target as cytoscape.SingularElementArgument | undefined;
      if (!target || typeof target.group !== 'function' || target.group() !== 'nodes') {
        return;
      }
      const node = target as cytoscape.NodeSingular;
      this.initializeNode(node);
    };
    if (this.addNodeHandler) {
      cy.off('add', 'node', this.addNodeHandler);
    }
    this.addNodeHandler = handler;
    cy.on('add', 'node', handler);
  }

  private startMovement(cy: cytoscape.Core): void {
    if (typeof window.requestAnimationFrame !== 'function') {
      this.startFallbackMovement(cy);
      return;
    }
    const step = (timestamp: number) => {
      if (!this.isActive || !this.cy) {
        return;
      }
      cy.batch(() => {
        cy.nodes().forEach(node => {
          const params = this.movementParams.get(node.id());
          if (!params) {
            return;
          }
          const x = params.baseX + Math.cos(params.offsetX + timestamp * params.speedX) * params.radius;
          const y = params.baseY + Math.sin(params.offsetY + timestamp * params.speedY) * params.radius;
          this.setNodePosition(node, x, y);
        });
      });
      this.movementFrameId = window.requestAnimationFrame(step);
    };
    this.movementFrameId = window.requestAnimationFrame(step);
  }

  private startFallbackMovement(cy: cytoscape.Core): void {
    cy.nodes().forEach(node => {
      const params = this.movementParams.get(node.id());
      if (!params) {
        return;
      }
      const angle = Math.random() * Math.PI * 2;
      const x = params.baseX + Math.cos(angle) * params.radius;
      const y = params.baseY + Math.sin(angle) * params.radius;
      this.setNodePosition(node, x, y);
    });
  }

  private startColorFlashes(cy: cytoscape.Core): void {
    this.colorIntervalId = window.setInterval(() => {
      if (!this.isActive) {
        return;
      }
      cy.batch(() => {
        cy.nodes().forEach(node => {
          const backgroundColor = this.randomColor();
          const borderColor = this.randomColor();
          const borderWidth = 1 + Math.random() * 4;
          node.style({
            'background-color': backgroundColor,
            'border-color': borderColor,
            'border-width': `${borderWidth}px`,
          });
        });
      });
    }, 360);
  }

  private startRotations(cy: cytoscape.Core): void {
    this.rotationIntervalId = window.setInterval(() => {
      if (!this.isActive) {
        return;
      }
      cy.batch(() => {
        cy.nodes().forEach(node => {
          const current = this.currentRotation.get(node.id()) ?? 0;
          const increment = 30 + Math.random() * 90;
          const next = (current + increment) % 360;
          this.currentRotation.set(node.id(), next);
          node.style('background-rotation-angle', `${next}deg`);
        });
      });
    }, 420);
  }

  private restoreNodes(cy: cytoscape.Core): void {
    cy.batch(() => {
      cy.nodes().forEach(node => {
        const originalPosition = this.originalPositions.get(node.id());
        if (originalPosition) {
          this.setNodePosition(node, originalPosition.x, originalPosition.y);
        }
        const styleSnapshot = this.originalStyles.get(node.id());
        if (styleSnapshot) {
          node.style({
            'background-color': styleSnapshot.backgroundColor,
            'border-color': styleSnapshot.borderColor,
            'border-width': styleSnapshot.borderWidth,
            'background-rotation-angle': styleSnapshot.backgroundRotationAngle,
          });
          if (styleSnapshot.locked) {
            node.lock();
          } else {
            node.unlock();
          }
          this.currentRotation.set(node.id(), this.parseRotation(styleSnapshot.backgroundRotationAngle));
        }
      });
    });
  }

  private randomColor(): string {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 70 + Math.random() * 30;
    const lightness = 45 + Math.random() * 20;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  private generateMovementParams(position: PositionSnapshot): MovementParams {
    return {
      baseX: position.x,
      baseY: position.y,
      radius: this.movementRadius * (0.6 + Math.random() * 0.8),
      speedX: (Math.random() * 0.0014 + 0.0006),
      speedY: (Math.random() * 0.0014 + 0.0006),
      offsetX: Math.random() * Math.PI * 2,
      offsetY: Math.random() * Math.PI * 2,
    };
  }

  private setNodePosition(node: cytoscape.NodeSingular, x: number, y: number): void {
    const pos = { x, y };
    const anyNode = node as NodeWithSilentPosition;
    if (typeof anyNode.silentPosition === 'function') {
      anyNode.silentPosition(pos);
    } else {
      node.position(pos);
    }
  }

  private parseRotation(value: string | undefined): number {
    if (!value) {
      return 0;
    }
    const match = ROTATION_VALUE_REGEX.exec(value);
    if (!match) {
      return 0;
    }
    return Number.parseFloat(match[1]);
  }
}

export default PartyModeController;
