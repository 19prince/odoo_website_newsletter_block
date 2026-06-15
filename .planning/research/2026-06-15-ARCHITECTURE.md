# Architecture Research: odoo_website_newsletter_block

**Source verified:** All patterns read directly from Odoo 18 source at
`/Users/dortsman/Code/odoo18/addons/website_mass_mailing/`

---

## Component Map

| File | Responsibility | Talks To |
|------|---------------|----------|
| `views/snippets_templates.xml` | QWeb templates for snippet HTML + snippet options XML | Inherits `website.snippets` and `website.snippet_options` |
| `static/src/js/website_mass_mailing.js` | Frontend public widget — checks subscription state on page load, handles subscribe button click, toggles success/error state | Calls `/website_mass_mailing/is_subscriber` (JSON RPC) and `/website_mass_mailing/subscribe` (JSON RPC); reads `data-list-id` from DOM |
| `static/src/js/website_mass_mailing.editor.js` | Editor-mode snippet option class — populates the mailing list `we-select` dropdown, handles onBuilt (auto-assigns first list), cleanForSave | ORM call to `mailing.list` `name_search`; writes `data-list-id` attribute on `$target` |
| `static/src/snippets/s_popup/options.js` | Editor option for popup template switcher | Extends `SelectTemplate` option; bound by `data-js="NewsletterLayout"` |
| `static/src/snippets/s_popup/000.js` | Frontend popup widget override — blocks popup display if visitor is already subscribed | Extends `website/snippets/s_popup/000` |
| `controllers/main.py` | HTTP controller — two JSON endpoints: `is_subscriber` and `subscribe` | Queries/writes `mailing.subscription` and `mailing.contact` via `sudo()`; reads `request.session` for cached email |
| `data/ir_model_data.xml` | Whitelists `mailing.contact` fields for website forms; sets `website_form_key` and `website_form_access` | `ir.model` record on `mailing.contact` |
| `security/ir.model.access.csv` | Grants website_designer read on `mailing.list` | Only read access; controllers use `sudo()` for writes |
| `static/src/js/mass_mailing_form_editor.js` | Registers the `create_mailing_contact` form editor preset (name, email, list_ids fields) | `FormEditorRegistry` — used when snippet uses the full `s_website_form` variant, not the inline subscribe form |
| `__manifest__.py` | Declares asset bundles and data files | `web.assets_frontend` (runtime JS/SCSS), `website.assets_wysiwyg` (editor JS/SCSS), `data/` (XML) |

**Two separate submission paths exist in the parent module (critical to understand):**

1. **Inline subscribe form** (`s_newsletter_subscribe_form` template, class `js_subscribe`) — the lightweight single-email-input form. Posts via `website_mass_mailing.js` → `/website_mass_mailing/subscribe` JSON RPC.
2. **Full website form** (`s_newsletter_block_form_template`) — uses `s_website_form` with name + email + checkbox fields. Posts via the generic `/website/form/` controller to create `mailing.contact` records directly. The `mass_mailing_form_editor.js` + `data/ir_model_data.xml` enable this path.

For `odoo_website_newsletter_block`, the inline form path is the primary one.

---

## Data Flow

**Page load (is_subscriber check):**

```
1. Browser loads page with .js_subscribe element
2. publicWidget "subscribe" starts → reads input[name] for subscription_type ("email")
3. JSON RPC → /website_mass_mailing/is_subscriber
   params: { list_id: <from data-list-id>, subscription_type: "email" }
4. Controller:
   a. If logged-in user: value = request.env.user.email
   b. Else: value = request.session.get('mass_mailing_email')
   c. Searches mailing.subscription [list_id, contact.email == value, opt_out=False]
   d. Returns { is_subscriber: bool, value: email_string_or_null }
5. JS _updateView():
   - pre-fills email input with value (if returning visitor)
   - toggles .js_subscribe_wrap (d-none) vs .js_subscribed_wrap (d-none) based on is_subscriber
```

**Form submit (subscribe click):**

