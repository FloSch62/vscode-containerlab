// Main entry point for the unified TopoViewer/Editor
import { topoViewerEngine } from './topoViewerEngine';

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

async function initialize() {
  try {
    // Get the cytoscape container
    const container = document.getElementById('cy');
    if (!container) {
      throw new Error('Cytoscape container element not found');
    }

    // Initialize the topology viewer engine
    await topoViewerEngine.initialize(container);

    console.log('TopoViewer initialized successfully');
  } catch (error) {
    console.error('Failed to initialize TopoViewer:', error);
  }
}