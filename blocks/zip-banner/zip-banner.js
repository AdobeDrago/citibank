import {
  applyZip,
  getZip,
  normalizeZip,
  onBtaUpdated,
} from '../../scripts/bta.js';

const MODAL_COPY = {
  eyebrow: 'CITI CHECKING ACCOUNT',
  title: 'Enter your ZIP Code to get started.',
  body: 'The products and pricing we offer may vary between locations. By using the ZIP Code of your home (not mailing) address, we can provide you with accurate information.',
  label: 'Enter Home ZIP Code',
  submit: 'Submit',
};

function authoredText(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

/** White Citi wordmark for the navy modal header. */
function buildLogo() {
  const logo = document.createElement('div');
  logo.className = 'zip-modal-logo';
  logo.setAttribute('aria-hidden', 'true');
  logo.innerHTML = `
    <svg viewBox="0 0 89 89" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <path fill="#fff" d="M16.55 50.27c0-5.77 4.73-10.27 10.89-10.27 3.57 0 6.82 1.59 8.68 3.99l-2.67 2.67a6.9 6.9 0 0 0-5.64-2.27c-3.68 0-6.63 2.75-6.63 6.55s2.95 6.59 6.63 6.59a6.95 6.95 0 0 0 6.16-3.06l2.64 2.6c-1.78 2.52-5.19 4.18-8.84 4.18-6.16 0-10.89-4.5-10.89-10.31z"/>
      <path fill="#fff" d="M39.76 40.7h4.22v19.18h-4.22z"/>
      <path fill="#fff" d="M51.85 54.73V44.27h-4.61V40.7h4.81v-4.11l3.95-1.94v6.05h6.28v3.57h-6.28v9.77c0 1.94 1.09 2.79 3.14 2.79 1.07 0 2.13-.22 3.1-.66v3.64a8.3 8.3 0 0 1-3.88.78c-3.76 0-6.51-2.05-6.51-5.85z"/>
      <path fill="#fff" d="M65.61 40.7h4.22v19.18h-4.22z"/>
      <path fill="#FF3C28" d="M54.76 28.49a26.3 26.3 0 0 1 17.71 9.15h-4.92a18.7 18.7 0 0 0-12.79-5.7 18.7 18.7 0 0 0-12.79 5.7h-4.92a26.3 26.3 0 0 1 17.71-9.15z"/>
    </svg>`;
  return logo;
}

/**
 * Builds the Change-ZIP dialog once and appends it to the document.
 * @returns {{
 *   dialog: HTMLDialogElement,
 *   input: HTMLInputElement,
 *   open: () => void,
 *   close: () => void,
 * }}
 */
function buildModal() {
  const titleId = `zip-modal-title-${Math.random().toString(36).slice(2, 9)}`;
  const dialog = document.createElement('dialog');
  dialog.className = 'zip-modal';
  dialog.setAttribute('aria-labelledby', titleId);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'zip-modal-close';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = '<span aria-hidden="true"></span>';

  const header = document.createElement('div');
  header.className = 'zip-modal-header';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'zip-modal-eyebrow';
  eyebrow.textContent = MODAL_COPY.eyebrow;
  const title = document.createElement('h2');
  title.id = titleId;
  title.className = 'zip-modal-title';
  title.textContent = MODAL_COPY.title;
  const body = document.createElement('p');
  body.className = 'zip-modal-body-text';
  body.textContent = MODAL_COPY.body;
  header.append(buildLogo(), eyebrow, title, body);

  const panel = document.createElement('div');
  panel.className = 'zip-modal-panel';

  const form = document.createElement('form');
  form.className = 'zip-modal-form';

  const label = document.createElement('label');
  label.className = 'zip-modal-label';
  const labelText = document.createElement('span');
  labelText.className = 'zip-modal-label-text';
  labelText.textContent = MODAL_COPY.label;
  const input = document.createElement('input');
  input.className = 'zip-modal-input';
  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'postal-code';
  input.pattern = '[0-9]{5}';
  input.maxLength = 5;
  input.required = true;
  input.setAttribute('aria-label', MODAL_COPY.label);
  label.append(labelText, input);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'zip-modal-submit';
  submit.textContent = MODAL_COPY.submit;

  form.append(label, submit);
  panel.append(form);
  dialog.append(close, header, panel);
  document.body.append(dialog);

  const open = () => {
    if (!dialog.open) dialog.showModal();
    input.focus();
    input.select();
  };

  const dismiss = () => {
    if (dialog.open) dialog.close();
  };

  close.addEventListener('click', dismiss);
  dialog.addEventListener('click', (event) => {
    const {
      left, right, top, bottom,
    } = dialog.getBoundingClientRect();
    const { clientX, clientY } = event;
    if (clientX < left || clientX > right || clientY < top || clientY > bottom) dismiss();
  });

  return {
    dialog, input, form, open, close: dismiss,
  };
}

export default async function decorate(block) {
  // The heading is optional: on the Citigold band the authored heading stays in
  // the section so it keeps the band's typography, and the block contributes
  // only the ZIP and the change control.
  const headingEl = block.querySelector('h1, h2, h3, h4');
  const headingText = authoredText(headingEl);
  const changeEl = [...block.querySelectorAll('a, p')].reverse()
    .find((el) => /change zip/i.test(authoredText(el)));
  const changeText = authoredText(changeEl?.querySelector('a') || changeEl)
    || 'Change ZIP Code';

  let heading;
  if (headingText) {
    heading = document.createElement(headingEl.tagName);
    heading.className = 'zip-banner-heading';
    heading.textContent = headingText;
  }

  const zipEl = document.createElement('p');
  zipEl.className = 'zip-banner-zip';
  zipEl.setAttribute('aria-live', 'polite');

  const change = document.createElement('button');
  change.type = 'button';
  change.className = 'zip-banner-change';
  change.setAttribute('aria-haspopup', 'dialog');
  change.textContent = changeText;

  const modal = buildModal();

  const render = (result) => {
    zipEl.textContent = result.zip;
    modal.input.value = result.zip;
  };

  change.addEventListener('click', () => {
    modal.input.value = zipEl.textContent || getZip();
    modal.input.setCustomValidity('');
    modal.open();
  });

  modal.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const zip = normalizeZip(modal.input.value);
    if (zip.length !== 5) {
      modal.input.setCustomValidity('Enter a 5-digit ZIP Code');
      modal.input.reportValidity();
      return;
    }
    modal.input.setCustomValidity('');
    render(await applyZip(zip));
    modal.close();
  });

  modal.dialog.addEventListener('close', () => change.focus());

  // Stay aligned if another block (e.g. footer fee table) applies a ZIP later.
  onBtaUpdated((event) => render(event.detail));

  block.replaceChildren(...[heading, zipEl, change].filter(Boolean));
  render(await applyZip(getZip()));
}
