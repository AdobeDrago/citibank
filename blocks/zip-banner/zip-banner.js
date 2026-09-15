import { applyZip, getZip, normalizeZip } from '../../scripts/bta.js';

function authoredText(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

export default async function decorate(block) {
  const headingEl = block.querySelector('h1, h2, h3, h4, p');
  const headingText = authoredText(headingEl)
    || 'Products & pricing are based on your home address';
  const changeEl = [...block.querySelectorAll('a, p')].reverse()
    .find((el) => /change zip/i.test(authoredText(el)));
  const changeText = authoredText(changeEl?.querySelector('a') || changeEl)
    || 'Change ZIP Code';

  const headingTag = /^H[1-6]$/.test(headingEl?.tagName) ? headingEl.tagName : 'H2';
  const heading = document.createElement(headingTag);
  heading.className = 'zip-banner-heading';
  heading.textContent = headingText;

  const zipEl = document.createElement('p');
  zipEl.className = 'zip-banner-zip';
  zipEl.setAttribute('aria-live', 'polite');

  const change = document.createElement('button');
  change.type = 'button';
  change.className = 'zip-banner-change';
  change.textContent = changeText;

  const form = document.createElement('form');
  form.className = 'zip-banner-form';
  form.hidden = true;

  const label = document.createElement('label');
  label.className = 'zip-banner-label';
  const labelText = document.createElement('span');
  labelText.className = 'zip-banner-label-text';
  labelText.textContent = 'ZIP Code';
  const input = document.createElement('input');
  input.className = 'zip-banner-input';
  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'postal-code';
  input.pattern = '[0-9]{5}';
  input.maxLength = 5;
  input.required = true;
  input.setAttribute('aria-label', 'ZIP Code');
  label.append(labelText, input);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'zip-banner-apply';
  submit.textContent = 'Apply';

  form.append(label, submit);

  const showForm = (visible) => {
    form.hidden = !visible;
    change.hidden = visible;
    if (visible) input.focus();
  };

  const render = (result) => {
    zipEl.textContent = result.zip;
    input.value = result.zip;
    showForm(false);
  };

  change.addEventListener('click', () => showForm(true));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const zip = normalizeZip(input.value);
    if (zip.length !== 5) {
      input.setCustomValidity('Enter a 5-digit ZIP Code');
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    render(await applyZip(zip));
  });

  block.replaceChildren(heading, zipEl, change, form);
  render(await applyZip(getZip()));
}
