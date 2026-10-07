/*
 * Behaviour for the `citibank` brand - the default/base brand (www.citi.com).
 *
 * Served on: https://{ref}--citibank--adobedrago.aem.page|live
 *
 * This file MUST exist for every key in BRAND_REGISTRY, even if every hook is empty.
 * Keep brand-specific code here to the minimum: if a difference can be expressed by
 * content plus this brand's token file, it does not belong in this module.
 */

export default {
  /**
   * Runs before sections and blocks are decorated.
   * @param {Element} main The main element
   */
  decorateMainEarly() {
    // no base-brand-specific early decoration
  },

  /**
   * Runs after sections and blocks are decorated, once the `-wrapper` and `-container`
   * classes exist.
   * @param {Element} main The main element
   */
  decorateMainLate() {
    // no base-brand-specific late decoration
  },

  /**
   * Runs at the end of the lazy phase. 404.html sets window.isErrorPage synchronously
   * before scripts.js loads, so the flag is reliably set by the time this runs.
   */
  init() {
    // no base-brand-specific behaviour; the shared 404 page is used as-is
  },
};