```
1. User types email, clicks .js_subscribe_btn
2. JS validates email format (regex /.+@.+/)
3. JS calls this._recaptcha.getToken('website_mass_mailing_subscribe')
   - If reCaptcha error: shows notification, aborts
4. JSON RPC → /website_mass_mailing/subscribe
   params: {
     list_id: <from data-list-id on .s_newsletter_block section OR .js_subscribe element>,
     value: <email input value>,
     subscription_type: "email",
     recaptcha_token_response: <token>
   }
5. Controller subscribe():
   a. Verifies reCaptcha token via ir.http._verify_request_recaptcha_token()
   b. Calls subscribe_to_newsletter(subscription_type, value, list_id, fname)
   c. subscribe_to_newsletter():
      - Parses email via tools.parse_contact_from_email(value) → (name, email)
      - Searches mailing.subscription [list_id, contact.email == email]
      - If no subscription: searches mailing.contact by email
        → creates contact if not found: Contacts.create({'name': name, 'email': email})
        → creates subscription: ContactSubscription.create({contact_id, list_id})
      - If subscription exists with opt_out=True: sets opt_out = False
      - Sets request.session['mass_mailing_email'] = email (cache for next page load)
   d. Returns { toast_type: 'success'|'danger', toast_content: str }
6. JS result handler:
   - On success: calls _updateSubscribeControlsStatus(true)
     → disables input, hides .js_subscribe_wrap, shows .js_subscribed_wrap
     → if inside .o_newsletter_modal popup: calls modal('hide')
   - Shows notification toast (success or error)
```

**list_id resolution in JS (important edge case):**

```javascript
// _getListId() in website_mass_mailing.js line 112-114
_getListId: function () {
    return this.$el.closest('[data-snippet=s_newsletter_block').data('list-id')
        || this.$el.data('list-id');
},
```

The `data-list-id` attribute lives on the **section** (`s_newsletter_block`) not on the inner `js_subscribe` div. The JS walks up to the section first, falls back to the element itself. This means the module's section element must carry `data-list-id`.

---

## Snippet Registration Flow

**How a QWeb template becomes a draggable item in the builder sidebar:**

```
1. website.snippets (website/views/snippets/snippets.xml) defines placeholder hooks:
   - Line 344: <t id="mass_mailing_newsletter_block_hook"/>  ← in #snippet_structure (full sections)
   - Line 383: <t id="mass_mailing_newsletter_hook"/>         ← in #snippet_content (inner elements)

2. website_mass_mailing/views/snippets_templates.xml inherits website.snippets:
   <template id="snippets" inherit_id="website.snippets">
     <xpath expr="//t[@id='mass_mailing_newsletter_block_hook']" position="replace">
       <t t-snippet="website_mass_mailing.s_newsletter_block"
          string="Newsletter Block"
          t-forbid-sanitize="form"
          group="contact_and_forms">
         <keywords>form, updates, digest...</keywords>
       </t>
     </xpath>
   </template>

3. t-snippet="website_mass_mailing.s_newsletter_block" tells the builder:
   - The draggable thumbnail represents this QWeb template external ID
   - The builder renders that template when dragged onto the page
   - group="contact_and_forms" places it in the Contact & Forms sidebar category

4. t-thumbnail is optional here (no custom thumbnail set on the block registration).
   For a custom thumbnail: t-thumbnail="/your_module/static/src/img/snippets_thumbs/your_thumb.svg"
   The module ships one at: static/src/img/snippets_thumbs/s_newsletter_block.svg

5. t-forbid-sanitize="form" prevents the website's HTML sanitizer from stripping form elements.
```

**For the new module:** Inherit `website.snippets`, replace the relevant hook or insert into the xpath for `contact_and_forms` group. The new module defines its own template ID and registers `t-snippet="odoo_website_newsletter_block.s_newsletter_block"`.

---

## Snippet Options Wiring

**How `we-select` in snippet_options connects to `data-list-id` on the DOM element:**

