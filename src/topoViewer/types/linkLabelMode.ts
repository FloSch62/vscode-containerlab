export type LinkLabelMode = 'on-select' | 'show-all' | 'hide' | 'show-rate';

export function normalizeLinkLabelMode(value: string): LinkLabelMode {
  const normalized = (value || '').toLowerCase();
  const directModes = new Set<LinkLabelMode>(['show-all', 'hide', 'on-select', 'show-rate']);
  if (directModes.has(normalized as LinkLabelMode)) {
    return normalized as LinkLabelMode;
  }

  const showAllSynonyms = ['show', 'show-labels', 'show_labels', 'showlabels', 'show labels'];
  if (showAllSynonyms.includes(normalized)) {
    return 'show-all';
  }

  const hideSynonyms = ['none', 'no-labels', 'no_labels', 'nolabels', 'no labels'];
  if (hideSynonyms.includes(normalized)) {
    return 'hide';
  }

  const rateSynonyms = [
    'show-rate',
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
    return 'show-rate';
  }

  return 'on-select';
}

export function linkLabelModeLabel(mode: LinkLabelMode): string {
  switch (mode) {
    case 'show-all':
      return 'Show Labels';
    case 'show-rate':
      return 'Show Link Rates';
    case 'hide':
      return 'No Labels';
    case 'on-select':
    default:
      return 'Show Link Labels on Select';
  }
}
