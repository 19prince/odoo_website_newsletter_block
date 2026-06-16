/** @odoo-module **/
// Patch the upstream subscribe widget to include the name field value
// as 'address_name' in the RPC call to /website_mass_mailing/subscribe.
// Uses .include() (not .extend()) to patch the prototype in-place so all
// existing bindings pick up the change (extend creates a new unregistered class).
import publicWidget from "@web/legacy/js/public/public_widget";
import { rpc } from "@web/core/network/rpc";
import { _t } from "@web/core/l10n/translation";

publicWidget.registry.subscribe.include({
    // Upstream inserts the Turnstile widget *after* .js_subscribe, which places it
    // outside our .bg-light card. Move it inside so it sits within the card.
    _updateSubscribeControlsStatus(isSubscriber) {
        this._super(...arguments);
        if (!isSubscriber && this._turnstile) {
            const sibling = this.el.nextElementSibling;
            if (sibling?.classList.contains('s_turnstile')) {
                this.el.appendChild(sibling);
            }
        }
    },

    _onSubscribeClick: async function () {
        const nameInputEl = this.el.querySelector('input[name="name"]');
        const addressName = nameInputEl ? nameInputEl.value.trim() : '';

        const self = this;
        const inputName = this.$('input').attr('name');
        const $input = this.$(".js_subscribe_value:visible, .js_subscribe_email:visible");

        if (inputName === 'email' && $input.length && !$input.val().match(/.+@.+/)) {
            this.$el.addClass('o_has_error').find('.form-control').addClass('is-invalid');
            return false;
        }
        this.$el.removeClass('o_has_error').find('.form-control').removeClass('is-invalid');

        const tokenObj = await this._recaptcha.getToken('website_mass_mailing_subscribe');
        if (tokenObj.error) {
            self.notification.add(tokenObj.error, {
                type: 'danger',
                title: _t("Error"),
                sticky: true,
            });
            return false;
        }
        rpc('/website_mass_mailing/subscribe', {
            'list_id': this._getListId(),
            'value': $input.length ? $input.val() : false,
            'subscription_type': inputName,
            'address_name': addressName,
            recaptcha_token_response: tokenObj.token,
            turnstile_captcha: this.el.parentElement.querySelector('input[name="turnstile_captcha"]')?.value,
        }).then(function (result) {
            if (result.toast_type === 'success') {
                self._updateSubscribeControlsStatus(true);
                const $popup = self.$el.closest('.o_newsletter_modal');
                if ($popup.length) { $popup.modal('hide'); }
            }
            self.notification.add(result.toast_content, {
                type: result.toast_type,
                title: result.toast_type === 'success' ? _t('Success') : _t('Error'),
                sticky: true,
            });
        });
    },
});
