// Stub for treeView/common module

export class ClabLabTreeNode {
  label: string;
  labPath: string;

  constructor(label: string = '', labPath: string = '') {
    this.label = label;
    this.labPath = labPath;
  }
}

export class ClabContainerTreeNode {
  label: string;
  containerId: string;

  constructor(label: string = '', containerId: string = '') {
    this.label = label;
    this.containerId = containerId;
  }
}

export class ClabInterfaceTreeNode {
  label: string;
  interfaceName: string;

  constructor(label: string = '', interfaceName: string = '') {
    this.label = label;
    this.interfaceName = interfaceName;
  }
}
