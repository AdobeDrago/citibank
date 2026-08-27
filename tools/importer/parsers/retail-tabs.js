/* eslint-disable */
/* global WebImporter */
/**
 * Parser for variant: retail-tabs (credit-card-retail-pdp template)
 * Base block: tabs (single column; each row = one cell whose first element is the
 * tab label and whose remaining elements are the tab panel content).
 * Source: Citi RETAIL co-brand PDP — app-pdp section.pdp-section > app-benefit-section
 *
 * The benefit section holds an <mkt-tab-list> of button[role=tab] controls paired
 * (via aria-controls) with <mkt-tab-panel> panels. Each tab becomes one block row:
 *   cell = [ <p><img icon> tab label</p>, ...panel rich content (H3 subheaders + <p> copy) ]
 * The tab icon is a lazy-loaded <img> whose real .svg lives in data-src (src is a
 * placeholder); it is captured into the label <p> so the tab pill shows icon + label
 * like the source. The section H2 ("... CREDIT CARD BENEFITS") is section default
 * content (template).
 */
export default function parse(element, { document }) {
  const tabList = element.querySelector('mkt-tab-list');
  const cells = [];

  // Section H2 ("... CREDIT CARD BENEFITS"), lifted out and emitted above the block
  // (the shared sections transformer does not emit template defaultContent).
  const sectionH2 = element.querySelector('h2');

  const buttons = tabList
    ? Array.from(tabList.querySelectorAll('button[role="tab"]'))
    : [];

  buttons.forEach((btn) => {
    // Tab label: the text span (ignore the icon <i>/<img>).
    const labelSpan = btn.querySelector('span');
    const labelText = (labelSpan ? labelSpan.textContent : btn.textContent).trim();

    // Tab icon: a lazy-loaded <img> whose real .svg is in data-src (src is a
    // placeholder). Prefer the real .svg; fall back to src if it looks like an asset.
    const iconImg = btn.querySelector('img');
    let iconSrc = null;
    if (iconImg) {
      const dataSrc = iconImg.getAttribute('data-src');
      const src = iconImg.getAttribute('src');
      iconSrc = (dataSrc && /\.(svg|png|webp|jpe?g)(\?|$)/i.test(dataSrc)) ? dataSrc
        : (src && /\.(svg|png|webp|jpe?g)(\?|$)/i.test(src) ? src : dataSrc || src);
    }

    // Matching panel via aria-controls -> panel id.
    const panelId = btn.getAttribute('aria-controls');
    const panel = panelId
      ? element.querySelector(`#${CSS.escape(panelId)}`)
      : null;

    // The tabs decorator treats each row's FIRST cell as the tab label and the
    // REMAINING cell(s) as that tab's panel content. So emit TWO cells per row:
    //   cell 1 = label (icon + text), cell 2 = panel rich content.
    const label = document.createElement('p');
    if (iconSrc) {
      const img = document.createElement('img');
      img.src = iconSrc;
      img.alt = labelText;
      label.append(img);
    }
    label.append(document.createTextNode(labelText));
    const labelCell = [label];

    const contentCell = [];
    const source = panel && (panel.querySelector('.panel-content') || panel);
    if (source) {
      // Preserve headings and paragraphs (with inline links) in document order.
      const parts = source.querySelectorAll('h2, h3, h4, p');
      if (parts.length) {
        parts.forEach((node) => {
          const tag = node.tagName.toLowerCase();
          const el = document.createElement(/^h[2-4]$/.test(tag) ? tag : 'p');
          el.append(...node.cloneNode(true).childNodes);
          contentCell.push(el);
        });
      } else {
        const p = document.createElement('p');
        p.append(...source.cloneNode(true).childNodes);
        contentCell.push(p);
      }
    }

    cells.push([labelCell, contentCell.length ? contentCell : '']);
  });

  // Empty-block guard
  if (cells.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'tabs', cells });

  if (sectionH2 && sectionH2.textContent.trim()) {
    const h = document.createElement('h2');
    h.append(...sectionH2.cloneNode(true).childNodes);
    element.replaceWith(h, block);
  } else {
    element.replaceWith(block);
  }
}
