/* eslint-env mocha */
/* global describe, it */

import { expect } from 'chai';

import { extractLineRateValue } from '../../../src/topoViewer/utilities/linkRateUtils';

describe('extractLineRateValue', () => {
  it('returns direct string values', () => {
    const value = extractLineRateValue({ lineRate: '100 Mbps' });
    expect(value).to.equal('100 Mbps');
  });

  it('combines structured value and unit fields', () => {
    const value = extractLineRateValue({ lineRate: { value: 10, unit: 'Gbps' } });
    expect(value).to.equal('10 Gbps');
  });

  it('falls back to numeric values when no unit is provided', () => {
    const value = extractLineRateValue({ line_rate: { value: 500 } });
    expect(value).to.equal(500);
  });

  it('discovers nested values across objects', () => {
    const value = extractLineRateValue({ nested: { stats: { 'line-rate': '42 Mbps' } } });
    expect(value).to.equal('42 Mbps');
  });

  it('detects interface stats with bps metrics', () => {
    const value = extractLineRateValue({
      extraData: {
        clabSourceStats: { rxBps: 125_000_000, rxPackets: 10, statsIntervalSeconds: 5 },
        clabTargetStats: { txBps: 62_500_000 },
      },
    });
    expect(value).to.equal(125_000_000);
  });
});
