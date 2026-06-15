# odoo_website_newsletter_block

A website builder snippet that lets editors drop a styled newsletter subscription block into any page or blog post. Subscribers land in Odoo's existing email marketing stack.

## Language

**Newsletter Block**
The draggable website builder snippet. A self-contained section containing headline, body text, an inline signup form, and a sub-caption. Fully editable in-place after being dropped onto a page.
_Avoid_: Subscription Widget, Newsletter Section, Email Capture Block

**Mailing List**
The `mailing.list` record that submitted contacts are added to. Configured once per block instance via the website builder's snippet options panel.
_Avoid_: Newsletter List, Email List, Subscriber List

**Subscriber**
A `mailing.contact` record created or matched when the signup form is submitted.
_Avoid_: Contact, Lead, User

**Inline Form**
The horizontal `[Name] [Email] [Button]` row inside the Newsletter Block that collects subscriber details.
_Avoid_: Signup Form, Subscription Form, Newsletter Form

**Sub-caption**
The small line of text below the Inline Form (e.g. "Join 1000+ readers. Unsubscribe anytime."). Editable in the builder.
_Avoid_: Footer Text, Disclaimer, Fine Print

**Success State**
The thank-you message shown in place of the Inline Form after a successful submission. Toggled client-side; no page reload.
_Avoid_: Confirmation Message, Thank You Page
