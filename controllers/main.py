from odoo import _
from odoo.http import route, request
from odoo.addons.website_mass_mailing.controllers.main import MassMailController


class NewsletterBlockController(MassMailController):

    @route('/website_mass_mailing/subscribe', type='json', website=True, auth='public')
    def subscribe(self, list_id, value, subscription_type, **post):
        # FORM-05: guard against unconfigured block — prevents FK violation on mailing.subscription
        if int(list_id) == 0:
            return {
                'toast_type': 'danger',
                'toast_content': _("Please configure a mailing list for this block."),
            }
        # Recaptcha: _verify_request_recaptcha_token pops recaptcha_token_response from
        # request.params as a side-effect — do NOT call super().subscribe() or it runs twice
        if not request.env['ir.http']._verify_request_recaptcha_token('website_mass_mailing_subscribe'):
            return {
                'toast_type': 'danger',
                'toast_content': _("Suspicious activity detected by Google reCaptcha."),
            }
        fname = self._get_fname(subscription_type)
        # FORM-02: extract name from **post kwargs; JS sends it as flat RPC param 'address_name'
        address_name = post.get('address_name') or None
        self.subscribe_to_newsletter(subscription_type, value, list_id, fname, address_name=address_name)
        return {
            'toast_type': 'success',
            'toast_content': _("Thanks for subscribing!"),
        }
