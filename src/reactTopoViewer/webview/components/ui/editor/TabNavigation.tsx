/**
 * TabNavigation - MUI scrollable tabs.
 */
import React from "react";
import { Box, Tab, Tabs } from "@mui/material";

export interface TabDefinition {
  id: string;
  label: string;
  hidden?: boolean;
}

interface TabNavigationProps {
  tabs: TabDefinition[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  showArrows?: boolean;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange,
  showArrows = true
}) => {
  const visibleTabs = tabs.filter((t) => !t.hidden);

  return (
    <Box sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
      <Tabs
        value={activeTab}
        onChange={(_, value) => onTabChange(value)}
        variant="scrollable"
        scrollButtons={showArrows ? "auto" : false}
        allowScrollButtonsMobile
      >
        {visibleTabs.map((tab) => (
          <Tab
            key={tab.id}
            value={tab.id}
            label={tab.label}
            data-testid={`panel-tab-${tab.id}`}
          />
        ))}
      </Tabs>
    </Box>
  );
};
