import type { DeploymentState } from "@shared/types/topology";
import type {
  TopologyHostCommand,
  TopologyHostResponseMessage,
  TopologySnapshot
} from "@shared/types/messages";
import { TOPOLOGY_HOST_PROTOCOL_VERSION } from "@shared/types/messages";
import type { IOLogger } from "@shared/io/types";
import { InMemoryFileSystemAdapter } from "@shared/io";
import { TopologyHostCore } from "@shared/host/TopologyHostCore";
import { createEmptyAnnotations } from "@shared/annotations/types";

const DEFAULT_YAML = `name: standalone-lab\ntopology:\n  nodes: {}\n  links: []\n`;

interface StandaloneHostOptions {
  yamlFilePath?: string;
  initialYaml?: string;
  initialAnnotations?: string | null;
  mode?: "edit" | "view";
  deploymentState?: DeploymentState;
  logger?: IOLogger;
}

export class StandaloneTopologyHost {
  private fs: InMemoryFileSystemAdapter;
  private host: TopologyHostCore;
  private yamlFilePath: string;

  constructor(options: StandaloneHostOptions = {}) {
    this.yamlFilePath = options.yamlFilePath ?? "/standalone/standalone.clab.yml";
    this.fs = new InMemoryFileSystemAdapter();
    const initialYaml = options.initialYaml ?? DEFAULT_YAML;
    void this.fs.writeFile(this.yamlFilePath, initialYaml);
    if (typeof options.initialAnnotations === "string") {
      const annotationsPath = this.getAnnotationsPath();
      void this.fs.writeFile(annotationsPath, options.initialAnnotations);
    }

    this.host = new TopologyHostCore({
      fs: this.fs,
      yamlFilePath: this.yamlFilePath,
      mode: options.mode ?? "edit",
      deploymentState: options.deploymentState ?? "undeployed",
      logger: options.logger
    });
  }

  getYamlPath(): string {
    return this.yamlFilePath;
  }

  async getSnapshot(): Promise<TopologySnapshot> {
    return this.host.getSnapshot();
  }

  updateContext(context: { mode?: "edit" | "view"; deploymentState?: DeploymentState }): void {
    this.host.updateContext(context);
  }

  async applyCommand(
    command: TopologyHostCommand,
    baseRevision: number
  ): Promise<TopologyHostResponseMessage> {
    return this.host.applyCommand(command, baseRevision);
  }

  async loadYaml(yamlContent: string): Promise<void> {
    await this.fs.writeFile(this.yamlFilePath, yamlContent);
    await this.fs.unlink(this.getAnnotationsPath());
    await this.host.onExternalChange();
  }

  async saveYaml(yamlContent: string): Promise<void> {
    await this.fs.writeFile(this.yamlFilePath, yamlContent);
    await this.host.onExternalChange();
  }

  async loadAnnotations(jsonContent: string | null): Promise<void> {
    const annotationsPath = this.getAnnotationsPath();
    if (jsonContent === null) {
      await this.fs.unlink(annotationsPath);
    } else {
      await this.fs.writeFile(annotationsPath, jsonContent);
    }
    await this.host.onExternalChange();
  }

  async saveAnnotations(jsonContent: string | null): Promise<void> {
    const annotationsPath = this.getAnnotationsPath();
    if (jsonContent === null) {
      await this.fs.unlink(annotationsPath);
    } else {
      await this.fs.writeFile(annotationsPath, jsonContent);
    }
    await this.host.onExternalChange();
  }

  async reset(): Promise<void> {
    await this.fs.writeFile(this.yamlFilePath, DEFAULT_YAML);
    await this.fs.unlink(this.getAnnotationsPath());
    await this.host.onExternalChange();
  }

  async getYamlContent(): Promise<string> {
    return this.fs.readFile(this.yamlFilePath);
  }

  async getAnnotationsContent(): Promise<string> {
    const snapshot = await this.host.getSnapshot();
    return JSON.stringify(snapshot.annotations ?? createEmptyAnnotations(), null, 2);
  }

  getProtocolVersion(): number {
    return TOPOLOGY_HOST_PROTOCOL_VERSION;
  }

  private getAnnotationsPath(): string {
    return `${this.yamlFilePath}.annotations.json`;
  }
}
