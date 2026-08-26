// Import SDK
// eslint-disable-next-line import/no-unresolved
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

const DATA_URL = 'https://da-sc.adobeaem.workers.dev/preview/demoamer275/northwell/data/dyn-codes';

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.append(toast);

  setTimeout(() => toast.remove(), 3000);
}

async function copyToClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast('Copied to the clipboard');
  } catch {
    showToast('Unable to copy to the clipboard');
  }
}

function renderList(items) {
  const ul = document.createElement('ul');

  items.forEach(({ name, value }) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name;
    button.addEventListener('click', () => copyToClipboard(value));
    li.append(button);
    ul.append(li);
  });

  document.body.append(ul);
}

function renderError(message) {
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = message;
  document.body.append(p);
}

(async function init() {
  // eslint-disable-next-line no-unused-vars
  const { context, token } = await DA_SDK;

  try {
    const resp = await fetch(DATA_URL);
    if (!resp.ok) throw new Error(`Request failed: ${resp.status}`);
    const json = await resp.json();
    const items = json?.data || [];
    if (items.length === 0) {
      renderError('No codes found.');
      return;
    }
    renderList(items);
  } catch {
    renderError('Unable to load codes.');
  }
}());
