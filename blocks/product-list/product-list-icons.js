// Minimal inline icon set for the product list. Kept local to this block since
// icons are matched to benefit copy heuristically and aren't reused elsewhere.
const ICON_INNER = {
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  tag: '<path d="M12 2 21 11 11 21 2 12Z"/>',
  percent: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  plane: '<polygon points="2,12 22,4 14,12 22,20"/>',
  utensils: '<path d="M6 2v7a2 2 0 0 0 4 0V2"/><path d="M8 9v13"/><path d="M17 2c-2 2-2 5-2 8s0 4 2 4v9"/>',
  document: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="17" x2="12" y2="17"/>',
  card: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  dot: '<circle cx="12" cy="12" r="5"/>',
  chevron: '<polyline points="9 18 15 12 9 6"/>',
};

const KEYWORD_ICONS = [
  [/cash ?back/i, 'tag'],
  [/apr/i, 'percent'],
  [/fee/i, 'dollar'],
  [/airline|flight|board|travel/i, 'plane'],
  [/restaurant|dining|gas station/i, 'utensils'],
  [/club|membership|lounge|admiral/i, 'document'],
  [/mile|point|bonus/i, 'target'],
  [/hotel/i, 'card'],
];

export function iconForBenefit(text) {
  const match = KEYWORD_ICONS.find(([pattern]) => pattern.test(text));
  return match ? match[1] : 'dot';
}

export function createIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = ICON_INNER[name] || ICON_INNER.dot;
  return svg;
}
