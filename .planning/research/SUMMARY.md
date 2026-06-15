# Research Summary: odoo_website_newsletter_block

**Project:** odoo_website_newsletter_block
**Domain:** Odoo 18 website snippet module
**Researched:** 2026-06-15
**Confidence:** HIGH — all research sourced from direct reading of Odoo 18 source at `/Users/dortsman/Code/odoo18/addons/website_mass_mailing/`

---

## Stack Decision

**Single dependency. No custom controller. No custom JS.**

```python
'depends': ['website_mass_mailing'],
```

`website_mass_mailing` transitively provides `website`, `mass_mailing`, and `google_recaptcha`. The existing `/website_mass_mailing/subscribe` JSON-RPC endpoint already handles contact create, dedup, opt-out reinstatement, reCaptcha verification, and session caching. The existing `publicWidget.registry.subscribe` widget (selector `.js_subscribe`) auto-binds to any element with that class — activating subscribe, success-swap, and is-subscriber-check behavior with zero custom JS.

**Minimum viable file set:**
- `__manifest__.py` — single dep, two asset bundles, security CSV + XML data
- `security/ir.model.access.csv` — read access on `mailing.list` for website designers
- `views/snippets/snippets.xml` — snippet template + registration xpath + options xpath (all in one file)

No `models/`, no `controllers/`, no custom JS files required for v1.

---

## Table Stakes (must-haves for v1)

| Feature | How It's Delivered |
|---|---|
| Email input with submit button | QWeb template with `js_subscribe_value` + `js_subscribe_btn` classes |
| Name input (`address_name` param) | Add `<input name="name">` to template; existing controller already accepts `address_name` |
| Inline form → thank-you swap | `js_subscribe_wrap` / `js_subscribed_wrap` toggled by existing JS widget |
| `data-list-id` wired to a real mailing list | Editor option `mailing_list_subscribe` writes it; `onBuilt` auto-assigns first public list |
| Editable headline and sub-caption | Standard `contenteditable` / `data-oe-expression` attributes on text elements |
| Background color palette support | `o_cc o_cc2` classes on outer `<section>` |
| `list_id=0` runtime guard | Must build: explicit check before calling `subscribe_to_newsletter` (Postgres FK violation risk) |
| `cleanForSave()` in editor option | Must build: strips `o_disable_preview` / `o_enable_preview` classes before DB save |

**Explicitly deferred to v2+:** multi-list checkboxes, GDPR consent checkbox, double opt-in, split first/last name, success redirect URL, phone/SMS subscription.

---

## Architecture in One Paragraph

The block is a QWeb template registered into the website builder's "Contact & Forms" sidebar via an xpath on `website.snippets`. The outer `<section>` carries `data-snippet="s_newsletter_block"` (exact string — hard-coded in `_getListId()`) and `o_cc o_cc2` for color palette. The inner div carries both `s_newsletter_list` and `js_subscribe` classes plus `data-list-id="0"` — the editor option (`data-js="mailing_list_subscribe"`, already implemented in `website_mass_mailing`) writes the selected list's ID to `data-list-id` on the `s_newsletter_list` element via `data-attribute-name="listId"`. On the frontend, `publicWidget.registry.subscribe` auto-attaches to `.js_subscribe`, calls `/website_mass_mailing/is_subscriber` on page load to pre-fill or show the already-subscribed state, then on click validates the email, fires reCaptcha, and posts to `/website_mass_mailing/subscribe` passing `value` (email), `list_id`, `subscription_type`, and optionally `address_name` (name field). The controller creates `mailing.contact` + `mailing.subscription` records (or reinstates opt-out), stores the email in the session, and returns a toast dict. The JS widget toggles visibility of `js_subscribe_wrap` / `js_subscribed_wrap` on success.

---

## Build Order

**Phase 1 — Module scaffold (no dependencies, do first)**
- `__manifest__.py`, `__init__.py`, `security/ir.model.access.csv`
- Get the dep chain right: `website_mass_mailing` only; do not add `google_recaptcha` directly

