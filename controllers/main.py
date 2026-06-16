from odoo import _
from odoo.http import route, request
from odoo.addons.website_mass_mailing.controllers.main import MassMailController


class NewsletterBlockController(MassMailController):

    @route('/odoo_newsletter_block/health', type='json', auth='user')
    def health(self, **post):
        """Diagnostic: confirms our controller is loaded and registered."""
        return {'status': 'ok', 'module': 'odoo_website_newsletter_block'}

    @route()
    def subscribe(self, list_id, value, subscription_type, **post):
        if int(list_id) == 0:
            first_list = request.env['mailing.list'].sudo().search(
                [('is_public', '=', True)], limit=1)
            if not first_list:
                return {
                    'toast_type': 'danger',
                    'toast_content': _("Please configure a mailing list for this block."),
                }
            list_id = first_list.id
        # _verify_request_recaptcha_token pops recaptcha_token_response from request.params as a
        # side-effect — don't call super().subscribe() or it runs the token check a second time
        if not request.env['ir.http']._verify_request_recaptcha_token('website_mass_mailing_subscribe'):
            return {
                'toast_type': 'danger',
                'toast_content': _("Suspicious activity detected by Google reCaptcha."),
            }
        fname = self._get_fname(subscription_type)
        address_name = post.get('address_name') or None
        self.subscribe_to_newsletter(subscription_type, value, list_id, fname, address_name=address_name)
        return {
            'toast_type': 'success',
            'toast_content': _("Thanks for subscribing!"),
        }

    def subscribe_to_newsletter(self, subscription_type, value, list_id, fname, address_name=None, **kwargs):
        """Belt-and-suspenders: guard list_id=0 and capture address_name even if subscribe()
        override is bypassed (e.g. parent route wins but self is NewsletterBlockController)."""
        if int(list_id) == 0:
            first_list = request.env['mailing.list'].sudo().search(
                [('is_public', '=', True)], limit=1)
            if not first_list:
                return
            list_id = first_list.id
        super().subscribe_to_newsletter(subscription_type, value, list_id, fname)
        # FORM-02: set name on mailing.contact after creation; fall back to raw request param
        name = address_name or request.params.get('address_name') or None
        if name and subscription_type == 'email':
            contact = request.env['mailing.contact'].sudo().search(
                [('email', '=', value)], limit=1)
            if contact and not contact.name:
                contact.write({'name': name})
