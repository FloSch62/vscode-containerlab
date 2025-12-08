/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname */
/* eslint-disable aggregate-complexity/aggregate-complexity, sonarjs/no-duplicate-string */
import { expect } from 'chai';
import sinon from 'sinon';
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

function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request === 'https') {
    return path.join(__dirname, '..', '..', 'helpers', 'https-stub.js');
  }
  return null;
}

let popularLabs: any;
let httpsStub: any;
let vscodeStub: any;

describe('popularLabs', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    httpsStub = require('../../helpers/https-stub');
    vscodeStub = require('../../helpers/vscode-stub');
    popularLabs = require('../../../src/helpers/popularLabs');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    httpsStub.resetMock();
    vscodeStub.resetVscodeStub();
  });

  afterEach(() => {
    httpsStub.resetMock();
    vscodeStub.resetVscodeStub();
  });

  describe('fallbackRepos', () => {
    const SRL_LABS_BASE = 'https://github.com/srl-labs';

    it('should be an array', () => {
      expect(popularLabs.fallbackRepos).to.be.an('array');
    });

    it('should have 5 repos', () => {
      expect(popularLabs.fallbackRepos).to.have.lengthOf(5);
    });

    it('should have repos with correct structure', () => {
      popularLabs.fallbackRepos.forEach((repo: any) => {
        expect(repo).to.have.property('name').that.is.a('string');
        expect(repo).to.have.property('html_url').that.is.a('string');
        expect(repo).to.have.property('description').that.is.a('string');
        expect(repo).to.have.property('stargazers_count').that.is.a('number');
      });
    });

    it('should have valid GitHub URLs', () => {
      const githubUrlPattern = /^https:\/\/github\.com\/[\w-]+\/[\w-]+$/;
      popularLabs.fallbackRepos.forEach((repo: any) => {
        expect(repo.html_url).to.match(githubUrlPattern);
      });
    });

    it('should contain srl-telemetry-lab', () => {
      const telemetryLab = popularLabs.fallbackRepos.find((r: any) => r.name === 'srl-telemetry-lab');
      expect(telemetryLab).to.exist;
      expect(telemetryLab.html_url).to.equal(`${SRL_LABS_BASE}/srl-telemetry-lab`);
      expect(telemetryLab.description).to.be.a('string');
      expect(telemetryLab.stargazers_count).to.be.a('number');
    });

    it('should contain netbox-nrx-clab', () => {
      const netboxLab = popularLabs.fallbackRepos.find((r: any) => r.name === 'netbox-nrx-clab');
      expect(netboxLab).to.exist;
      expect(netboxLab.html_url).to.equal(`${SRL_LABS_BASE}/netbox-nrx-clab`);
    });

    it('should contain sros-anysec-macsec-lab', () => {
      const srosLab = popularLabs.fallbackRepos.find((r: any) => r.name === 'sros-anysec-macsec-lab');
      expect(srosLab).to.exist;
      expect(srosLab.html_url).to.equal(`${SRL_LABS_BASE}/sros-anysec-macsec-lab`);
    });

    it('should contain intent-based-ansible-lab', () => {
      const ansibleLab = popularLabs.fallbackRepos.find((r: any) => r.name === 'intent-based-ansible-lab');
      expect(ansibleLab).to.exist;
      expect(ansibleLab.html_url).to.equal(`${SRL_LABS_BASE}/intent-based-ansible-lab`);
    });

    it('should contain multivendor-evpn-lab', () => {
      const evpnLab = popularLabs.fallbackRepos.find((r: any) => r.name === 'multivendor-evpn-lab');
      expect(evpnLab).to.exist;
      expect(evpnLab.html_url).to.equal(`${SRL_LABS_BASE}/multivendor-evpn-lab`);
    });
  });

  describe('fetchPopularRepos', () => {
    const SRL_LABS_ORG = 'https://github.com/srl-labs';
    const ERROR_MESSAGE = 'Should have thrown an error';

    it('should successfully fetch and parse repos from GitHub API', async () => {
      const mockResponse = {
        items: [
          {
            name: 'test-repo-1',
            html_url: `${SRL_LABS_ORG}/test-repo-1`,
            description: 'Test repository 1',
            stargazers_count: 100,
          },
          {
            name: 'test-repo-2',
            html_url: `${SRL_LABS_ORG}/test-repo-2`,
            description: 'Test repository 2',
            stargazers_count: 50,
          },
        ],
      };

      httpsStub.setMockResponseData(JSON.stringify(mockResponse));

      const result = await popularLabs.fetchPopularRepos();

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(2);
      expect(result[0]).to.deep.equal(mockResponse.items[0]);
      expect(result[1]).to.deep.equal(mockResponse.items[1]);
    });

    it('should return empty array when API returns items as null', async () => {
      const mockResponse = {
        items: null,
      };

      httpsStub.setMockResponseData(JSON.stringify(mockResponse));

      const result = await popularLabs.fetchPopularRepos();

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });

    it('should return empty array when API returns no items property', async () => {
      const mockResponse = {
        total_count: 0,
      };

      httpsStub.setMockResponseData(JSON.stringify(mockResponse));

      const result = await popularLabs.fetchPopularRepos();

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });

    it('should reject on network error', async () => {
      const networkError = new Error('Network error');
      httpsStub.setMockError(networkError);

      try {
        await popularLabs.fetchPopularRepos();
        expect.fail(ERROR_MESSAGE);
      } catch (err) {
        expect(err).to.equal(networkError);
      }
    });

    it('should reject on invalid JSON response', async () => {
      httpsStub.setMockResponseData('invalid json {{{');

      try {
        await popularLabs.fetchPopularRepos();
        expect.fail(ERROR_MESSAGE);
      } catch (err) {
        expect(err).to.exist;
      }
    });

    it('should reject on empty response with malformed JSON', async () => {
      httpsStub.setMockResponseData('');

      try {
        await popularLabs.fetchPopularRepos();
        expect.fail(ERROR_MESSAGE);
      } catch (err) {
        expect(err).to.exist;
      }
    });

    it('should handle response with many repositories', async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        name: `repo-${i}`,
        html_url: `${SRL_LABS_ORG}/repo-${i}`,
        description: `Repository ${i}`,
        stargazers_count: i * 10,
      }));

      const mockResponse = { items };
      httpsStub.setMockResponseData(JSON.stringify(mockResponse));

      const result = await popularLabs.fetchPopularRepos();

      expect(result).to.have.lengthOf(50);
      expect(result[0].name).to.equal('repo-0');
      expect(result[49].name).to.equal('repo-49');
    });
  });

  describe('pickPopularRepo', () => {
    const SRL_LABS_ORG = 'https://github.com/srl-labs';
    const TEST_TITLE = 'Title';
    const TEST_PLACEHOLDER = 'Placeholder';

    it('should fetch repos and show quick pick with correct items', async () => {
      const mockRepos = [
        {
          name: 'test-lab',
          html_url: `${SRL_LABS_ORG}/test-lab`,
          description: 'A test lab',
          stargazers_count: 42,
        },
      ];

      httpsStub.setMockResponseData(JSON.stringify({ items: mockRepos }));

      const expectedItem = {
        label: 'test-lab',
        description: 'A test lab',
        detail: '⭐ 42',
        repo: `${SRL_LABS_ORG}/test-lab`,
      };

      vscodeStub.window.quickPickResult = expectedItem;

      const result = await popularLabs.pickPopularRepo('Select a lab', 'Choose from popular labs');

      expect(result).to.deep.equal(expectedItem);
    });

    it('should pass correct title and placeHolder to showQuickPick', async () => {
      const mockRepos = [
        {
          name: 'lab1',
          html_url: `${SRL_LABS_ORG}/lab1`,
          description: 'Lab 1',
          stargazers_count: 10,
        },
      ];

      httpsStub.setMockResponseData(JSON.stringify({ items: mockRepos }));

      const showQuickPickSpy = sinon.spy(vscodeStub.window, 'showQuickPick');

      await popularLabs.pickPopularRepo(TEST_TITLE, TEST_PLACEHOLDER);

      expect(showQuickPickSpy.calledOnce).to.be.true;
      const args = showQuickPickSpy.firstCall.args;
      expect(args[1]).to.deep.equal({
        title: TEST_TITLE,
        placeHolder: TEST_PLACEHOLDER,
      });

      showQuickPickSpy.restore();
    });

    it('should map multiple repos to quick pick items correctly', async () => {
      const mockRepos = [
        {
          name: 'lab-a',
          html_url: `${SRL_LABS_ORG}/lab-a`,
          description: 'Description A',
          stargazers_count: 100,
        },
        {
          name: 'lab-b',
          html_url: `${SRL_LABS_ORG}/lab-b`,
          description: 'Description B',
          stargazers_count: 200,
        },
        {
          name: 'lab-c',
          html_url: `${SRL_LABS_ORG}/lab-c`,
          description: 'Description C',
          stargazers_count: 300,
        },
      ];

      httpsStub.setMockResponseData(JSON.stringify({ items: mockRepos }));

      const showQuickPickSpy = sinon.spy(vscodeStub.window, 'showQuickPick');

      await popularLabs.pickPopularRepo(TEST_TITLE, TEST_PLACEHOLDER);

      const items = showQuickPickSpy.firstCall.args[0];
      expect(items).to.have.lengthOf(3);

      expect(items[0]).to.deep.equal({
        label: 'lab-a',
        description: 'Description A',
        detail: '⭐ 100',
        repo: `${SRL_LABS_ORG}/lab-a`,
      });

      expect(items[1]).to.deep.equal({
        label: 'lab-b',
        description: 'Description B',
        detail: '⭐ 200',
        repo: `${SRL_LABS_ORG}/lab-b`,
      });

      expect(items[2]).to.deep.equal({
        label: 'lab-c',
        description: 'Description C',
        detail: '⭐ 300',
        repo: `${SRL_LABS_ORG}/lab-c`,
      });

      showQuickPickSpy.restore();
    });

    it('should return undefined when user cancels quick pick', async () => {
      const mockRepos = [
        {
          name: 'lab',
          html_url: `${SRL_LABS_ORG}/lab`,
          description: 'Lab',
          stargazers_count: 10,
        },
      ];

      httpsStub.setMockResponseData(JSON.stringify({ items: mockRepos }));
      vscodeStub.window.quickPickResult = undefined;

      const result = await popularLabs.pickPopularRepo(TEST_TITLE, TEST_PLACEHOLDER);

      expect(result).to.be.undefined;
    });

    it('should use fallback repos when fetch fails', async () => {
      httpsStub.setMockError(new Error('Network error'));

      const showQuickPickSpy = sinon.spy(vscodeStub.window, 'showQuickPick');

      await popularLabs.pickPopularRepo(TEST_TITLE, TEST_PLACEHOLDER);

      const items = showQuickPickSpy.firstCall.args[0];
      expect(items).to.have.lengthOf(5);
      expect(items[0].label).to.equal('srl-telemetry-lab');

      showQuickPickSpy.restore();
    });

    it('should handle repo with zero stars', async () => {
      const mockRepos = [
        {
          name: 'new-lab',
          html_url: `${SRL_LABS_ORG}/new-lab`,
          description: 'Brand new lab',
          stargazers_count: 0,
        },
      ];

      httpsStub.setMockResponseData(JSON.stringify({ items: mockRepos }));

      const showQuickPickSpy = sinon.spy(vscodeStub.window, 'showQuickPick');

      await popularLabs.pickPopularRepo(TEST_TITLE, TEST_PLACEHOLDER);

      const items = showQuickPickSpy.firstCall.args[0];
      expect(items[0].detail).to.equal('⭐ 0');

      showQuickPickSpy.restore();
    });

    it('should handle repo with large star count', async () => {
      const mockRepos = [
        {
          name: 'popular-lab',
          html_url: `${SRL_LABS_ORG}/popular-lab`,
          description: 'Very popular lab',
          stargazers_count: 9999,
        },
      ];

      httpsStub.setMockResponseData(JSON.stringify({ items: mockRepos }));

      const showQuickPickSpy = sinon.spy(vscodeStub.window, 'showQuickPick');

      await popularLabs.pickPopularRepo(TEST_TITLE, TEST_PLACEHOLDER);

      const items = showQuickPickSpy.firstCall.args[0];
      expect(items[0].detail).to.equal('⭐ 9999');

      showQuickPickSpy.restore();
    });

    it('should handle empty description', async () => {
      const mockRepos = [
        {
          name: 'no-desc-lab',
          html_url: `${SRL_LABS_ORG}/no-desc-lab`,
          description: '',
          stargazers_count: 5,
        },
      ];

      httpsStub.setMockResponseData(JSON.stringify({ items: mockRepos }));

      const showQuickPickSpy = sinon.spy(vscodeStub.window, 'showQuickPick');

      await popularLabs.pickPopularRepo(TEST_TITLE, TEST_PLACEHOLDER);

      const items = showQuickPickSpy.firstCall.args[0];
      expect(items[0].description).to.equal('');

      showQuickPickSpy.restore();
    });
  });

  describe('integration scenarios', () => {
    const SRL_LABS_ORG = 'https://github.com/srl-labs';

    it('should handle complete workflow from fetch to selection', async () => {
      const mockRepos = [
        {
          name: 'selected-lab',
          html_url: `${SRL_LABS_ORG}/selected-lab`,
          description: 'The chosen lab',
          stargazers_count: 150,
        },
        {
          name: 'other-lab',
          html_url: `${SRL_LABS_ORG}/other-lab`,
          description: 'Another lab',
          stargazers_count: 75,
        },
      ];

      httpsStub.setMockResponseData(JSON.stringify({ items: mockRepos }));

      const selectedItem = {
        label: 'selected-lab',
        description: 'The chosen lab',
        detail: '⭐ 150',
        repo: `${SRL_LABS_ORG}/selected-lab`,
      };

      vscodeStub.window.quickPickResult = selectedItem;

      const result = await popularLabs.pickPopularRepo(
        'Choose a containerlab topology',
        'Select from popular labs'
      );

      expect(result).to.deep.equal(selectedItem);
      expect(result.repo).to.equal(`${SRL_LABS_ORG}/selected-lab`);
    });

    it('should gracefully handle fetch failure and still show options', async () => {
      httpsStub.setMockError(new Error('API rate limit exceeded'));

      const showQuickPickSpy = sinon.spy(vscodeStub.window, 'showQuickPick');

      const selectedItem = {
        label: 'srl-telemetry-lab',
        description: 'A lab demonstrating the telemetry stack with SR Linux.',
        detail: '⭐ 85',
        repo: 'https://github.com/srl-labs/srl-telemetry-lab',
      };

      vscodeStub.window.quickPickResult = selectedItem;

      const result = await popularLabs.pickPopularRepo('Test Title', 'Test Placeholder');

      expect(showQuickPickSpy.called).to.be.true;
      expect(result).to.deep.equal(selectedItem);

      showQuickPickSpy.restore();
    });
  });
});
