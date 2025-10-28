const MODE_ON_SELECT = 'on-select' as const;
const MODE_SHOW_ALL = 'show-all' as const;
const MODE_HIDE = 'hide' as const;
const MODE_SHOW_RATE = 'show-rate' as const;
const MODE_SHOW_ALL_RATE = 'show-all-rate' as const;

export type LinkLabelMode =
  | typeof MODE_ON_SELECT
  | typeof MODE_SHOW_ALL
  | typeof MODE_HIDE
  | typeof MODE_SHOW_RATE
  | typeof MODE_SHOW_ALL_RATE;

export function normalizeLinkLabelMode(value: string): LinkLabelMode {
  const normalized = (value || '').toLowerCase();
  const directModes = new Set<LinkLabelMode>([
    MODE_SHOW_ALL,
    MODE_HIDE,
    MODE_ON_SELECT,
    MODE_SHOW_RATE,
    MODE_SHOW_ALL_RATE,
  ]);
  if (directModes.has(normalized as LinkLabelMode)) {
    return normalized as LinkLabelMode;
  }

  const showAllSynonyms = ['show', 'show-labels', 'show_labels', 'showlabels', 'show labels'];
  if (showAllSynonyms.includes(normalized)) {
    return MODE_SHOW_ALL;
  }

  const hideSynonyms = ['none', 'no-labels', 'no_labels', 'nolabels', 'no labels'];
  if (hideSynonyms.includes(normalized)) {
    return MODE_HIDE;
  }

  const rateSynonyms = [
    MODE_SHOW_RATE,
    'showrate',
    'showrates',
    'show_rates',
    'show rates',
    'line-rate',
    'line_rate',
    'linerate',
    'rate',
    'rates',
  ];
  if (rateSynonyms.includes(normalized)) {
    return MODE_SHOW_RATE;
  }

  const showAllRateSynonyms = [
    'showlabelsandrate',
    'showlabelsandrates',
    'show-labels-and-rate',
    'show_labels_and_rate',
    'show labels and rate',
    'show labels and rates',
    'show-all-rates',
    'showallrates',
    'labels-and-rate',
    'labels_and_rate',
    'labels and rate',
    'combined-rate',
    'combinedrates',
  ];
  if (showAllRateSynonyms.includes(normalized)) {
    return MODE_SHOW_ALL_RATE;
  }

  return MODE_ON_SELECT;
}

export function linkLabelModeLabel(mode: LinkLabelMode): string {
  switch (mode) {
    case MODE_SHOW_ALL:
      return 'Show Labels';
    case MODE_SHOW_RATE:
      return 'Show Link Rates';
    case MODE_SHOW_ALL_RATE:
      return 'Show Labels and Rates';
    case MODE_HIDE:
      return 'No Labels';
    case MODE_ON_SELECT:
    default:
      return 'Show Link Labels on Select';
  }
}
