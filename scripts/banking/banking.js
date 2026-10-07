/*
 * Behaviour for the `banking` brand - banking.citi.com.
 *
 * Served on: https://{ref}--banking-citibank--adobedrago.aem.page|live
 * (resolved by the `banking-` prefix rule in scripts/brand.js), and on the citibank
 * hostname for `/cbol/...` paths via the PATH_BRANDS map.
 *
 * This is the brand behind the Citigold Featured Offer scenario:
 * /cbol/om/checking/citigold/featured-offer/default
 */

const PREVIEW_HOSTS = ['localhost', '127.0.0.1'];

/**
 * True on local and preview hosts only - never on `.aem.live` or a production domain.
 * @returns {boolean}
 */
function isPreviewHost() {
  const { hostname } = window.location;
  return PREVIEW_HOSTS.includes(hostname) || hostname.endsWith('.aem.page');
}

/**
 * Adds a small marker naming the resolved brand, so the two sites are distinguishable at
 * a glance while the repoless setup is being validated. Preview only. Remove once the
 * setup is signed off.
 */
function addPreviewBrandMarker() {
  if (!isPreviewHost() || document.querySelector('.brand-marker')) return;

  const marker = document.createElement('div');
  marker.className = 'brand-marker';
  marker.textContent = `brand: ${document.documentElement.dataset.brand}`;
  document.body.append(marker);
}

/**
 * Marks the shared 404 page as belonging to this brand, so the brand's token file can
 * style it without any brand or path check living inside 404.html itself.
 */
function decorateErrorPage() {
  document.body.classList.add('error-page-banking');
}

export default {
  /**
   * Runs before sections and blocks are decorated.
   * @param {Element} main The main element
   */
  decorateMainEarly() {
    // no banking-specific early decoration yet
  },

  /**
   * Runs after sections and blocks are decorated, once the `-wrapper` and `-container`
   * classes exist.
   * @param {Element} main The main element
   */
  decorateMainLate() {
    // no banking-specific late decoration yet
  },

  /**
   * Runs at the end of the lazy phase. 404.html sets window.isErrorPage synchronously
   * before scripts.js loads, so the flag is reliably set by the time this runs.
   */
  init() {
    if (window.isErrorPage) decorateErrorPage();
    addPreviewBrandMarker();
  },
};