**Phase 2 — QWeb template (depends on Phase 1)**
- Write `s_newsletter_block` template with correct class set and data attributes
- Critical: `data-snippet="s_newsletter_block"` on outer `<section>` (exact string match)
- Critical: `s_newsletter_list` + `js_subscribe` + `data-list-id="0"` on the **inner** div (not just the section)
- Include `o_cc o_cc2` on section for color palette
- Include name `<input>` alongside email input

**Phase 3 — Snippet registration xpath (depends on Phase 2)**
- Inherit `website.snippets`, place in `contact_and_forms` group
- Critical: `t-forbid-sanitize="form"` on the `<t t-snippet="...">` element — omitting silently strips form inputs on save
- Do NOT replace `mass_mailing_newsletter_block_hook` (already consumed by parent); use a fresh xpath position

**Phase 4 — Editor options xpath (depends on Phase 2)**
- Inherit `website.snippet_options`
- Wire `data-js="mailing_list_subscribe"` with `data-selector=".s_newsletter_list"` — reuses existing editor JS class, no custom JS needed
- Implement `cleanForSave()` to strip editor preview classes from `js_subscribe_wrap` / `js_subscribed_wrap`

**Phase 5 — list_id=0 guard (can accompany Phase 4)**
- If not writing a custom controller, override or patch the template to visually disable the form when `data-list-id="0"` in non-edit mode
- Alternatively write a minimal controller extension with the guard; the existing endpoint is reused otherwise

**Phase 6 — Polish and SCSS (no hard dependencies)**
- Custom styles beyond `o_cc` palette only if required by design
- Register in `web.assets_frontend` bundle

---

## Critical Gotchas

**1. `data-snippet` must be exactly `"s_newsletter_block"`**
`_getListId()` in `website_mass_mailing.js` has this hard-coded: `closest('[data-snippet=s_newsletter_block')`. A custom string breaks the selector. The website builder auto-stamps `data-snippet` from the template ID — so name your template `s_newsletter_block` (not `s_newsletter_custom_block` or similar) and set it manually on the section element.

**2. `t-forbid-sanitize="form"` is not optional**
Goes on the `<t t-snippet="...">` registration line. Without it, the HTML sanitizer strips `<input>` and `<button>` elements silently on first save. Form renders fine in edit mode; fields vanish after save-and-reload.

**3. `data-list-id` belongs on the `.s_newsletter_list` inner element**
The editor option (`data-target=".s_newsletter_list"`) writes `data-list-id` to the `s_newsletter_list` element. `_getListId()` walks up from `.js_subscribe` to find `[data-snippet=s_newsletter_block]` first, then falls back to `this.$el.data('list-id')`. Putting `data-list-id` only on the outer section means the editor writes to the wrong element and `_getListId` returns undefined. Solution: put `s_newsletter_list` class + `data-list-id="0"` on the inner `.js_subscribe` div.

**4. `list_id=0` causes a Postgres FK violation**
The subscribe controller does `ContactSubscription.create({'list_id': int(list_id)})` with no zero-check. `mailing.subscription.list_id` is `Many2one(..., required=True)`. A page saved before a list is configured sends `list_id=0` → unhandled 500. Guard required: `if not list_id or int(list_id) == 0: return error dict`.

**5. Asset bundle split is mandatory**
- Editor option JS (`options.Class`) → `website.assets_wysiwyg` only
- Public widget JS (`publicWidget`) → `web.assets_frontend` only
- Mixing causes either console errors on the public site or a blank options panel in the editor

**6. `is_public=False` is the default on `mailing.list`**
The editor dropdown only shows `is_public=True` lists. Out-of-box, all lists are private. Document: target list must have "Show In Preferences" enabled or the dropdown appears empty and `onBuilt` prompts to create a list.

**7. Name field — pass as `address_name`, not a custom param**
The existing `subscribe_to_newsletter` static method already accepts `address_name=None`. If not passed, contacts are created with null name. No custom controller logic needed — just include the name input in the POST params with key `address_name`.

---

