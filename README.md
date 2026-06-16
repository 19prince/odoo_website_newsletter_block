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

## Customizing the snippet

All default text and styling lives in `views/snippets/snippets.xml`. Changes there affect every **new** instance dropped onto a page — they do not retroactively update blocks already saved in existing pages.

### Default copy

Find these strings in `snippets.xml` and replace them before deploying:

| Zone | Default text | Where in the file |
|---|---|---|
| Headline | `Enjoying this? Get the next one in your inbox.` | `<h2>` inside `s_newsletter_block` |
| Body | `I email when I publish something new. Usually 2 to 4 emails a month. Unsubscribe anytime.` | `<p class="text-muted mb-4">` |
| Sub-caption | `Join 1000+ readers. Unsubscribe anytime.` | `<p class="small text-muted mt-2 mb-0">` |
| Success message | `Thanks for subscribing!` | `<p class="h4-fs text-success">` inside `.js_subscribed_wrap` |
| Button label | `Join my list` | `<a ... class="... js_subscribe_btn">` |
| Name placeholder | `Your name` | `<input ... name="name" placeholder="Your name">` |
| Email placeholder | `Your email` | `<input ... name="email" placeholder="Your email">` |

All of these are also editable in-place via the website builder after the block is dropped — the template values are just the starting point.

### Button colour

The button uses `btn-primary`, which inherits whatever primary colour is set in your Odoo theme (**Website → Configuration → Theme** or the theme editor). To hardcode a specific colour instead, swap the class:

```xml
<!-- Theme colour (default) -->
class="btn btn-primary rounded-pill px-4 w-100 js_subscribe_btn o_submit"

<!-- Bootstrap contextual alternatives -->
class="btn btn-secondary ..."   <!-- secondary theme colour -->
class="btn btn-dark ..."        <!-- always dark regardless of theme -->
class="btn btn-outline-primary ..."  <!-- outlined variant -->
```

### Card appearance

The white card is controlled by Bootstrap utility classes on the `<div class="bg-light rounded-4 shadow p-4 p-lg-5">` wrapper in `snippets.xml`:

| Class | Effect |
|---|---|
| `bg-light` | Light grey/white fill — swap for `bg-white`, `bg-dark`, or a theme colour class |
| `rounded-4` | Corner radius — `rounded-3` is subtler, `rounded-0` removes it |
| `shadow` | Drop shadow — `shadow-sm` is lighter, remove to eliminate |
| `p-4 p-lg-5` | Padding (medium on mobile, large on desktop) |

### Cloudflare Turnstile widget

The Turnstile widget size and position are controlled by `static/src/css/newsletter_block.css`. The `transform: scale(0.78)` shrinks the widget; adjust the value to taste. `margin-bottom: -14px` compensates for the whitespace the scale leaves behind — recalculate it as `-(65px × (1 - scale))` if you change the scale value.

### Deploying changes

After editing any file in this module:

1. Copy the updated module to your Odoo addons path (or push to the GitHub repo your Odoo.sh instance tracks).
2. Restart the Odoo server (Odoo.sh does this automatically on push to `main`).
3. Go to **Settings → Apps → Update Apps List**, find the module, and click **Upgrade** — or run `odoo-bin -u odoo_website_newsletter_block`.

> **Odoo.sh**: push to your production branch. The server restarts automatically. No manual upgrade step is needed for template or CSS changes; JS and Python changes also pick up on restart.

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
