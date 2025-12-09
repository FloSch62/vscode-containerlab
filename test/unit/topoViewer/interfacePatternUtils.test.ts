/* eslint-env mocha */
/* global describe, it, beforeEach */
import { expect } from 'chai';
import {
  DEFAULT_INTERFACE_PATTERN,
  parseInterfacePattern,
  generateInterfaceName,
  getInterfaceIndex,
  type ParsedInterfacePattern
} from '../../../src/topoViewer/webview/ui/InterfacePatternUtils';

// Constants for commonly used test values
const PATTERN_ETH_N = 'eth{n}';
const PATTERN_GE_N = 'ge-0/0/{n}';
const PATTERN_RANGED = 'eth{n:0-3}';
const PATTERN_START_5 = 'eth{n:5}';
const PATTERN_MULTI = 'e1-{n:1-4},eth{n}';
const PATTERN_MULTI_RANGED = 'e{n:1-2},ge{n:1-3}';
const IFACE_ETH0 = 'eth0';
const IFACE_ETH1 = 'eth1';
const IFACE_ETH2 = 'eth2';
const IFACE_ETH3 = 'eth3';
const IFACE_ETH4 = 'eth4';
const IFACE_ETH5 = 'eth5';
const IFACE_ETH10 = 'eth10';
const IFACE_E1 = 'e1';
const IFACE_E2 = 'e2';
const IFACE_E11 = 'e1-1';
const IFACE_E12 = 'e1-2';
const IFACE_E14 = 'e1-4';
const IFACE_E15 = 'e1-5';
const IFACE_GE000 = 'ge-0/0/0';
const IFACE_GE001 = 'ge-0/0/1';

/**
 * Tests for InterfacePatternUtils - DEFAULT_INTERFACE_PATTERN constant
 */
describe('InterfacePatternUtils - DEFAULT_INTERFACE_PATTERN', () => {
  it('should export default pattern', () => {
    expect(DEFAULT_INTERFACE_PATTERN).to.equal(PATTERN_ETH_N);
  });
});

/**
 * Tests for InterfacePatternUtils - parseInterfacePattern basic cases
 */
describe('InterfacePatternUtils - parseInterfacePattern basic', () => {
  it('should parse simple pattern with {n} placeholder', () => {
    const result = parseInterfacePattern(PATTERN_ETH_N);
    expect(result.original).to.equal(PATTERN_ETH_N);
    expect(result.segments).to.have.lengthOf(1);
    expect(result.segments[0].prefix).to.equal('eth');
    expect(result.segments[0].suffix).to.equal('');
    expect(result.segments[0].start).to.equal(1);
    expect(result.segments[0].end).to.be.undefined;
    expect(result.segments[0].length).to.be.undefined;
  });

  it('should parse pattern with prefix and suffix', () => {
    const result = parseInterfacePattern(PATTERN_GE_N);
    expect(result.segments[0].prefix).to.equal('ge-0/0/');
    expect(result.segments[0].suffix).to.equal('');
    expect(result.segments[0].start).to.equal(1);
  });

  it('should use default pattern for null', () => {
    const result = parseInterfacePattern(null);
    expect(result.original).to.equal(DEFAULT_INTERFACE_PATTERN);
    expect(result.segments).to.have.lengthOf(1);
  });

  it('should use default pattern for undefined', () => {
    // Call without argument to test undefined behavior
    const result = parseInterfacePattern();
    expect(result.original).to.equal(DEFAULT_INTERFACE_PATTERN);
  });

  it('should use default pattern for empty string', () => {
    const result = parseInterfacePattern('');
    expect(result.original).to.equal(DEFAULT_INTERFACE_PATTERN);
  });

  it('should use default pattern for whitespace only', () => {
    const result = parseInterfacePattern('   ');
    expect(result.original).to.equal(DEFAULT_INTERFACE_PATTERN);
  });

  it('should use default pattern for invalid pattern without placeholder', () => {
    const result = parseInterfacePattern('invalid');
    expect(result.original).to.equal(DEFAULT_INTERFACE_PATTERN);
    expect(result.segments).to.have.lengthOf(1);
  });
});

