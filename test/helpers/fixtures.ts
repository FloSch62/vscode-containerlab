/* eslint-disable no-undef */
import * as path from 'path';
import * as fs from 'fs';
import type { ClabDetailedJSON } from '../../src/treeView/common';
import type { ClabInterfaceSnapshot } from '../../src/types/containerlab';

/**
 * Handle both source and compiled paths for fixtures.
 * When running compiled tests from out/test/test/helpers/,
 * fixtures are at test/fixtures/ (source tree).
 */
function getFixturePath(relativePath: string): string {
  // When running compiled tests from out/test/test/helpers/
  // fixtures are at test/fixtures/ (source tree)
  const sourceFixtures = path.resolve(__dirname, '..', '..', '..', '..', 'test', 'fixtures', relativePath);
  if (fs.existsSync(sourceFixtures)) {
    return sourceFixtures;
  }
  // Fallback for other structures
  return path.resolve(__dirname, '..', 'fixtures', relativePath);
}

/**
 * Load an inspect fixture (containerlab inspect --details output format).
 * Returns a Record mapping lab names to arrays of ClabDetailedJSON.
 */
export function loadInspectFixture(name: string): Record<string, ClabDetailedJSON[]> {
  const fixturePath = getFixturePath(`inspect/${name}.json`);
  return JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
}

/**
 * Load an interface fixture (interface snapshot format).
 * Returns a Record mapping container short IDs to ClabInterfaceSnapshot.
 */
export function loadInterfaceFixture(name: string): Record<string, ClabInterfaceSnapshot> {
  const fixturePath = getFixturePath(`interfaces/${name}.json`);
  return JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
}

/**
 * Load a raw topology fixture (.clab.yml content).
 */
export function loadTopologyFixture(name: string): string {
  const fixturePath = getFixturePath(`topologies/${name}`);
  return fs.readFileSync(fixturePath, 'utf-8');
}

/**
 * Get the absolute path to a fixture file.
 */
export function getFixtureAbsPath(relativePath: string): string {
  return getFixturePath(relativePath);
}
