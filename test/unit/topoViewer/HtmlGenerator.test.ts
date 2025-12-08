/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the HtmlGenerator module.
 *
 * Tests HTML template generation for TopoViewer.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;

function clearModuleCache() {
  Object.keys(require.cache).forEach(key => {
    if (key.includes('vscode-containerlab') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });
}

// Mock fs module
let mockFiles: Map<string, string> = new Map();
let mockDirectories: Set<string> = new Set();

const fsMock = {
  existsSync: (filePath: string) => {
    return mockFiles.has(filePath) || mockDirectories.has(filePath);
  },
  readFileSync: (filePath: string, _encoding?: string) => {
    const content = mockFiles.get(filePath);
    if (content === undefined) {
      const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`) as any;
      error.code = 'ENOENT';
      throw error;
    }
    return content;
  },
  readdirSync: (dirPath: string) => {
    if (!mockDirectories.has(dirPath)) {
      const error = new Error(`ENOENT: no such file or directory, scandir '${dirPath}'`) as any;
      error.code = 'ENOENT';
      throw error;
    }
    const result: string[] = [];
    const prefix = dirPath.endsWith('/') ? dirPath : dirPath + '/';
    for (const [p] of mockFiles) {
      if (p.startsWith(prefix)) {
        const relativePath = p.slice(prefix.length);
        const firstSegment = relativePath.split('/')[0];
        if (firstSegment && !result.includes(firstSegment)) {
          result.push(firstSegment);
        }
      }
    }
    return result;
  }
};

// Mock logger
const loggerMock = {
  log: {
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {}
  }
};

function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request === 'fs') {
    return 'FS_MOCK';
  }
  if (request.includes('logger')) {
    return 'LOGGER_MOCK';
  }
  return null;
}

// Test constants to avoid duplicate string literals
const TEST_BASE_URL = 'https://test.local';
const TEST_CSS_URI = `${TEST_BASE_URL}/css`;
const TEST_JS_URI = `${TEST_BASE_URL}/js`;
const TEST_SCHEMA_URI = `${TEST_BASE_URL}/schema`;
const TEST_IMAGES_URI = `${TEST_BASE_URL}/images`;
const TEST_CYTO_JSON = `${TEST_BASE_URL}/cyto.json`;
const TEST_ENV_JSON = `${TEST_BASE_URL}/env.json`;
const TEST_DIST_URI = `${TEST_BASE_URL}/dist`;
const TEST_HOSTNAME = 'localhost';
const TEST_LAB_PATH = '/test/lab.clab.yml';
const TEST_TOPOLOGY_NAME = 'TestTopology';
const TOPO_VIEWER_MODE = 'viewer' as const;
const TOPO_EDITOR_MODE = 'editor' as const;
const KIND_NOKIA_SRLINUX = 'nokia_srlinux';
const IMG_SRLINUX = 'ghcr.io/nokia/srlinux:latest';

// Shared context
let generateHtmlTemplate: Function;
let vscodeStub: any;
let originalModuleRequire: any;

// Base template for testing
const MAIN_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="{{cssUri}}">
  <script src="{{jsUri}}"></script>
</head>
<body>
  {{HEADER}}
  <div id="topology">{{topologyName}}</div>
  <div id="mode">{{topoViewerMode}}</div>
  {{FOOTER}}
  <script>
    var config = {
      cytoscapeData: "{{jsonFileUrlDataCytoMarshall}}",
      environment: "{{jsonFileUrlDataEnvironment}}",
      schemaUri: "{{schemaUri}}",
      imagesUri: "{{imagesUri}}",
      jsOutDir: "{{jsOutDir}}",
      allowedHostname: "{{allowedHostname}}",
      deploymentState: "{{deploymentState}}",
      viewerMode: "{{viewerMode}}",
      imageMapping: {{imageMapping}},
      customNodes: {{customNodes}},
      defaultNode: "{{defaultNode}}",
      lockLabByDefault: {{lockLabByDefault}}
    };
  </script>
</body>
</html>`;

const HEADER_PARTIAL = '<header><h1>TopoViewer</h1></header>';
const FOOTER_PARTIAL = '<footer>Footer Content</footer>';

function createViewerParams(overrides: Record<string, any> = {}) {
  return {
    cssUri: TEST_CSS_URI,
    jsUri: TEST_JS_URI,
    schemaUri: TEST_SCHEMA_URI,
    imagesUri: TEST_IMAGES_URI,
    jsonFileUrlDataCytoMarshall: TEST_CYTO_JSON,
    jsonFileUrlDataEnvironment: TEST_ENV_JSON,
    isVscodeDeployment: true,
    jsOutDir: TEST_DIST_URI,
    allowedHostname: TEST_HOSTNAME,
    topologyName: TEST_TOPOLOGY_NAME,
    isDarkTheme: true,
    currentLabPath: TEST_LAB_PATH,
    lockLabByDefault: true,
    deploymentState: 'deployed' as const,
    viewerMode: TOPO_VIEWER_MODE,
    ...overrides
  };
}

function createEditorParams(overrides: Record<string, any> = {}) {
  return {
    cssUri: TEST_CSS_URI,
    jsUri: TEST_JS_URI,
    schemaUri: TEST_SCHEMA_URI,
    imagesUri: TEST_IMAGES_URI,
    jsonFileUrlDataCytoMarshall: TEST_CYTO_JSON,
    jsonFileUrlDataEnvironment: TEST_ENV_JSON,
    isVscodeDeployment: true,
    jsOutDir: TEST_DIST_URI,
    allowedHostname: TEST_HOSTNAME,
    topologyName: TEST_TOPOLOGY_NAME,
    isDarkTheme: false,
    currentLabPath: TEST_LAB_PATH,
    lockLabByDefault: false,
    imageMapping: {},
    ifacePatternMapping: {},
    defaultKind: 'linux',
    defaultType: 'default',
    updateLinkEndpointsOnKindChange: true,
    customNodes: [],
    defaultNode: '',
    ...overrides
  };
}

function setupHtmlGeneratorTests() {
  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath === 'FS_MOCK' || stubPath === 'LOGGER_MOCK') {
        return originalResolve.call(this, request, parent, isMain, options);
      }
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    originalModuleRequire = Module.prototype.require;
    (Module.prototype as any).require = function(id: string) {
      if (id === 'fs') {
        return fsMock;
      }
      if (id.includes('logger')) {
        return loggerMock;
      }
      return originalModuleRequire.call(this, id);
    };

    vscodeStub = require('../../helpers/vscode-stub');
  });

  after(() => {
    if (originalModuleRequire) {
      Module.prototype.require = originalModuleRequire;
    }
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    mockFiles.clear();
    mockDirectories.clear();
  });
}

function setupTemplateFiles(templatePath: string, partialsDir: string) {
  mockFiles.set(templatePath, MAIN_TEMPLATE);
  mockDirectories.add(partialsDir);
  mockFiles.set(`${partialsDir}/header.html`, HEADER_PARTIAL);
  mockFiles.set(`${partialsDir}/footer.html`, FOOTER_PARTIAL);
}

function loadGeneratorModule() {
  clearModuleCache();
  const htmlGeneratorModule = require('../../../src/topoViewer/extension/html/HtmlGenerator');
  generateHtmlTemplate = htmlGeneratorModule.generateHtmlTemplate;
}

function getTemplatePaths() {
  const templatePath = path.join(__dirname, '../../../src/topoViewer/extension/html', 'main.html');
  const partialsDir = path.join(__dirname, '../../../src/topoViewer/extension/html', 'partials');
  return { templatePath, partialsDir };
}

// -----------------------------------------------------------------------------
// Template Path Resolution Tests
// -----------------------------------------------------------------------------

describe('HtmlGenerator - template path resolution', () => {
  setupHtmlGeneratorTests();

  it('throws error when no template files exist', () => {
    loadGeneratorModule();

    const params = createViewerParams();

    expect(() => generateHtmlTemplate(TOPO_VIEWER_MODE, params)).to.throw('Template file not found');
  });
});

// -----------------------------------------------------------------------------
// Viewer Mode Template Generation
// -----------------------------------------------------------------------------

describe('HtmlGenerator - viewer mode', () => {
  setupHtmlGeneratorTests();

  it('generates HTML template for viewer mode', () => {
    const { templatePath, partialsDir } = getTemplatePaths();
    setupTemplateFiles(templatePath, partialsDir);
    loadGeneratorModule();

    const params = createViewerParams({
      cssUri: `${TEST_BASE_URL}/css/styles.css`,
      jsUri: `${TEST_BASE_URL}/js/viewer.js`
    });

    const html = generateHtmlTemplate(TOPO_VIEWER_MODE, params);

    expect(html).to.include('/css/styles.css');
    expect(html).to.include('/js/viewer.js');
    expect(html).to.include(TEST_TOPOLOGY_NAME);
    expect(html).to.include('viewer');
    expect(html).to.include('deployed');
  });

  it('includes resolved partials in output', () => {
    const { templatePath, partialsDir } = getTemplatePaths();
    setupTemplateFiles(templatePath, partialsDir);
    loadGeneratorModule();

    const params = createViewerParams({ deploymentState: 'undeployed' as const });

    const html = generateHtmlTemplate(TOPO_VIEWER_MODE, params);

    expect(html).to.include('<header>');
    expect(html).to.include('TopoViewer');
    expect(html).to.include('<footer>');
  });

  it('sets default values for viewer mode', () => {
    const { templatePath, partialsDir } = getTemplatePaths();
    setupTemplateFiles(templatePath, partialsDir);
    loadGeneratorModule();

    const params = createViewerParams({
      deploymentState: 'unknown' as const,
      viewerMode: 'unified' as const
    });

    const html = generateHtmlTemplate(TOPO_VIEWER_MODE, params);

    expect(html).to.include('imageMapping: {}');
    expect(html).to.include('customNodes: []');
    expect(html).to.include('defaultNode: ""');
  });
});

// -----------------------------------------------------------------------------
// Editor Mode Template Generation
// -----------------------------------------------------------------------------

describe('HtmlGenerator - editor mode', () => {
  setupHtmlGeneratorTests();

  it('generates HTML template for editor mode', () => {
    const { templatePath, partialsDir } = getTemplatePaths();
    setupTemplateFiles(templatePath, partialsDir);
    loadGeneratorModule();

    const params = createEditorParams({
      topologyName: 'EditorTopology',
      imageMapping: { [KIND_NOKIA_SRLINUX]: IMG_SRLINUX },
      ifacePatternMapping: { [KIND_NOKIA_SRLINUX]: 'e1-{1-32}' },
      defaultKind: KIND_NOKIA_SRLINUX,
      defaultType: 'ixr-d3l',
      customNodes: [
        { name: 'srl', kind: KIND_NOKIA_SRLINUX, type: 'ixr-d3l', setDefault: true }
      ],
      defaultNode: 'srl'
    });

    const html = generateHtmlTemplate(TOPO_EDITOR_MODE, params);

    expect(html).to.include('EditorTopology');
    expect(html).to.include('editor');
  });

  it('includes custom nodes in editor mode', () => {
    const { templatePath, partialsDir } = getTemplatePaths();
    setupTemplateFiles(templatePath, partialsDir);
    loadGeneratorModule();

    const customNodes = [
      { name: 'node1', kind: 'linux', type: 'ubuntu' },
      { name: 'node2', kind: KIND_NOKIA_SRLINUX, type: 'ixr-d2l', setDefault: true }
    ];

    const params = createEditorParams({
      customNodes,
      defaultNode: 'node2'
    });

    const html = generateHtmlTemplate(TOPO_EDITOR_MODE, params);

    expect(html).to.include('node1');
    expect(html).to.include('node2');
    expect(html).to.include(KIND_NOKIA_SRLINUX);
  });

  it('serializes image mapping correctly', () => {
    const { templatePath, partialsDir } = getTemplatePaths();
    setupTemplateFiles(templatePath, partialsDir);
    loadGeneratorModule();

    const params = createEditorParams({
      imageMapping: {
        [KIND_NOKIA_SRLINUX]: IMG_SRLINUX,
        linux: 'alpine:latest'
      }
    });

    const html = generateHtmlTemplate(TOPO_EDITOR_MODE, params);

    expect(html).to.include(IMG_SRLINUX);
    expect(html).to.include('alpine:latest');
  });
});

// -----------------------------------------------------------------------------
// Partial Loading Tests
// -----------------------------------------------------------------------------

describe('HtmlGenerator - partial loading', () => {
  setupHtmlGeneratorTests();

  it('handles missing partials gracefully', () => {
    const { templatePath, partialsDir } = getTemplatePaths();

    mockFiles.set(templatePath, MAIN_TEMPLATE);
    mockDirectories.add(partialsDir);

    loadGeneratorModule();

    const params = createViewerParams();

    const html = generateHtmlTemplate(TOPO_VIEWER_MODE, params);

    expect(html).to.be.a('string');
    expect(html).to.not.include('{{HEADER}}');
    expect(html).to.not.include('{{FOOTER}}');
  });

  it('loads partials with hyphens in filename', () => {
    const { templatePath, partialsDir } = getTemplatePaths();

    const templateWithHyphen = '{{SOME_PARTIAL}}';
    mockFiles.set(templatePath, templateWithHyphen);
    mockDirectories.add(partialsDir);
    mockFiles.set(`${partialsDir}/some-partial.html`, '<div>Hyphenated Partial</div>');

    loadGeneratorModule();

    const params = createViewerParams();

    const html = generateHtmlTemplate(TOPO_VIEWER_MODE, params);

    expect(html).to.include('Hyphenated Partial');
  });
});

// -----------------------------------------------------------------------------
// Cache Behavior Tests
// -----------------------------------------------------------------------------

describe('HtmlGenerator - caching behavior', () => {
  setupHtmlGeneratorTests();

  it('returns cached template on subsequent calls', () => {
    const { templatePath, partialsDir } = getTemplatePaths();
    setupTemplateFiles(templatePath, partialsDir);
    loadGeneratorModule();

    const cyto1 = `${TEST_BASE_URL}/cyto1.json`;
    const cyto2 = `${TEST_BASE_URL}/cyto2.json`;

    const params1 = createViewerParams({
      topologyName: 'CacheTest',
      jsonFileUrlDataCytoMarshall: cyto1,
      jsonFileUrlDataEnvironment: `${TEST_BASE_URL}/env1.json`
    });

    const html1 = generateHtmlTemplate(TOPO_VIEWER_MODE, params1);

    const params2 = createViewerParams({
      topologyName: 'CacheTest',
      jsonFileUrlDataCytoMarshall: cyto2,
      jsonFileUrlDataEnvironment: `${TEST_BASE_URL}/env2.json`
    });

    const html2 = generateHtmlTemplate(TOPO_VIEWER_MODE, params2);

    expect(html1).to.include('cyto1.json');
    expect(html2).to.include('cyto2.json');
  });
});

// -----------------------------------------------------------------------------
// Default Values Tests
// -----------------------------------------------------------------------------

describe('HtmlGenerator - default values', () => {
  setupHtmlGeneratorTests();

  it('uses default topology name when not provided', () => {
    const { templatePath, partialsDir } = getTemplatePaths();
    setupTemplateFiles(templatePath, partialsDir);
    loadGeneratorModule();

    const params = createViewerParams({ topologyName: undefined });

    const html = generateHtmlTemplate(TOPO_VIEWER_MODE, params);

    expect(html).to.include('Unknown Topology');
  });

  it('handles optional editor params', () => {
    const { templatePath, partialsDir } = getTemplatePaths();
    setupTemplateFiles(templatePath, partialsDir);
    loadGeneratorModule();

    const params = createEditorParams();

    const html = generateHtmlTemplate(TOPO_EDITOR_MODE, params);

    expect(html).to.be.a('string');
    expect(html.length).to.be.greaterThan(0);
  });
});

// -----------------------------------------------------------------------------
// Module Loading Tests
// -----------------------------------------------------------------------------

describe('HtmlGenerator - module behavior', () => {
  setupHtmlGeneratorTests();

  it('exports generateHtmlTemplate function', () => {
    loadGeneratorModule();
    expect(generateHtmlTemplate).to.be.a('function');
  });
});