```
1. XML side (in inherit_id="website.snippet_options"):

   <div data-js="mailing_list_subscribe"
        data-selector=".s_newsletter_list"
        data-exclude=".s_newsletter_block .s_newsletter_list, ...">
     <we-select string="Newsletter"
                data-attribute-name="listId"
                data-dependencies="!form_opt">
     </we-select>
   </div>

   - data-js="mailing_list_subscribe" → loads options.registry.mailing_list_subscribe
   - data-selector=".s_newsletter_list" → this option panel activates when that class is selected
   - data-attribute-name="listId" → maps to dataset.listId on the $target element
     which is the HTML attribute data-list-id (camelCase ↔ kebab-case conversion is automatic
     via the DOM dataset API: dataset.listId === element.getAttribute('data-list-id'))

2. JS side (website_mass_mailing.editor.js):

   _renderCustomXML(uiFragment):
     → ORM call to mailing.list name_search([['is_public','=',true]])
     → for each list: creates <we-button data-select-data-attribute="[id]">[name]</we-button>
     → appends to the we-select[data-attribute-name="listId"]

3. When user picks a mailing list in the sidebar panel:
   → selectDataAttribute() in snippets.options.js (line 3560-3562) fires:
       this.$target[0].dataset[params.attributeName] = value;
       // i.e. element.dataset.listId = "42"
       // which sets data-list-id="42" on the DOM element

4. The $target here is determined by data-selector + data-target on the option div.
   For the newsletter block:
   - data-selector=".s_newsletter_list" matches the section element
   - The section element IS the $target that gets data-list-id written to it

5. onBuilt() auto-assigns the first available mailing list if any exist:
       this.$target.attr("data-list-id", this.mailingLists[0][0]);
   If no lists exist: shows a ConfirmationDialog prompting to create one.

6. Frontend JS reads it back: this.$el.closest('[data-snippet=s_newsletter_block').data('list-id')
```

**Concrete chain for the new module:**
- Section element must have class `s_newsletter_list` for the option panel to bind
- Section also needs `data-list-id="0"` as initial placeholder
- The `we-select` with `data-attribute-name="listId"` writes to `dataset.listId` which is `data-list-id`
- No custom JS needed for the picker — the existing `mailing_list_subscribe` option class handles it
- The new module only needs to include the option div in its `inherit_id="website.snippet_options"` block

---

## Build Order

Components have hard dependencies. Build in this sequence:

**Phase 1: Module scaffold (no dependencies)**
- `__manifest__.py` — declares depends, data, assets
- `__init__.py` + `controllers/__init__.py`
- `security/ir.model.access.csv` — read access on `mailing.list` for website designers

**Phase 2: QWeb templates (depends on Phase 1)**
- `views/snippets_templates.xml` — the snippet template (`s_newsletter_block`) must exist before:
  - The snippet can be registered in the sidebar
  - The options template can reference it
  - Frontend JS can find elements to bind to
- Template must include `data-list-id="0"` on the section and class `s_newsletter_list`
- Section must carry `o_cc o_cc2` (or other `o_cc` class) for the color palette to apply without custom JS

**Phase 3: Snippet registration (depends on Phase 2)**
- The `inherit_id="website.snippets"` xpath in the same XML file
- Must use `position="replace"` on the hook (not `position="after"` — the hook is a placeholder)
- `t-forbid-sanitize="form"` required if snippet contains any `<input>` or `<form>` elements

**Phase 4: Snippet options XML (depends on Phase 2)**
- `inherit_id="website.snippet_options"` block in the same XML file
- The `data-js="mailing_list_subscribe"` div — references JS class from `website_mass_mailing`
- This class is already loaded by `website_mass_mailing` module; no need to redeclare
- If adding a custom option panel: `data-selector` must match the class on the template section

**Phase 5: Controller (depends on Phase 1; can be built before templates)**
- `controllers/main.py` — can inherit `website_mass_mailing.controllers.main.MassMailController`
- If reusing the existing `/website_mass_mailing/subscribe` endpoint: no new controller needed at all
- Only need a custom controller if adding new behavior (e.g., different subscription logic)

