# odoo_website_newsletter_block

An Odoo 18 website builder snippet that lets editors drop a styled newsletter subscription block onto any page or blog post. Subscribers land in Odoo's existing Email Marketing stack (`mailing.list` / `mailing.contact`).

## Features

- Drag-and-drop snippet from the **Contact & Forms** group in the website builder
- Inline signup form: **Name** + **Email** + **Join** button
- Mailing list selector in the snippet options panel (no hard-coded list ID)
- Falls back to the first public mailing list when no list is selected (safe default)
- Inline success swap on subscription — no page reload
- All text zones (headline, body, sub-caption, success message) editable in-place

## Requirements

- Odoo **18.0**
- Module dependency: `website_mass_mailing` (installed by default with the Website + Email Marketing apps)

## Installation

1. Copy (or clone) `odoo_website_newsletter_block/` into your Odoo addons path.
2. Restart the Odoo server.
3. Go to **Settings → Apps**, search for **Website Newsletter Block**, and install it.

## Deployment notes

### Mailing list dropdown not appearing?

After dropping the Newsletter Block onto a page, **save the page once** before opening the snippet options panel. The mailing list selector (`we-select`) only populates after the block has been saved and the options template re-renders against the saved DOM. This is a one-time step per block instance.

### Selecting a mailing list

1. Click the Newsletter Block to select it.
2. Open the **Options** panel (right sidebar).
3. Under **Newsletter**, pick the mailing list you want subscribers added to.
4. Save the page.

If no list is selected (value stays `0`), the controller automatically uses the first public mailing list. Make sure at least one `mailing.list` with **Published** = true exists before going live.

### reCAPTCHA

The subscribe endpoint respects Odoo's built-in reCAPTCHA / Cloudflare Turnstile integration. No extra configuration is needed — it inherits whatever you have configured in **Website → Configuration → Settings → Integrations**.

## How it works

| Layer | File | What it does |
|---|---|---|
| Template | `views/snippets/snippets.xml` | Snippet body + sidebar registration + options panel |
| Controller | `controllers/main.py` | Inherits `MassMailController.subscribe`; resolves `list_id=0` → first public list; captures `address_name` and writes it to `mailing.contact` |
| JS widget | `static/src/js/newsletter_block.js` | `.include()` patch on the upstream `subscribe` widget; sends `address_name` in the RPC call |

## Backlog / Known Gaps

- **GDPR consent checkbox** (GDPR-01, GDPR-02): Optional per-block consent checkbox with a configurable label and a submit guard. See the [open issue](../../issues) for design details. Required for EU-facing deployments.

## License

LGPL-3 — same as Odoo community modules.