/**
 * Tests for InterfacePatternUtils - parseInterfacePattern with ranges
 */
describe('InterfacePatternUtils - parseInterfacePattern ranges', () => {
  it('should parse pattern with start range only', () => {
    const result = parseInterfacePattern(PATTERN_START_5);
    expect(result.segments[0].start).to.equal(5);
    expect(result.segments[0].end).to.be.undefined;
    expect(result.segments[0].length).to.be.undefined;
  });

  it('should parse pattern with start-end range', () => {
    const result = parseInterfacePattern(PATTERN_RANGED);
    expect(result.segments[0].start).to.equal(0);
    expect(result.segments[0].end).to.equal(3);
    expect(result.segments[0].length).to.equal(4);
  });

  it('should normalize invalid range (end < start)', () => {
    const result = parseInterfacePattern('eth{n:5-3}');
    expect(result.segments[0].start).to.equal(5);
    expect(result.segments[0].end).to.equal(5);
    expect(result.segments[0].length).to.equal(1);
  });

  it('should parse pattern with zero start', () => {
    const result = parseInterfacePattern('eth{n:0}');
    expect(result.segments[0].start).to.equal(0);
    expect(result.segments[0].end).to.be.undefined;
  });

  it('should handle range with same start and end', () => {
    const result = parseInterfacePattern('eth{n:2-2}');
    expect(result.segments[0].start).to.equal(2);
    expect(result.segments[0].end).to.equal(2);
    expect(result.segments[0].length).to.equal(1);
  });
});

/**
 * Tests for InterfacePatternUtils - parseInterfacePattern multi-segment
 */
describe('InterfacePatternUtils - parseInterfacePattern multi-segment', () => {
  it('should parse comma-separated patterns', () => {
    const result = parseInterfacePattern(PATTERN_MULTI);
    expect(result.segments).to.have.lengthOf(2);
    expect(result.segments[0].prefix).to.equal('e1-');
    expect(result.segments[0].start).to.equal(1);
    expect(result.segments[0].end).to.equal(4);
    expect(result.segments[0].length).to.equal(4);
    expect(result.segments[1].prefix).to.equal('eth');
    expect(result.segments[1].start).to.equal(1);
    expect(result.segments[1].end).to.be.undefined;
  });

  it('should parse multiple ranged segments', () => {
    const result = parseInterfacePattern(PATTERN_MULTI_RANGED);
    expect(result.segments).to.have.lengthOf(2);
    expect(result.segments[0].length).to.equal(2);
    expect(result.segments[1].length).to.equal(3);
  });

  it('should skip empty segments in comma-separated list', () => {
    const result = parseInterfacePattern('eth{n},,e{n}');
    expect(result.segments).to.have.lengthOf(2);
  });

  it('should skip invalid segments', () => {
    const result = parseInterfacePattern('eth{n},invalid,e{n}');
    expect(result.segments).to.have.lengthOf(2);
  });
});

/**
 * Tests for InterfacePatternUtils - parseInterfacePattern regex generation
 */
describe('InterfacePatternUtils - parseInterfacePattern regex', () => {
  it('should create regex that matches generated names', () => {
    const parsed = parseInterfacePattern(PATTERN_ETH_N);
    expect(parsed.segments[0].regex.test(IFACE_ETH0)).to.be.true;
    expect(parsed.segments[0].regex.test(IFACE_ETH10)).to.be.true;
  });

  it('should create regex that does not match invalid names', () => {
    const parsed = parseInterfacePattern(PATTERN_ETH_N);
    expect(parsed.segments[0].regex.test('ens0')).to.be.false;
    expect(parsed.segments[0].regex.test('eth')).to.be.false;
  });

  it('should escape special regex characters in prefix', () => {
    const parsed = parseInterfacePattern(PATTERN_GE_N);
    expect(parsed.segments[0].regex.test(IFACE_GE000)).to.be.true;
    expect(parsed.segments[0].regex.test(IFACE_GE001)).to.be.true;
  });
});

