// eslint-disable-next-line import/no-unresolved
import { toClassName } from '../../scripts/aem.js';

/**
 * Group panel content into two flex columns, matching source
 * benefit-content.bf-flex-container / .bf-flex-item.
 *
 * Two authored shapes show up on retail PDPs:
 *   1. h3.subHeader-text + following free-text <p>s (Support / Macy's)
 *   2. standalone <p><strong>…</strong></p> title lines (Dillard's card tabs)
 * Each group becomes one .tabs-benefit-item; items are split across two columns.
 * @param {Element} tabpanel
 */
function decorateRetailPanel(tabpanel) {
  // Drop empty leftover cells (label cell after its content was moved into the button)
  [...tabpanel.children].forEach((child) => {
    if (!child.textContent.trim() && !child.querySelector('img, picture')) child.remove();
  });

  const wrap = [...tabpanel.children].find((el) => el.querySelector('h3, p'))
    || tabpanel.querySelector(':scope > div')
    || tabpanel;
  const nodes = [...wrap.children];
  if (!nodes.some((n) => n.matches('h3, p'))) return;

  const groups = [];
  nodes.forEach((node) => {
    if (node.matches('h3')) {
      const item = document.createElement('div');
      item.className = 'tabs-benefit-item';
      item.append(node);
      groups.push(item);
      return;
    }
    if (node.matches('p')) {
      const last = groups[groups.length - 1];
      // Body copy under an h3 stays with that heading; title-only <p>s
      // (Dillard's) each become their own item so they can split across columns.
      if (last && last.querySelector(':scope > h3')) {
        last.append(node);
      } else {
        const item = document.createElement('div');
        item.className = 'tabs-benefit-item';
        item.append(node);
        groups.push(item);
      }
      return;
    }
    groups.push(node);
  });

  if (!groups.length) return;

  const mid = Math.ceil(groups.length / 2);
  const columns = document.createElement('div');
  columns.className = 'tabs-benefit-columns';

  const col1 = document.createElement('div');
  col1.className = 'tabs-benefit-column';
  const col2 = document.createElement('div');
  col2.className = 'tabs-benefit-column';

  groups.slice(0, mid).forEach((g) => col1.append(g));
  groups.slice(mid).forEach((g) => col2.append(g));
  columns.append(col1, col2);

  wrap.replaceChildren(columns);
}

export default async function decorate(block) {
  // build tablist
  const tablist = document.createElement('div');
  tablist.className = 'tabs-list';
  tablist.setAttribute('role', 'tablist');

  const isRetail = document.body.classList.contains('credit-card-retail-pdp');

  // decorate tabs and tabpanels
  const tabs = [...block.children].map((child) => child.firstElementChild);
  tabs.forEach((tab, i) => {
    const id = toClassName(tab.textContent);

    // decorate tabpanel
    const tabpanel = block.children[i];
    tabpanel.className = 'tabs-panel';
    tabpanel.id = `tabpanel-${id}`;
    tabpanel.setAttribute('aria-hidden', !!i);
    tabpanel.setAttribute('aria-labelledby', `tab-${id}`);
    tabpanel.setAttribute('role', 'tabpanel');

    // build tab button
    const button = document.createElement('button');
    button.className = 'tabs-tab';
    button.id = `tab-${id}`;
    button.innerHTML = tab.innerHTML;
    button.setAttribute('aria-controls', `tabpanel-${id}`);
    button.setAttribute('aria-selected', !i);
    button.setAttribute('role', 'tab');
    button.setAttribute('type', 'button');
    button.addEventListener('click', () => {
      block.querySelectorAll('[role=tabpanel]').forEach((panel) => {
        panel.setAttribute('aria-hidden', true);
      });
      tablist.querySelectorAll('button').forEach((btn) => {
        btn.setAttribute('aria-selected', false);
      });
      tabpanel.setAttribute('aria-hidden', false);
      button.setAttribute('aria-selected', true);
    });
    tablist.append(button);
    tab.remove();

    // After the label cell is removed, restructure retail panel content into columns
    if (isRetail) decorateRetailPanel(tabpanel);
  });

  block.prepend(tablist);
}
