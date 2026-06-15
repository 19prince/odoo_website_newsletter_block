# Requirements: odoo_website_newsletter_block

**Defined:** 2026-06-15
**Core Value:** A newsletter CTA editors drop in once and never restyle — fully editable in the builder, always on-brand

## v1 Requirements

### Module

- [ ] **MODL-01**: Module installs on Odoo 18 without errors or warnings
- [ ] **MODL-02**: Module declares `website_mass_mailing` as its sole dependency in `__manifest__.py`

### Snippet

- [ ] **SNIP-01**: Newsletter block appears in the website builder sidebar under "Contact & Forms" and is draggable onto any page or blog post
- [ ] **SNIP-02**: Snippet registration includes `t-forbid-sanitize="form"` so form inputs survive page save
- [ ] **SNIP-03**: Block section carries `data-snippet="s_newsletter_block"` so the existing `_getListId()` JS resolves the mailing list correctly

### Content Editing

- [ ] **EDIT-01**: Editor can edit the headline text in-place in the website builder
- [ ] **EDIT-02**: Editor can edit the body text in-place in the website builder
- [ ] **EDIT-03**: Editor can edit the sub-caption text in-place in the website builder
- [ ] **EDIT-04**: Editor can edit the thank-you message in-place in the website builder
- [ ] **EDIT-05**: Block background color is configurable via the website builder's standard `o_cc` color section picker

### Mailing List

- [ ] **LIST-01**: Editor can select which `mailing.list` the block subscribes to via the snippet options panel (inheriting `data-js="mailing_list_subscribe"` from `website_mass_mailing`)
- [ ] **LIST-02**: `data-list-id` is written to the `.s_newsletter_list` inner element (not the outer section) so the editor option wiring resolves correctly

### Form & Submission

- [ ] **FORM-01**: Visitor can enter their full name and email address and submit the form
- [ ] **FORM-02**: Name field value is passed as `address_name` to the existing `subscribe_to_newsletter()` endpoint so `mailing.contact.name` is populated
- [ ] **FORM-03**: Submitted visitor is created as a `mailing.contact` record linked to the configured `mailing.list`
- [ ] **FORM-04**: On successful submission, the form area is replaced by the thank-you message without a page reload (existing `js_subscribe_wrap` / `js_subscribed_wrap` CSS class toggle)
- [ ] **FORM-05**: Block with no configured mailing list (`data-list-id="0"`) does not allow form submission — prevents a Postgres FK violation on `mailing.subscription`

### Compatibility

- [ ] **COMPAT-01**: Module uses no version-specific JS APIs — no direct `publicWidget` patching, no `useService` Owl imports in frontend code
- [ ] **COMPAT-02**: Module is verified working on Odoo 18 local dev environment

## v2 Requirements

### GDPR

- **GDPR-01**: Optional consent checkbox ("I agree to receive updates") configurable per block — required for EU-facing deployments
- **GDPR-02**: Consent checkbox wired to block submit guard (form cannot submit without checking)

### Design

- **DSGN-01**: Image background support (photo behind the block, like hero sections)
- **DSGN-02**: Custom SCSS variables for non-`o_cc` color customization

### Subscription

- **SUB-01**: Double opt-in flow (confirmation email before contact is fully subscribed) — currently delegated to mailing list settings, not surfaced in block

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom Python controller | Existing `/website_mass_mailing/subscribe` endpoint handles dedup, opt-out, reCaptcha — rebuilding adds risk with no benefit |
| Custom frontend JS widget | `publicWidget.registry.subscribe` auto-binds to `.js_subscribe` class — no new widget needed |
| Split first/last name fields | Single `name` field matches reference design; maps directly to `mailing.contact.name` |
| Image background | Not needed for newsletter CTA use case; adds JS complexity |
| reCaptcha wiring | Inherited automatically from existing widget and controller |
| Redirect thank-you page | Inline swap is simpler and keeps reader on page |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MODL-01 | Phase 1 | Pending |
| MODL-02 | Phase 1 | Pending |
| SNIP-01 | Phase 2 | Pending |
| SNIP-02 | Phase 2 | Pending |
| SNIP-03 | Phase 2 | Pending |
| EDIT-01 | Phase 2 | Pending |
| EDIT-02 | Phase 2 | Pending |
| EDIT-03 | Phase 2 | Pending |
| EDIT-04 | Phase 2 | Pending |
| EDIT-05 | Phase 2 | Pending |
| LIST-01 | Phase 3 | Pending |
| LIST-02 | Phase 2 | Pending |
| FORM-01 | Phase 2 | Pending |
| FORM-02 | Phase 3 | Pending |
| FORM-03 | Phase 3 | Pending |
| FORM-04 | Phase 2 | Pending |
| FORM-05 | Phase 3 | Pending |
| COMPAT-01 | Phase 1 | Pending |
| COMPAT-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-15*
*Last updated: 2026-06-15 after initial definition*