/**
 * Tests for InterfacePatternUtils - generateInterfaceName basic
 */
describe('InterfacePatternUtils - generateInterfaceName basic', () => {
  let parsed: ParsedInterfacePattern;

  beforeEach(() => {
    parsed = parseInterfacePattern(PATTERN_ETH_N);
  });

  it('should generate first interface name', () => {
    const name = generateInterfaceName(parsed, 0);
    expect(name).to.equal(IFACE_ETH1);
  });

  it('should generate sequential interface names', () => {
    expect(generateInterfaceName(parsed, 0)).to.equal(IFACE_ETH1);
    expect(generateInterfaceName(parsed, 1)).to.equal(IFACE_ETH2);
    expect(generateInterfaceName(parsed, 2)).to.equal(IFACE_ETH3);
  });

  it('should handle negative index by using 0', () => {
    const name = generateInterfaceName(parsed, -1);
    expect(name).to.equal(IFACE_ETH1);
  });

  it('should handle large index values', () => {
    const name = generateInterfaceName(parsed, 99);
    expect(name).to.equal('eth100');
  });
});

/**
 * Tests for InterfacePatternUtils - generateInterfaceName with start range
 */
describe('InterfacePatternUtils - generateInterfaceName start range', () => {
  it('should start from specified start value', () => {
    const parsed = parseInterfacePattern(PATTERN_START_5);
    expect(generateInterfaceName(parsed, 0)).to.equal(IFACE_ETH5);
    expect(generateInterfaceName(parsed, 1)).to.equal('eth6');
    expect(generateInterfaceName(parsed, 5)).to.equal(IFACE_ETH10);
  });

  it('should handle zero start value', () => {
    const parsed = parseInterfacePattern('eth{n:0}');
    expect(generateInterfaceName(parsed, 0)).to.equal(IFACE_ETH0);
    expect(generateInterfaceName(parsed, 1)).to.equal(IFACE_ETH1);
  });
});

/**
 * Tests for InterfacePatternUtils - generateInterfaceName with ranged segments
 */
describe('InterfacePatternUtils - generateInterfaceName ranged', () => {
  let parsed: ParsedInterfacePattern;

  beforeEach(() => {
    parsed = parseInterfacePattern(PATTERN_RANGED);
  });

  it('should generate within range', () => {
    expect(generateInterfaceName(parsed, 0)).to.equal(IFACE_ETH0);
    expect(generateInterfaceName(parsed, 1)).to.equal(IFACE_ETH1);
    expect(generateInterfaceName(parsed, 3)).to.equal(IFACE_ETH3);
  });

  it('should continue beyond range', () => {
    expect(generateInterfaceName(parsed, 4)).to.equal(IFACE_ETH4);
    expect(generateInterfaceName(parsed, 5)).to.equal(IFACE_ETH5);
  });
});

/**
 * Tests for InterfacePatternUtils - generateInterfaceName multi-segment
 */
describe('InterfacePatternUtils - generateInterfaceName multi-segment', () => {
  let parsed: ParsedInterfacePattern;

  beforeEach(() => {
    parsed = parseInterfacePattern(PATTERN_MULTI);
  });

  it('should use first segment for indices in range', () => {
    expect(generateInterfaceName(parsed, 0)).to.equal(IFACE_E11);
    expect(generateInterfaceName(parsed, 1)).to.equal(IFACE_E12);
    expect(generateInterfaceName(parsed, 3)).to.equal(IFACE_E14);
  });

  it('should fall back to second segment after first range exhausted', () => {
    expect(generateInterfaceName(parsed, 4)).to.equal(IFACE_ETH1);
    expect(generateInterfaceName(parsed, 5)).to.equal(IFACE_ETH2);
  });

  it('should continue indefinitely with last segment', () => {
    expect(generateInterfaceName(parsed, 14)).to.equal('eth11');
    expect(generateInterfaceName(parsed, 104)).to.equal('eth101');
  });
});

