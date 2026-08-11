/*
 * Pricing Tiers Block
 * Comparison cards for relationship tiers (e.g. Everyday Benefits / Citi Priority /
 * Citigold / Citigold Private Client), each with its own accent color and CTA.
 * Authoring model: one row per tier - name, balance requirement, benefits list, CTA link.
 * The tier name is slugified into a data-tier attribute so CSS can key accent colors
 * off it without relying on row order.
 */

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.className = 'pricing-tiers-list';
  [...block.children].forEach((row) => {
    const [nameCell, balanceCell, benefitsCell, ctaCell] = row.children;
    const tierName = nameCell ? nameCell.textContent.trim() : '';

    const li = document.createElement('li');
    li.className = 'pricing-tiers-card';
    if (tierName) li.dataset.tier = slugify(tierName);

    if (nameCell) {
      nameCell.className = 'pricing-tiers-name';
      li.append(nameCell);
    }
    if (balanceCell) {
      balanceCell.className = 'pricing-tiers-balance';
      li.append(balanceCell);
    }
    if (benefitsCell) {
      benefitsCell.className = 'pricing-tiers-benefits';
      li.append(benefitsCell);
    }
    if (ctaCell) {
      ctaCell.className = 'pricing-tiers-cta';
      li.append(ctaCell);
    }

    ul.append(li);
  });
  block.replaceChildren(ul);
}
