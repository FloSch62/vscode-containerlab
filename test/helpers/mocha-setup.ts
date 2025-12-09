/**
 * Mocha setup file to initialize globals before any test files are loaded.
 * This must run before any test imports to ensure window is available.
 */

// Set up window globally before any modules are imported
// This is needed because some modules like LayoutManager access window at class init time
(globalThis as any).window = globalThis;

// Also set up isVscodeDeployment to prevent undefined access
(globalThis as any).isVscodeDeployment = false;