/**
 * Tests for InterfacePatternUtils - generateInterfaceName edge cases
 */
describe('InterfacePatternUtils - generateInterfaceName edge cases', () => {
  it('should handle empty segments by using default', () => {
    const parsed: ParsedInterfacePattern = { original: '', segments: [] };
    const name = generateInterfaceName(parsed, 0);
    expect(name).to.equal(IFACE_ETH1);
  });

  it('should handle complex prefix patterns', () => {
    const parsed = parseInterfacePattern('Ethernet{n:1-48}');
    expect(generateInterfaceName(parsed, 0)).to.equal('Ethernet1');
    expect(generateInterfaceName(parsed, 47)).to.equal('Ethernet48');
    expect(generateInterfaceName(parsed, 48)).to.equal('Ethernet49');
  });

  it('should handle pattern with suffix', () => {
    const parsed = parseInterfacePattern('port{n}/0');
    expect(generateInterfaceName(parsed, 0)).to.equal('port1/0');
    expect(generateInterfaceName(parsed, 9)).to.equal('port10/0');
  });
});

/**
 * Tests for InterfacePatternUtils - getInterfaceIndex basic
 */
describe('InterfacePatternUtils - getInterfaceIndex basic', () => {
  let parsed: ParsedInterfacePattern;

  beforeEach(() => {
    parsed = parseInterfacePattern(PATTERN_ETH_N);
  });

  it('should return index for matching interface', () => {
    expect(getInterfaceIndex(parsed, IFACE_ETH1)).to.equal(0);
    expect(getInterfaceIndex(parsed, IFACE_ETH2)).to.equal(1);
    expect(getInterfaceIndex(parsed, IFACE_ETH10)).to.equal(9);
  });

  it('should return null for non-matching interface', () => {
    expect(getInterfaceIndex(parsed, 'ens0')).to.be.null;
    expect(getInterfaceIndex(parsed, 'eth')).to.be.null;
    expect(getInterfaceIndex(parsed, '')).to.be.null;
  });

  it('should return null for interface with value below start', () => {
    expect(getInterfaceIndex(parsed, IFACE_ETH0)).to.be.null;
  });
});

/**
 * Tests for InterfacePatternUtils - getInterfaceIndex with start range
 */
describe('InterfacePatternUtils - getInterfaceIndex start range', () => {
  it('should calculate index relative to start', () => {
    const parsed = parseInterfacePattern(PATTERN_START_5);
    expect(getInterfaceIndex(parsed, IFACE_ETH5)).to.equal(0);
    expect(getInterfaceIndex(parsed, 'eth6')).to.equal(1);
    expect(getInterfaceIndex(parsed, IFACE_ETH10)).to.equal(5);
  });

  it('should return null for values below start', () => {
    const parsed = parseInterfacePattern(PATTERN_START_5);
    expect(getInterfaceIndex(parsed, IFACE_ETH0)).to.be.null;
    expect(getInterfaceIndex(parsed, IFACE_ETH4)).to.be.null;
  });

  it('should handle zero start', () => {
    const parsed = parseInterfacePattern('eth{n:0}');
    expect(getInterfaceIndex(parsed, IFACE_ETH0)).to.equal(0);
    expect(getInterfaceIndex(parsed, IFACE_ETH1)).to.equal(1);
  });
});

/**
 * Tests for InterfacePatternUtils - getInterfaceIndex with ranges
 */
describe('InterfacePatternUtils - getInterfaceIndex ranges', () => {
  let parsed: ParsedInterfacePattern;

  beforeEach(() => {
    parsed = parseInterfacePattern(PATTERN_RANGED);
  });

  it('should return index for values within range', () => {
    expect(getInterfaceIndex(parsed, IFACE_ETH0)).to.equal(0);
    expect(getInterfaceIndex(parsed, IFACE_ETH1)).to.equal(1);
    expect(getInterfaceIndex(parsed, IFACE_ETH3)).to.equal(3);
  });

  it('should return index for values beyond range in last segment', () => {
    expect(getInterfaceIndex(parsed, IFACE_ETH4)).to.equal(4);
    expect(getInterfaceIndex(parsed, IFACE_ETH10)).to.equal(10);
  });
});

