# Publish AEM Content Fragments to EDS

Walkthrough of the POC we ran for Citibank / Drago, following  
[Publishing AEM Content Fragments to Edge Delivery Services](https://www.aem.live/developer/content-fragment-overlay).

## Goal

Turn an AEM Content Fragment into a self-contained EDS HTML page (content in view-source, no GraphQL block on the page).

## What we used

| Item | Value |
|---|---|
| Org / site | `adobedrago` / `citibank` |
| Code branch (POC) | `feature-sonali` (Helix URL form) |
| AEM author | `https://author-p199056-e2062160.adobeaemcloud.com` |
| AEM publish | `https://publish-p199056-e2062160.adobeaemcloud.com` |
| Example CF | `/content/dam/cf-services/ccc-cf/benefit-dining` |
| CF model | Feature Benefit (`/conf/cf-services/settings/dam/cfm/models/feature-benefit`) |
| EDS path | `/cards/benefit-dining` |
| Mustache template | [`/cf-templates/feature-benefit.html`](../../cf-templates/feature-benefit.html) |
| Preview URL | https://feature-sonali--citibank--adobedrago.aem.page/cards/benefit-dining |

**Constraint for this POC:** Drago AEM was read-only (no CF create/edit/re-publish). We only read existing published CFs and configured Helix / json2html / Git.

```
AEM CF (DAM)
  → json2html (Assets API JSON + Mustache)
  → Helix Admin preview/live
  → Content Bus
  → *.aem.page / *.aem.live
```

DA (`content.da.live`) stays the primary site source. CF pages are **not** stored as DA docs; they land in the **Content Bus**.

---

## One-time setup (do once per site/branch)

### Step 1 — Mustache template in Git

1. Add `cf-templates/feature-benefit.html` (Mustache → EDS semantic HTML).
2. Commit and push to the branch json2html will use (we used `feature/sonali` → Helix `feature-sonali`).

Template must be on GitHub before preview works.

### Step 2 — Helix `public.json` (path mapping + model allowlist)

Tool: [Admin Edit](https://tools.aem.live/tools/admin-edit/index.html)

1. Fetch: `https://admin.hlx.page/config/adobedrago/sites/citibank/public.json`  
   (Blank is OK if it never existed.)
2. POST / Save this body (or merge with any existing `paths`):

```json
{
  "paths": {
    "mappings": [
      "/content/dam/cf-services/ccc-cf/:/cards/"
    ],
    "includes": [
      "/content/dam/cf-services/"
    ]
  },
  "xwalk": {
    "content-fragment-overlay": {
      "/content/dam/cf-services/ccc-cf/**": {
        "includes": [
          "/conf/cf-services/settings/dam/cfm/models/feature-benefit"
        ]
      }
    }
  }
}
```

3. Fetch again and confirm the JSON is stored.

### Step 3 — Helix `content.json` (json2html overlay)

Still in Admin Edit:

1. Fetch: `https://admin.hlx.page/config/adobedrago/sites/citibank/content.json`
2. Keep existing DA `source` and `contentBusId`.
3. Set `overlay` to json2html for your branch (this **replaces** any previous overlay, e.g. `byom-cc` — save the old URL to restore later):

```json
{
  "source": {
    "url": "https://content.da.live/adobedrago/citibank/",
    "type": "markup"
  },
  "overlay": {
    "url": "https://json2html.adobeaem.workers.dev/adobedrago/citibank/feature-sonali",
    "type": "markup"
  },
  "contentBusId": "<keep-existing-value>"
}
```

4. POST / Save.

**Note:** Admin Edit cannot configure json2html (CORS → “Failed to fetch”). Use curl for Step 4.

### Step 4 — json2html worker config (Terminal)

1. Get Helix Admin token:
   - Cookie: log in at https://admin.hlx.page/auth/adobe → DevTools → Application → Cookies → `auth_token`, **or**
   - Sidekick: Network → `admin.hlx.page` → Request Headers → `x-auth-token`
2. In Terminal:

```bash
export HLX_ADMIN_TOKEN='paste-token-here'

curl --request POST \
  --url 'https://json2html.adobeaem.workers.dev/config/adobedrago/citibank/feature-sonali' \
  --header "Authorization: token $HLX_ADMIN_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '[
    {
      "path": "/cards/",
      "endpoint": "https://author-p199056-e2062160.adobeaemcloud.com/api/assets/cf-services/ccc-cf/{{id}}.json",
      "regex": "/(?<=\\/cards\\/)(.+)$/",
      "template": "/cf-templates/feature-benefit.html",
      "relativeURLPrefix": "https://publish-p199056-e2062160.adobeaemcloud.com",
      "headers": { "Accept": "application/json" },
      "forwardHeaders": ["Authorization"]
    }
  ]' \
  -w "\nHTTP:%{http_code}\n"
```

Expect: `Config updated` and `HTTP:200`.

---

## Per–Content Fragment publish (repeat for each CF)

Only for CFs on the **Feature Benefit** model under `/content/dam/cf-services/ccc-cf/`.

### Step 5 — Preview (and optional live)

```bash
export HLX_ADMIN_TOKEN='paste-fresh-token-if-needed'

# Preview (required)
curl -X POST -w "\nHTTP:%{http_code}\n" \
  -H "Authorization: token $HLX_ADMIN_TOKEN" \
  "https://admin.hlx.page/preview/adobedrago/citibank/feature-sonali/cards/<cf-name>"

# Live (optional)
curl -X POST -w "\nHTTP:%{http_code}\n" \
  -H "Authorization: token $HLX_ADMIN_TOKEN" \
  "https://admin.hlx.page/live/adobedrago/citibank/feature-sonali/cards/<cf-name>"
```

`<cf-name>` = last segment of the DAM path.

| AEM CF path | EDS path | Preview URL |
|---|---|---|
| `.../ccc-cf/benefit-dining` | `/cards/benefit-dining` | https://feature-sonali--citibank--adobedrago.aem.page/cards/benefit-dining |
| `.../ccc-cf/benefit-citi-entertainment` | `/cards/benefit-citi-entertainment` | https://feature-sonali--citibank--adobedrago.aem.page/cards/benefit-citi-entertainment |
| `.../ccc-cf/unlock-value` | `/cards/unlock-value` | …/cards/unlock-value |
| `.../ccc-cf/aa-flight-discount` | `/cards/aa-flight-discount` | …/cards/aa-flight-discount |
| `.../ccc-cf/benefit-reserve-travel` | `/cards/benefit-reserve-travel` | …/cards/benefit-reserve-travel |

Successful preview JSON includes something like:

- `preview.status`: `200`
- `sourceLocation`: `markup:https://json2html.adobeaem.workers.dev/.../cards/<cf-name>`
- Content Bus path under `helix-content-bus/.../preview/cards/...`

### Step 6 — Verify

1. Open the preview URL.
2. View Source: title, image, body should be in HTML (`meta name="source" content="content-fragment-overlay"`).
3. Optional: `https://…aem.page/cards/<cf-name>.plain.html`

---

## Using CF pages on DA-authored pages

CF overlay pages are **not** folders in `da.live`. To compose them into a DA page:

1. Preview the CF once so `/cards/<cf-name>` exists in the Content Bus.
2. In DA, add a **Fragment** block pointing to `/cards/<cf-name>`.
3. Preview the DA page — fragment loads `{path}.plain.html`.

Or link to `/cards/<cf-name>` as a normal URL.

---

## Checklist summary

**One-time**

1. [ ] Push Mustache template to GitHub branch  
2. [ ] `public.json` — DAM → `/cards/` mapping + model allowlist  
3. [ ] `content.json` — DA source + json2html overlay  
4. [ ] json2html `/config/...` via curl  

**Each CF**

5. [ ] `POST admin.hlx.page/preview/.../cards/<cf-name>`  
6. [ ] Open `*.aem.page/cards/<cf-name>` and confirm HTML  

---

## Restore previous overlay (if needed)

Before the POC, `content.json` overlay was `byom-cc`:

`https://4191536-616olivepuffin.adobeioruntime.net/api/v1/web/byom-cc/data-provider`

In Admin Edit, fetch `content.json`, put that URL back under `overlay.url`, POST / Save.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Admin Edit → json2html “Failed to fetch” | CORS — use Terminal curl |
| curl `HTTP:401` | Token missing in this shell, or expired — re-export `HLX_ADMIN_TOKEN` |
| `zsh: parse error near ')'` | Don’t paste comments like `# 1)` — use a single-line curl |
| Empty `public.json` fetch | File didn’t exist yet — POST creates it |
| Sparse layout on page | Template is minimal POC HTML; styling is separate from publish success |
| Looking for `/cards` in DA | Wrong store — pages are in Content Bus, not da.live |

---

## GraphQL content-fragment block (path + variation)

Separate from the json2html `/cards` overlay: the DA **content-fragment** block loads CFs live via AEM GraphQL.

| Visitor | Variation requested |
|---|---|
| Logged out | `master` |
| Logged in (simulated `ecid=seg-a`) | `seg-a` |

**Code:** [`scripts/aem-content-fragment.js`](../../scripts/aem-content-fragment.js), [`blocks/content-fragment/`](../../blocks/content-fragment/), [`scripts/auth.js`](../../scripts/auth.js) (`SEGMENT_VALUE = seg-a`).

**Credit card GraphQL:** persisted query `cf-services/ccbypathandvariation`  
`GET …/graphql/execute.json/cf-services/ccbypathandvariation;path=…;variation=master|seg-a`

**Default GraphQL host:** Drago publish. Optional override: `?aemOrigin=http://localhost:4503` (local CORS proxy).

### Drago prerequisite

Create and **publish** variation `seg-a` on a credit-card CF used by the block, e.g.:

`/content/dam/cf-services/ccc-cf/citi-double-cash`

Change eyebrow/title (or highlights) so login is obvious. Without `seg-a`, GraphQL may still return `master` for both states.

GraphiQL: https://author-p199056-e2062160.adobeaemcloud.com/ui#/aem/aem/graphiql.html

```graphql
query {
  creditCardByPath(
    _path: "/content/dam/cf-services/ccc-cf/citi-double-cash"
    variation: "seg-a"
  ) {
    item { _variation eyeBrow title { plaintext } }
  }
}
```

### Local testing when Drago CORS is missing

Browser calls from `localhost:3000` / `*.aem.page` to Drago publish fail without CORS.
Use the local proxy (forwards GraphQL and adds CORS headers):

```bash
# terminal 1
npx -y @adobe/aem-cli up --no-open --forward-browser-logs

# terminal 2
node scripts/dev-aem-graphql-proxy.mjs
```

Open:

`http://localhost:3000/credit-cards/content-fragment-demo?aemOrigin=http://localhost:4503`

Logged out → master; Log In → seg-a.

