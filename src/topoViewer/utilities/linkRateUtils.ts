/* eslint-disable sonarjs/function-return-type */

export type LineRateValue = string | number;

const LINE_RATE_KEY_TOKEN = 'linerate';
const DIRECT_KEYS = ['lineRate', 'linerate', 'line-rate', 'line_rate'] as const;
const KEY_VALUE_FIELDS = ['value', 'val', 'data', 'display', 'amount', 'default', 'speed', 'rate'] as const;
const UNIT_FIELDS = ['unit', 'units', 'unitLabel', 'unitName', 'unit_name', 'unit-label', 'uom', 'suffix'] as const;

export function extractLineRateValue(source: unknown): LineRateValue | undefined {
  let result: LineRateValue | undefined;
  if (!source || typeof source !== 'object') {
    result = normalizeCandidate(source);
  } else {
    const record = source as Record<string, unknown>;
    result = extractFromDirectKeys(record);
    if (result === undefined) {
      result = searchLineRate(record, new WeakSet<object>());
    }
  }
  return result;
}

function extractFromDirectKeys(record: Record<string, unknown>): LineRateValue | undefined {
  let result: LineRateValue | undefined;
  for (const key of DIRECT_KEYS) {
    if (key in record) {
      const candidate = normalizeCandidate(record[key]);
      if (candidate !== undefined) {
        result = candidate;
        break;
      }
    }
  }
  return result;
}

function searchLineRate(value: unknown, visited: WeakSet<object>): LineRateValue | undefined {
  let result: LineRateValue | undefined;
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  if (visited.has(value as object)) {
    return undefined;
  }
  visited.add(value as object);

  if (Array.isArray(value)) {
    result = searchArray(value, visited);
  } else {
    result = searchRecord(value as Record<string, unknown>, visited);
  }
  return result;
}

function searchArray(values: unknown[], visited: WeakSet<object>): LineRateValue | undefined {
  let result: LineRateValue | undefined;
  for (const item of values) {
    result = searchLineRate(item, visited);
    if (result !== undefined) {
      break;
    }
  }
  return result;
}

function searchRecord(record: Record<string, unknown>, visited: WeakSet<object>): LineRateValue | undefined {
  let result: LineRateValue | undefined;
  for (const [key, value] of Object.entries(record)) {
    if (isLineRateKey(key)) {
      result = extractFromLineRateValue(value, visited);
      if (result !== undefined) {
        break;
      }
    }

    if (result === undefined) {
      result = extractFromStatsCandidate(value);
    }

    if (result === undefined && typeof value === 'string' && isLineRateKey(value)) {
      result = extractFromKeyValueRecord(record);
    }

    if (result !== undefined) {
      break;
    }

    result = searchLineRate(value, visited);
    if (result !== undefined) {
      break;
    }
  }
  return result;
}

function extractFromLineRateValue(value: unknown, visited: WeakSet<object>): LineRateValue | undefined {
  let result = normalizeCandidate(value);
  if (result !== undefined) {
    return result;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      result = normalizeCandidate(item);
      if (result !== undefined) {
        break;
      }
      result = searchLineRate(item, visited);
      if (result !== undefined) {
        break;
      }
    }
    return result;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const direct = extractFromKeyValueRecord(record);
    const unit = extractUnitCandidate(record);
    if (direct !== undefined) {
      return mergeWithUnit(direct, unit);
    }
    return searchLineRate(record, visited);
  }

  return searchLineRate(value, visited);
}

function extractFromKeyValueRecord(record: Record<string, unknown>): LineRateValue | undefined {
  let result: LineRateValue | undefined;
  for (const key of KEY_VALUE_FIELDS) {
    if (key in record) {
      const candidate = normalizeCandidate(record[key]);
      if (candidate !== undefined) {
        result = candidate;
        break;
      }
    }
  }
  return result;
}

function extractUnitCandidate(record: Record<string, unknown>): unknown {
  for (const key of UNIT_FIELDS) {
    if (key in record) {
      return record[key];
    }
  }
  return undefined;
}

function extractFromStatsCandidate(candidate: unknown): LineRateValue | undefined {
  if (!candidate || typeof candidate !== 'object') {
    return undefined;
  }

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const extracted = extractFromStatsCandidate(item);
      if (extracted !== undefined) {
        return extracted;
      }
    }
    return undefined;
  }

  const record = candidate as Record<string, unknown>;
  const bpsValues: number[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const normalizedKey = normalizeKey(key);
      if (normalizedKey.includes('bps')) {
        bpsValues.push(value);
      }
    }
  }

  if (bpsValues.length > 0) {
    return Math.max(...bpsValues);
  }

  return undefined;
}

function mergeWithUnit(value: LineRateValue, unit: unknown): LineRateValue {
  const normalized = normalizeCandidate(unit);
  const unitText =
    typeof normalized === 'number'
      ? `${normalized}`
      : normalized;

  if (!unitText) {
    return value;
  }

  if (typeof value === 'string') {
    const unitLower = unitText.toLowerCase();
    if (value.toLowerCase().includes(unitLower)) {
      return value;
    }
    return `${value} ${unitText}`.trim();
  }

  return `${value} ${unitText}`.trim();
}

function normalizeCandidate(candidate: unknown): LineRateValue | undefined {
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function isLineRateKey(key: string): boolean {
  return normalizeKey(key).includes(LINE_RATE_KEY_TOKEN);
}

function normalizeKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

/* eslint-enable sonarjs/function-return-type */