/**
 * Tests for InterfacePatternUtils - getInterfaceIndex multi-segment
 */
describe('InterfacePatternUtils - getInterfaceIndex multi-segment', () => {
  let parsed: ParsedInterfacePattern;

  beforeEach(() => {
    parsed = parseInterfacePattern(PATTERN_MULTI);
  });

  it('should find index in first segment', () => {
    expect(getInterfaceIndex(parsed, IFACE_E11)).to.equal(0);
    expect(getInterfaceIndex(parsed, IFACE_E12)).to.equal(1);
    expect(getInterfaceIndex(parsed, IFACE_E14)).to.equal(3);
  });

  it('should find index in second segment with offset', () => {
    expect(getInterfaceIndex(parsed, IFACE_ETH1)).to.equal(4);
    expect(getInterfaceIndex(parsed, IFACE_ETH2)).to.equal(5);
    expect(getInterfaceIndex(parsed, IFACE_ETH10)).to.equal(13);
  });

  it('should return null for values beyond first segment range but matching pattern', () => {
    expect(getInterfaceIndex(parsed, IFACE_E15)).to.be.null;
  });

  it('should return null for non-matching patterns', () => {
    expect(getInterfaceIndex(parsed, 'ge0')).to.be.null;
    expect(getInterfaceIndex(parsed, 'e2-1')).to.be.null;
  });
});

/**
 * Tests for InterfacePatternUtils - getInterfaceIndex edge cases
 */
describe('InterfacePatternUtils - getInterfaceIndex edge cases', () => {
  it('should return null for segment with undefined length blocking further search', () => {
    const parsed = parseInterfacePattern('e{n},eth{n}');
    expect(getInterfaceIndex(parsed, IFACE_E1)).to.equal(0);
    expect(getInterfaceIndex(parsed, IFACE_E2)).to.equal(1);
    expect(getInterfaceIndex(parsed, IFACE_ETH1)).to.be.null;
  });

  it('should handle complex patterns', () => {
    const parsed = parseInterfacePattern(PATTERN_GE_N);
    expect(getInterfaceIndex(parsed, IFACE_GE000)).to.be.null;
    expect(getInterfaceIndex(parsed, IFACE_GE001)).to.equal(0);
    expect(getInterfaceIndex(parsed, 'ge-0/0/5')).to.equal(4);
  });

  it('should handle pattern with suffix', () => {
    const parsed = parseInterfacePattern('port{n}/0');
    expect(getInterfaceIndex(parsed, 'port1/0')).to.equal(0);
    expect(getInterfaceIndex(parsed, 'port10/0')).to.equal(9);
    expect(getInterfaceIndex(parsed, 'port1/1')).to.be.null;
  });
});

/**
 * Tests for InterfacePatternUtils - round-trip consistency
 */
describe('InterfacePatternUtils - round-trip', () => {
  it('should consistently generate and parse back simple patterns', () => {
    const parsed = parseInterfacePattern(PATTERN_ETH_N);
    for (let i = 0; i < 20; i++) {
      const name = generateInterfaceName(parsed, i);
      const index = getInterfaceIndex(parsed, name);
      expect(index).to.equal(i);
    }
  });

  it('should consistently generate and parse back ranged patterns', () => {
    const parsed = parseInterfacePattern(PATTERN_RANGED);
    for (let i = 0; i < 10; i++) {
      const name = generateInterfaceName(parsed, i);
      const index = getInterfaceIndex(parsed, name);
      expect(index).to.equal(i);
    }
  });

  it('should consistently generate and parse back multi-segment patterns', () => {
    const parsed = parseInterfacePattern(PATTERN_MULTI);
    for (let i = 0; i < 20; i++) {
      const name = generateInterfaceName(parsed, i);
      const index = getInterfaceIndex(parsed, name);
      expect(index).to.equal(i);
    }
  });
});
