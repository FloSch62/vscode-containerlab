/* eslint-env mocha */
/* global describe, it */
import { expect } from 'chai';
import { TopoViewerAdaptorClab } from '../../../src/topoViewer/core/topoViewerAdaptorClab';

describe('TopoViewerAdaptorClab bridge nodes', () => {
  it('assigns cloud topoViewerRole for bridge kinds', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    const yaml = `
name: test
topology:
  nodes:
    br1:
      kind: bridge
    ovs1:
      kind: ovs-bridge
`;
    const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
    const br = elements.find(el => el.data?.id === 'br1');
    const ovs = elements.find(el => el.data?.id === 'ovs1');
    expect(br?.data?.topoViewerRole).to.equal('cloud');
    expect(ovs?.data?.topoViewerRole).to.equal('cloud');
  });
});

