/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: citi.com credit-card PDP section boundaries + section metadata.
 *
 * The credit-card-pdp template defines 12 sections (page-templates.json). This
 * transformer inserts a section break (<hr>) before every section except the
 * first, and a Section Metadata block after each section that carries a `style`
 * (only rc1c2c2c5 -> light-grey and rc1c2c2c8 -> pale-blue here).
 *
 * Section selectors come from page-templates.json (already DOM-verified) and are
 * used directly. Several of those selectors are the exact elements block parsers
 * replace via element.replaceWith(...), so breaks are inserted in beforeTransform
 * (while every section element still exists) using a marker attribute, and the
 * metadata blocks are anchored to that surviving marker in afterTransform. Both
 * hooks iterate the sections in reverse so inserts never shift not-yet-processed
 * elements. This is the reference implementation from generate-import-transformer.md.
 */

const SECTION_MARKER_ATTR = 'data-excat-section-id';

export default function transform(hookName, element, payload) {
  const sections = (payload.template && payload.template.sections) || [];

  if (hookName === 'beforeTransform') {
    // Insert breaks now, before parsers can replace any section element.
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      if (i === 0 && !section.style) continue; // first section: no leading break, no metadata
      const sectionEl = element.querySelector(section.selector);
      if (!sectionEl) continue; // selector didn't match on this page — skip, never guess

      const hr = document.createElement('hr');
      if (section.style) hr.setAttribute(SECTION_MARKER_ATTR, section.id);
      sectionEl.before(hr);
    }
  }

  if (hookName === 'afterTransform') {
    // Parsers have now run and may have replaced section elements. Anchor each
    // styled section's Section Metadata block to whichever still exists: the
    // marker <hr> placed above, or (first section) the original element itself.
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      if (!section.style) continue;

      const marker = element.querySelector(`[${SECTION_MARKER_ATTR}="${section.id}"]`);
      const anchor = marker || element.querySelector(section.selector);
      if (!anchor) continue; // neither survived — skip, never guess

      const metadataBlock = WebImporter.Blocks.createBlock(document, {
        name: 'Section Metadata',
        cells: { style: section.style },
      });
      anchor.after(metadataBlock);

      if (marker) {
        marker.removeAttribute(SECTION_MARKER_ATTR);
        if (i === 0) marker.remove(); // section 0 never gets a real leading break
      }
    }
  }
}
