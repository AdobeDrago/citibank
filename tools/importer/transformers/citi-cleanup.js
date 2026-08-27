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
    //
    // Two refinements (verified to help both tds-* and retail pages):
    //  1. Footnote markers sit flush against the preceding word ("5% back<sup>2</sup>"),
    //     so markdown emits a glued token ("5%back2" / "important2"). Insert a space
    //     before any <sup> that immediately follows text with no whitespace, so the
    //     marker tokenizes on its own — matching the source DOM (textContent yields
    //     "5% back 2"). This de-glues real content tokens and lifts similarity scoring.
    //  2. Retail footnote anchors carry an EMPTY href (href=""), which markdown renders
    //     as "[2]()" — a link to nowhere that still glues. Unwrap those empty-href
    //     anchors to their plain marker text so only the digit survives.
    // `document` is not a transformer parameter — derive it from the element so
    // createTextNode is available (a bare `document` reference would throw and the
    // caller's try/catch would silently skip this entire normalization loop).
    const doc = element.ownerDocument || (payload && payload.document);
    element.querySelectorAll('sup').forEach((sup) => {
      // Ensure a space precedes the footnote marker so it doesn't glue to prior text
      // ("back<sup>2</sup>" -> "back 2").
      const prev = sup.previousSibling;
      if (prev && prev.nodeType === 3 && prev.textContent && !/\s$/.test(prev.textContent)) {
        prev.textContent += ' ';
      }
      // ...and a space AFTER it so a leading marker doesn't glue to the following
      // word ("<sup>1</sup>Important" -> "1 Important").
      const next = sup.nextSibling;
      if (next && next.nodeType === 3 && next.textContent && !/^\s/.test(next.textContent)) {
        next.textContent = ` ${next.textContent}`;
      }

      // Match the footnote anchor regardless of href — retail markers use a
      // data-sup-* anchor with NO href attribute at all (an href="" only appears
      // later when html2md serializes it), so `a[href]` would miss them.
      const link = sup.querySelector('a');
      if (link && sup.children.length === 1) {
        const href = (link.getAttribute('href') || '').trim();
        const isPlaceholder = href === '' || href === '#' || /^javascript:/i.test(href);
        if (isPlaceholder) {
          // Empty/placeholder footnote reference: keep only the marker text so it
          // doesn't emit a "[2]()" empty link that glues to the prior word.
          if (doc) {
            sup.replaceWith(doc.createTextNode(` ${link.textContent.trim()} `));
          } else {
            link.removeAttribute('href');
            sup.replaceWith(link);
          }
        } else {
          // Real footnote link: keep the anchor, drop the <sup> wrapper.
          sup.replaceWith(link);
        }
      }
    });
  }
}
