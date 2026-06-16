{
    'name': 'Website Newsletter Block',
    'version': '18.0.1.0.0',
    'category': 'Website/Website',
    'summary': 'Newsletter subscription block for the website builder',
    'depends': ['website_mass_mailing'],
    'data': [
        'security/ir.model.access.csv',
        'views/snippets/snippets.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'odoo_website_newsletter_block/static/src/js/newsletter_block.js',
            'odoo_website_newsletter_block/static/src/css/newsletter_block.css',
        ],
    },
    'installable': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
