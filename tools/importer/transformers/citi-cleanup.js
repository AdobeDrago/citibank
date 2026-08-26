/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: citi.com credit-card PDP site-wide cleanup.
 *
 * Source is an Angular SSR PDP (www.citi.com/credit-cards/...). Selectors below
 * were all verified against migration-work/cleaned.html.
 *
 * Authorable page content lives in:
 *   <section id="page-container">        (hero)
 *   <div id="pdp-content-container">      (all body blocks)
 * Everything outside those (global header/nav/banner, footer, sticky apply bar,
 * consent/tracking widgets, iframes) is site shell auto-populated by EDS and is
 * removed here.
 *
 * NOTE ON ng-star-inserted: the section selectors in page-templates.json rely on
 * the `.ng-star-inserted` class (e.g. `tds-hero-banner.ng-star-inserted`). The
 * companion section transformer (citi-sections.js) runs its afterTransform AFTER
 * this cleanup's afterTransform, so this transformer intentionally does NOT strip
 * that class. Only the noise attributes (ng-tns-*, ng-reflect-*, ng-version) and
 * ng-trigger-* classes are removed.
 */

const H = { before: 'beforeTransform', after: 'afterTransform' };

export default function transform(hookName, element, payload) {
  if (hookName === H.before) {
    // Consent / notify banners and tracking widgets that sit after the app root
    // (verified in cleaned.html: #ensConsentWidget, #ensNotifyBanner, header#ensTitle).
    // Removed before block parsing so overlays can't interfere with matching.
    WebImporter.DOMUtils.remove(element, [
      '#ensConsentWidget',
      '#ensNotifyBanner',
      '#ensBannerDescription',
      '#ensSaveText',
      '#ensCancelText',
      'header#ensTitle',
      'section.consentWidget',
    ]);

    // Global site chrome (header/banner/nav/search) - auto-populated by EDS.
    // Verified: citi-header, citi-banner, citi-navigation3, citi-nav-search.
    WebImporter.DOMUtils.remove(element, [
      'citi-header',
      'citi-banner',
      'citi-navigation3',
      'citi-nav-search',
    ]);

    // Global footer (nav + sub-nav + disclaimer + logo) - auto-populated by EDS.
    // Verified: citi-footer, citi-footer-navigation, citi-footer-sub-navigation,
    // citi-footer-disclaimer.
    WebImporter.DOMUtils.remove(element, [
      'citi-footer',
      'citi-footer-navigation',
      'citi-footer-sub-navigation',
      'citi-footer-disclaimer',
    ]);

    // Sticky "apply" bar - transient chrome, not authorable page content.
    // Verified: <section class="footer-sticky"> inside app-products.
    WebImporter.DOMUtils.remove(element, ['section.footer-sticky']);
  }

  if (hookName === H.after) {
    // Belt-and-suspenders removal of any global chrome / tracking that survived
    // block parsing, plus non-authorable embeds. All verified in cleaned.html.
    WebImporter.DOMUtils.remove(element, [
      'citi-header',
      'citi-footer',
      'section.footer-sticky',
      '#ensConsentWidget',
      '#ensNotifyBanner',
      'header#ensTitle',
      'iframe',
      'link',
      'noscript',
      'script',
      'style',
    ]);

    // Strip Angular framework noise attributes. These are non-authorable and clutter
    // the imported markup. ng-star-inserted (class) is deliberately preserved for the
    // section transformer; ng-tns-*/ng-trigger-* classes and ng-* attributes are not.
    element.querySelectorAll('*').forEach((el) => {
      // Remove Angular attributes by name (ng-tns-*, ng-reflect-*, ng-version, _ng*).
      [...el.attributes].forEach((attr) => {
        const name = attr.name;
        if (
          name.startsWith('_ng') ||
          name.startsWith('ng-reflect-') ||
          name === 'ng-version' ||
          name === 'ng-tns'
        ) {
          el.removeAttribute(name);
        }
      });

      // Remove Angular runtime classes (ng-tns-*, ng-trigger-*, ng-star-inserted is kept).
      if (el.classList && el.classList.length) {
        [...el.classList].forEach((cls) => {
          if (cls.startsWith('ng-tns-') || cls.startsWith('ng-trigger')) {
            el.classList.remove(cls);
          }
        });
        // Clean up now-empty class attributes.
        if (el.getAttribute('class') === '') el.removeAttribute('class');
      }
    });

    // Normalize footnote/disclaimer superscripts. Source markup wraps footnote markers
    // in <sup> (verified: many <sup> nodes, e.g. Citi<sup>&reg;</sup>). Where a <sup>
    // only carries a footnote-reference anchor, unwrap so the link survives markdown
    // conversion; trademark glyph <sup>s are left intact as plain text.
    element.querySelectorAll('sup').forEach((sup) => {
      const link = sup.querySelector('a[href]');
      if (link && sup.children.length === 1) {
        // Footnote reference: keep the anchor, drop the <sup> wrapper.
        sup.replaceWith(link);
      }
    });
  }
}