**Phase 6: Frontend JS (depends on Phase 2 + 5)**
- `static/src/js/` — only needed for behavior not covered by existing `website_mass_mailing.js`
- The existing `publicWidget.registry.subscribe` (selector `.js_subscribe`) covers all subscribe interaction
- No custom frontend JS needed if the template uses the same CSS classes (`js_subscribe`, `js_subscribe_btn`, `js_subscribe_value`, `js_subscribed_wrap`, `js_subscribe_wrap`)

**Phase 7: SCSS (no hard dependencies; can be built any time after Phase 1)**
- `static/src/scss/` — color customizations beyond `o_cc` palette
- The `o_cc o_cc2` classes on the section handle theme color adaptation without any custom SCSS
- Register in `web.assets_frontend` bundle in manifest

**Minimum viable build order for a working snippet:**
1. Manifest + security CSV
2. QWeb template with correct CSS classes and `data-list-id="0"`
3. Snippet registration xpath (inherit website.snippets)
4. Snippet options xpath (inherit website.snippet_options, reuse mailing_list_subscribe data-js)

Everything else (controller, custom JS, custom SCSS) is optional if reusing the parent module's infrastructure.

---

## Key Source References

| File | Lines | What it shows |
|------|-------|---------------|
| `views/snippets_templates.xml` | 7-18 | Snippet registration xpath replacing the hook; `t-snippet`, `group`, `t-forbid-sanitize` |
| `views/snippets_templates.xml` | 43-49 | `s_newsletter_block` template — `o_cc o_cc2`, `data-list-id="0"`, `s_newsletter_list` class |
| `views/snippets_templates.xml` | 198-223 | `newsletter_subscribe_options` — full option panel wiring; `data-js`, `data-selector`, `we-select`, `data-attribute-name="listId"` |
| `static/src/js/website_mass_mailing.js` | 112-114 | `_getListId()` — walks up to section for `data-list-id` |
| `static/src/js/website_mass_mailing.js` | 47-52 | Page load: `is_subscriber` RPC call |
| `static/src/js/website_mass_mailing.js` | 123-163 | Click handler: validates email, gets reCaptcha token, posts to `subscribe`, toggles UI |
| `static/src/js/website_mass_mailing.editor.js` | 88-110 | `_renderCustomXML` — ORM call to populate `we-select` with mailing list buttons |
| `static/src/js/website_mass_mailing.editor.js` | 17-39 | `onBuilt` — auto-assigns first mailing list or prompts to create one |
| `controllers/main.py` | 35-48 | `subscribe` endpoint — reCaptcha check, calls `subscribe_to_newsletter`, returns toast dict |
| `controllers/main.py` | 50-72 | `subscribe_to_newsletter` — creates `mailing.contact` + `mailing.subscription`; re-opts-in if opt_out |
| `controllers/main.py` | 11-21 | `is_subscriber` endpoint — checks session email for public users |
| `web_editor/snippets.options.js` | 3560-3562 | `selectDataAttribute` — writes `dataset[attributeName] = value`; the mechanism behind `data-attribute-name="listId"` |
| `website/views/snippets/snippets.xml` | 344-345 | Hook placement (`mass_mailing_newsletter_block_hook`) in `contact_and_forms` group |
| `data/ir_model_data.xml` | 4-23 | `website_form_key` and field whitelist for the full form variant (needed if using `s_website_form` path) |

---

## Odoo 18/19 Compatibility Notes

- `publicWidget` from `@web/legacy/js/public/public_widget` — this is a legacy API. Odoo 18 still uses it for website frontend widgets. For Odoo 19 check whether this has moved to an OWL component. The selector-based widget pattern (`selector: ".js_subscribe"`) is used throughout Odoo 18.
- `options.Class.extend` in the editor JS — this is the web_editor option pattern, stable across 17/18.
- `rpc` is imported from `@web/core/network/rpc` (not the legacy `ajax` service) — this is the Odoo 17+ pattern.
- The `o_cc` / `o_cc2` color palette system is stable across 16-18. No JS needed; it's pure SCSS variable inheritance.
- `t-snippet-call` (used in the block template to embed the form) is a QWeb directive for inline template inclusion — available in Odoo 16+.
