# Repoless multi-brand configuration

One GitHub repository (`AdobeDrago/citibank`) serves N branded Edge Delivery sites. The
pattern has two independent halves, and conflating them is the usual source of confusion:

- **Code delivery** — N site configurations in the Admin Config Service, each pointing
  `code.source` at this repository. None of this lives in the repo.
- **Per-brand variation** — brand resolved at runtime into `data-brand`, with
  brand-specific code in predictable brand-named folders.

Reference: [aem.live/docs/repoless](https://www.aem.live/docs/repoless),
[aem.live/docs/config-service-setup](https://www.aem.live/docs/config-service-setup).

## Sites

| Site name | Brand key | Resolved by | Serves |
| --- | --- | --- | --- |
| `citibank` | `citibank` | exact match on the site segment | www.citi.com |
| `banking-citibank` | `banking` | `banking-` prefix on the site segment | banking.citi.com |

Hostnames are `https://{ref}--{site}--adobedrago.aem.page|live`. Note the site segment
cannot contain dots — `banking.citibank` is not a valid site name. A `banking.citi.com`
style address is a custom production domain on the `banking-citibank` site, configured at
the CDN, not a `--` hostname.

## Part A — console configuration

Per site, `PUT https://admin.hlx.page/config/adobedrago/sites/{site}.json`:

```json
{
  "code": {
    "source": { "type": "github", "url": "https://github.com/AdobeDrago/citibank" },
    "owner": "adobedrago",
    "repo": "citibank"
  },
  "content": {
    "source": { "type": "markup", "url": "https://content.da.live/adobedrago/citibank/" }
  }
}
```

The `code` block is **identical across every site** — that is what makes the setup
repoless. Include `code.source`: `code.repo` is only a label, while `code.source.url` is
where code is actually pulled from.

Rules worth knowing:

- **Each site has its own `contentBusId`**, even when two sites share one
  `content.source.url`. Publish state is therefore **not** shared — a page must be
  previewed and published separately per site.
- **When re-PUTting an existing site's config, preserve `content.contentBusId` exactly.**
  It is nested under `content`, not top-level. Changing or dropping it points the site at
  an empty content bus and every published page 404s immediately.
- `version`, `lastModified` and `created` are server-managed; do not send them.
- **Site naming fails silently.** A site name that matches no registered brand key falls
  back to the default brand with no error. The key must be at the *start* of the segment:
  `banking-citibank` → `banking`, but `citi-banking` → default brand.

### Content sources

Both sites currently share one content root, `content.da.live/adobedrago/citibank/`. The
reference pattern gives each brand its own folder, and that is the right end state once
the banking site has authors publishing independently. It is deliberately deferred here
because `/cbol/...` is authored inside the main tree — separating it is a content
migration, not a config change.

### `fstab.yaml`

Still present, still mounting `/` → `content.da.live/adobedrago/citibank/`. It is
repo-wide, so it can only ever describe one site and must eventually be retired. **Order
matters:** the `citibank` site config must carry `content.source` *before* `fstab.yaml` is
deleted, or the live site loses its content mount.

## Part B — repository

| Path | Role |
| --- | --- |
| `scripts/brand.js` | Brand registry and resolution. The only place brand keys are declared. |
| `scripts/aem.js` | **Vendor patch** — brand-aware block resolution. See below. |
| `scripts/scripts.js` | Resolves the brand before anything brand-dependent; wires the hooks. |
| `styles/styles.css` | Declares the `--brand-*` token contract. |
| `scripts/{brand}/{brand}.js` | Per-brand behaviour, exporting `decorateMainEarly`, `decorateMainLate`, `init`. Required for every registered brand. |
| `styles/{brand}/{brand}.css` | Per-brand token overrides, scoped to `:root[data-brand="{brand}"]`. |
| `blocks/{brand}/{block}/` | Structural block fork. Only when the promotion test calls for one. |
| `tools/aem-dev.mjs` | Local preview wrapper; reads the registry so it carries no brand list. |

### Brand resolution order

`resolveBrand()` in `scripts/brand.js`, first match wins:

1. `?brand={key}` — **localhost only**, remembered in `sessionStorage` for the tab. Local
   only by design, so the override can never force a brand on a real preview or prod URL.
2. **`PATH_BRANDS`** — explicit content-path map. Currently `cbol` → `banking`.
3. The site segment of a `{ref}--{site}--{org}` hostname, exact or `{key}-` prefix.
4. A leading `/{key}/` path segment naming a brand directly.
5. `DOMAIN_BRANDS` / hostname substring, for custom production domains.
6. `DEFAULT_BRAND` (`citibank`).

**Why `PATH_BRANDS` outranks the hostname:** `/cbol/...` is the banking experience but is
authored in the main site's content tree. It must resolve to `banking` on the `citibank`
hostname too — both before `banking-citibank` exists and afterwards, for anyone arriving
by the original URL. A hostname is a site's *default* identity; an explicit path mapping is
a deliberate statement about the content.

The result is written to `document.documentElement.dataset.brand`. Every other mechanism
here keys off that one attribute.

### Divergence from the reference pattern: `loadBrandModule`

The reference awaits the brand module import bare during eager load, so a brand registered
in `BRAND_REGISTRY` whose `scripts/{brand}/{brand}.js` is missing **rejects before the page
is decorated** — the body never gets its `appear` class and the page renders blank, with no
error pointing at the cause.

Here the import is wrapped: the failure is logged and the page renders with shared code.
The brand module file is still required for every registered brand; this only changes the
failure from silent-blank-page to logged-and-degraded.

### The `aem.js` vendor patch

`scripts/aem.js` is vendored and otherwise never edited — `AGENTS.md` says so. This is the
single deliberate exception. `resolveBlockPath()` makes `loadBlock()` try
`blocks/{brand}/{block}/` first and fall back to `blocks/{block}/`. Folder existence is the
only signal, so there is no block-to-brand map to maintain.

> **Re-apply after any upstream sync.** A fresh `aem.js` will not contain the patch, and
> every brand block override will then silently stop resolving — pages render with shared
> blocks and nothing errors. `grep resolveBlockPath scripts/aem.js` to check. Worth a CI
> guard.

Cost: one cached 404 probe per (brand, block) where that brand has no fork. Expected in
the network panel, not a bug.

### Styling — the token contract

`styles/styles.css` declares `--brand-*` with **literal** defaults (not `var()` references
to tokens a brand file overrides, or the two become circular). Each brand overrides them
in its own file, scoped to its own `data-brand`, so the files cannot collide.

Block CSS should reach for these tokens rather than hardcoding colours, fonts or radii, so
a brand override is enough to restyle a shared block without forking it.

Per-brand `@font-face` rules belong in the brand's token file: it only loads when that
brand is active, so the font is scoped to that brand for free.

**`styles/banking/banking.css` intentionally has no palette overrides.** The shared `:root`
palette was extracted from the Citigold Featured Offer page itself, so cbol pages already
render correctly. Overriding `--link-color` / `--background-color` there would change the
appearance of an already-published page — a regression, not a feature. Diverge only when
the real banking.citi.com palette is known and the change is intended.

### Blocks — shared by default, forked by exception

> **The promotion test.** If changing the content plus the brand token file makes it look
> and behave correctly, it is a page — not a block fork.

Fork only when the brand needs markup or behaviour the shared block genuinely cannot
express — not merely different colours, fonts or a logo. A fork nests under the brand
folder (`blocks/banking/header/`), never as a hyphenated top-level `banking-header/`.

**No forks currently exist.** `header` and `footer` do render differently for the banking
brand, but via a conditional inside the shared block:

```js
function isBankingBrand() {
  return document.documentElement.dataset.brand === 'banking';
}
```

When true they load the `cbol-nav` / `cbol-footer` fragments and render
`renderCbolHeader` / `renderCbolFooter`, falling back to the retail chrome if the fragment
is unavailable. This was previously a path test against `/cbol/`; it is now brand-based so
the decision lives in `brand.js` alone.

Because resolution falls back to `blocks/{block}/`, every block a brand relies on must
exist in either that brand's folder or the shared folder. Audit shared coverage when
onboarding a brand — `header` and `footer` are the ones most often forked for one brand and
then missing for the rest.

### Shared static pages

`404.html` is one shared file, never edited per brand. It sets a flag synchronously, before
`scripts.js` loads:

```html
<script nonce="aem" type="text/javascript">
  window.isErrorPage = true;
  window.errorCode = '404';
</script>
```

By the time a brand's `init()` runs the flag is reliably set, so each brand customises the
shared page from its own module — `scripts/banking/banking.js` adds a class that its token
file styles. Keep brand and path checks out of `404.html` itself.

## Local development

```bash
nvm use 22          # the AEM CLI requires Node 20+
npm run dev -- banking /cbol/om/checking/citigold/featured-offer/default
npm run dev -- citibank /credit-cards
```

`npm run dev -- {brand}` proxies that brand's site and opens the page with `?brand={brand}`.
Running `aem up --url https://main--banking-citibank--adobedrago.aem.page` *without*
`?brand=` serves that brand's content with the default brand's styling, because localhost
matches no brand key. Nothing errors; it just looks wrong.

`npm run dev -- banking` only works once the `banking-citibank` site config exists.

## Adding a brand

Steps 1–4 are required; a brand is not usable until all four are done.

1. Register the key in `BRAND_REGISTRY` in `scripts/brand.js`. A brand not registered here
   is never recognised, whatever folders exist on disk.
2. Add `scripts/{brand}/{brand}.js` exporting a default object with `init()`. An empty body
   is fine — but the file must exist.
3. Add `styles/{brand}/{brand}.css` scoped under `:root[data-brand="{brand}"]`.
4. Create the site configuration and content source (Part A), and confirm the site name
   satisfies the prefix rule.
5. *Optional:* `icons/{brand}/` assets if the brand uses `--brand-logo-url`;
   `fonts/{brand}/` webfonts referenced from its token file.
6. *Optional, usually not needed at first:* fork blocks, only if the promotion test says so.

Then preview with `npm run dev -- {brand}` and confirm `<html data-brand>` holds the
expected value.

## Failure modes

Most misconfigurations here fail quietly — the page renders, just wrongly.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Every site renders as the base brand | Site name matches no registered brand key | Rename the site, or give it a `{key}-` prefix |
| Nothing deploys; code never updates | `code.source` omitted, or Code Sync not installed | Add `code.source.url`; install the GitHub app |
| Every published page suddenly 404s | `content.contentBusId` changed or dropped on a re-PUT | Restore the backed-up config body |
| Live site loses its content mount | `fstab.yaml` deleted before the config carried `content.source` | Add `content.source`, then delete |
| Brand renders with shared code, error in console | `scripts/{brand}/{brand}.js` missing | Create the module, or remove the registry entry |
| Brand block overrides silently stop resolving | The `aem.js` patch was overwritten by a vendor sync | Re-apply `resolveBlockPath()` |
| A brand shows default colours and fonts | `styles/{brand}/{brand}.css` missing — degrades gracefully, failed request logged | Add the token file |
| A block is missing from the page entirely | No brand fork and no shared block | Add a shared implementation |
| Local preview shows the wrong brand | No `?brand=`; localhost matches no brand key | Use `npm run dev -- {brand}` |
| A production domain renders as the base brand | Domain does not contain its brand key | Add it to `DOMAIN_BRANDS` |
| 404s for block files in the network panel | Expected — the brand-first probe | None; cached per brand and block |

## Trade-offs

**What this buys.** One source of truth for shared code — fixes and core upgrades land once
and apply everywhere. Content wired per site, so authors publish one brand without touching
another. No block-to-brand mapping to drift. Brand-specific code can only affect its own
brand. One CI pipeline, one dependency tree.

**What it costs.** *Shared code has a shared blast radius* — merging to `main` ships to
every brand at once, so code releases and content releases need separate coordination. This
is the single most important operational consequence. One vendored file is patched, and an
upstream sync will silently remove it. The same fallbacks that remove the registry also mean
a typo in a site or folder name produces a wrong-looking page rather than an error — the
failure-modes table is the mitigation. And one cached 404 probe per unforked block, per brand.
