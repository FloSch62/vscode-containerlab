# React TopoViewer Standalone

Standalone web build of the React TopoViewer with in-memory I/O.

## Run (dev)

```bash
npm run standalone
```

## Build

```bash
npm run standalone:build
```

## Notes

- All topology YAML + annotations are stored in memory (no disk writes).
- Monaco split view is always visible on the right (YAML only).
- Use the Export button next to Save All to download YAML + annotations JSON.
- Use Clear Lab to reset the in-memory topology.
- Custom node templates and custom icons are stored in memory for the session.
- Standalone state is saved to `localStorage` so it persists across reloads and tab closes.
