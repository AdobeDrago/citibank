/*
 * Steps Block
 * Numbered sequence of steps, e.g. "Open account" -> "Fund account" -> "Maintain balance"
 * Authoring model: one row per step, cell 1 = title, cell 2 = description
 */

export default function decorate(block) {
  const ol = document.createElement('ol');
  ol.className = 'steps-list';
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'steps-item';
    const [title, body] = row.children;
    if (title) title.className = 'steps-title';
    if (body) body.className = 'steps-body';
    if (title) li.append(title);
    if (body) li.append(body);
    ol.append(li);
  });
  block.replaceChildren(ol);
}