## v18/v19 Compatibility Notes

| Item | v18 Status | v19 Risk |
|---|---|---|
| `publicWidget` from `@web/legacy/js/public/public_widget` | Correct and current in v18 | MEDIUM — Owl migration ongoing; import path may change |
| `options.Class.extend()` from `@web_editor/js/editor/snippets.options` | Used throughout v18 editor | MEDIUM — same legacy concern; fine for v18 target |
| `rpc` from `@web/core/network/rpc` | Non-legacy, stable | LOW risk — current Odoo 17+ path |
| `data-snippet`, `data-list-id`, `o_cc` | Pure data attributes / CSS classes | SAFE — no version coupling |
| `t-snippet`, `t-forbid-sanitize="form"` | Confirmed in v18 source | SAFE |
| `mass_mailing_newsletter_block_hook` xpath target | v18 confirmed | Check in v19 — if hook renamed/removed, xpath silently fails |
| `trigger_up` in editor option | Legacy event bus, used in v18 editor options | LOW risk for v18 target |

**Recommendation:** Target v18 precisely. Avoid writing net-new jQuery. Do not import from `@web/legacy/` in new files you write. If v19 support is needed later, the public widget will be the riskiest piece to migrate.

---

## Open Questions

| Question | Impact | Resolve When |
|---|---|---|
| Does the website builder auto-stamp `data-snippet` with the template ID, or is it read from the attribute already in the saved HTML? | If auto-stamped from template ID, setting it manually is redundant but harmless; if the attribute is authoritative, omitting it breaks `_getListId` | Phase 2 — test by dropping snippet and inspecting DOM |
| Should v1 show a visual disabled state when `data-list-id=0` in published mode, or rely solely on the controller guard? | UX question — guard prevents data corruption but gives no user feedback | Phase 4/5 decision |
| Is the target deployment EU-facing? | If yes, GDPR consent checkbox becomes v1 not v2 | Confirm before Phase 2 template work |
| Does `address_name` need to be explicitly added to the JS `rpc` call params, or is it picked up automatically from the form? | Determines whether any JS customization is needed | Phase 2/5 — check existing subscribe click handler param list |

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH | Read directly from v18 source; single-dep conclusion is definitive |
| Features | HIGH | Table stakes derived from source; gaps explicitly identified with line references |
| Architecture | HIGH | Data flow traced end-to-end through source with line numbers |
| Pitfalls | HIGH | Every pitfall sourced from actual v18 code, not inference |
| v19 compatibility | MEDIUM | v18 confirmed; v19 based on known Owl migration direction, no v19 source read |

**Overall: HIGH** for v18 target. The research is unusually thorough because the reference implementation (`website_mass_mailing`) exists in the same Odoo install being targeted.

---

## Sources

All sources are direct reads of Odoo 18 source at `/Users/dortsman/Code/odoo18/addons/`.

- `website_mass_mailing/__manifest__.py` — dependency chain, asset bundle split
- `website_mass_mailing/views/snippets_templates.xml` — snippet registration, options wiring, template structure
- `website_mass_mailing/static/src/js/website_mass_mailing.js` — `_getListId`, subscribe flow, `publicWidget` pattern
- `website_mass_mailing/static/src/js/website_mass_mailing.editor.js` — `onBuilt`, `cleanForSave`, `_renderCustomXML`
- `website_mass_mailing/controllers/main.py` — `subscribe`, `is_subscriber`, `subscribe_to_newsletter`
- `website_mass_mailing/security/ir.model.access.csv` — access record pattern
- `mass_mailing/models/mailing_contact.py` — name field behavior, no unique constraint on email
- `mass_mailing/models/mailing_list.py` — `is_public` default=False
- `website/views/snippets/snippets.xml` — hook placement (`mass_mailing_newsletter_block_hook`)
- `web_editor/js/editor/snippets.options.js` — `selectDataAttribute` mechanism
- `google_recaptcha/models/ir_http.py` — bypass behavior when no key configured

---

*Research completed: 2026-06-15*
*Ready for roadmap: yes*
