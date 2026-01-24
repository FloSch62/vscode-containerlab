/**
 * EdgeRenderConfigContext - Controls edge label rendering behavior without
 * forcing edges to subscribe to unrelated state updates.
 */
import React, { createContext, useContext } from 'react';

export type EdgeLabelMode = 'show-all' | 'on-select' | 'hide';

interface EdgeRenderConfig {
  labelMode: EdgeLabelMode;
  suppressLabels: boolean;
}

const EdgeRenderConfigContext = createContext<EdgeRenderConfig>({
  labelMode: 'show-all',
  suppressLabels: false
});

export const EdgeRenderConfigProvider: React.FC<{
  value: EdgeRenderConfig;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <EdgeRenderConfigContext.Provider value={value}>
    {children}
  </EdgeRenderConfigContext.Provider>
);

export const useEdgeRenderConfig = (): EdgeRenderConfig => {
  return useContext(EdgeRenderConfigContext);
};
