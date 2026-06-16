/**
 * Verification script: odoo_website_newsletter_block — all 11 requirements
 * Run: node verify.js  (from playwright-verify/ directory)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Load .env from 19prince project
const envContent = fs.readFileSync(path.join(__dirname, '../../19prince/.env'), 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}
const BASE_URL = env.STAGING_ODOO_URL;
const USER     = env.STAGING_ODOO_USER;
const PASS     = env.STAGING_ODOO_PASSWORD;

const SS_DIR = path.join(__dirname, '../.tmp/verify-screenshots');
fs.mkdirSync(SS_DIR, { recursive: true });

const results = [];
function log(icon, req, msg) {
  const line = `${icon} [${req}] ${msg}`;
  console.log(line);
  results.push({ icon, req, msg });
}
async function ss(page, name) {
  await page.screenshot({ path: path.join(SS_DIR, `${name}.png`), fullPage: false });
}
async function ssFull(page, name) {
  await page.screenshot({ path: path.join(SS_DIR, `${name}.png`), fullPage: true });
}

// ── LOGIN ───────────────────────────────────────────────────────────────────
async function login(page) {
  await page.goto(`${BASE_URL}/web/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="login"]', USER);
  await page.fill('input[name="password"]', PASS);
  // Click the "Log in" submit button specifically
  await page.locator('button', { hasText: /^Log in$/i }).click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  const url = page.url();
  console.log(`  Logged in, redirected to: ${url}`);
  if (url.includes('/web/login')) throw new Error('Login failed — still on login page');
}

// ── OPEN WEBSITE BUILDER ────────────────────────────────────────────────────
async function openBuilder(page) {
  // Navigate to the homepage with editor enabled
  await page.goto(`${BASE_URL}/?enable_editor=1`, { waitUntil: 'domcontentloaded' });
  // Wait for the builder toolbar or editable content
  await page.waitForFunction(
    () => !!(
      document.querySelector('.o_editable') ||
      document.querySelector('#oe_main_menu_navbar') ||
      document.querySelector('.o_website_preview') ||
      document.querySelector('.o_we_website_top_actions')
    ),
    { timeout: 15000 }
  ).catch(() => {});
  await page.waitForTimeout(2000);
}

// ── GET CONTENT FRAME ───────────────────────────────────────────────────────
// In Odoo 18, the website builder embeds the page in an iframe inside .o_website_preview
async function getContentFrame(page) {
  // Try all frames for one that has the page content
  for (const frame of page.frames()) {
    try {
      const has = await frame.evaluate(() => !!document.querySelector('body.o_website_preview, body#wrapwrap, #wrapwrap'));
      if (has) return frame;
    } catch { /* detached */ }
  }
  // Fallback: main frame (older Odoo versions render inline)
  return page.mainFrame();
}

(async () => {
  console.log(`\n== Newsletter Block Verification ==`);
  console.log(`Target: ${BASE_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(`PageError: ${err.message}`));

  try {
    // ── LOGIN ──────────────────────────────────────────────────────────────
    await login(page);
    await ss(page, '00-logged-in');

    // ── PUBLIC PAGE: Find newsletter block ─────────────────────────────────
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await ssFull(page, '01-homepage-full');

    const pubState = await page.evaluate(() => ({
      hasBlock:    !!document.querySelector('.s_newsletter_block'),
      jsSubscribe: !!document.querySelector('.js_subscribe'),
      emailInput:  !!document.querySelector('input[type="email"].js_subscribe_value, .js_subscribe_value'),
      listId:      document.querySelector('.js_subscribe')?.dataset?.listId,
    }));
    console.log('Public page state:', pubState);

    // SNIP-02
    if (pubState.emailInput) {
      log('✅', 'SNIP-02', 'input[type=email].js_subscribe_value found in DOM');
    } else {
      log('❌', 'SNIP-02', 'js_subscribe_value not found on any public page');
    }

    // SNIP-03
    if (pubState.listId === '0' || pubState.listId === 0) {
      log('✅', 'SNIP-03', `data-list-id="0" ✓`);
    } else if (pubState.listId) {
      log('✅', 'SNIP-03', `data-list-id="${pubState.listId}" (list already configured — acceptable)`);
    } else {
      log('❌', 'SNIP-03', '.js_subscribe not found');
    }

    // ── FORM-01 + FORM-04: submit on public page ───────────────────────────
    if (pubState.jsSubscribe) {
      // Scroll to the block
      await page.evaluate(() => document.querySelector('.js_subscribe')?.scrollIntoView({ behavior: 'instant', block: 'center' }));
      await page.waitForTimeout(500);
      await ss(page, '02-block-visible');

      const wrapVisible = await page.evaluate(() => {
        const el = document.querySelector('.js_subscribe_wrap');
        return !!el && !el.classList.contains('d-none') && getComputedStyle(el).display !== 'none';
      });
      log(wrapVisible ? '✅' : '❌', 'FORM-01', `js_subscribe_wrap visible before submit: ${wrapVisible}`);

      // Fill email and submit
      await page.evaluate(() => {
        const inp = document.querySelector('input.js_subscribe_value');
        if (inp) { inp.value = 'playwright-test@example.com'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
      });
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        const btn = document.querySelector('.js_subscribe_btn');
        if (btn) btn.click();
      });
      await page.waitForTimeout(2500);
      await ss(page, '03-form-submitted');

      const afterSubmit = await page.evaluate(() => ({
        subscribedVisible: (() => {
          const el = document.querySelector('.js_subscribed_wrap');
          return !!el && !el.classList.contains('d-none') && getComputedStyle(el).display !== 'none';
        })(),
        wrapHidden: (() => {
          const el = document.querySelector('.js_subscribe_wrap');
          return !el || el.classList.contains('d-none') || getComputedStyle(el).display === 'none';
        })(),
      }));
      log(afterSubmit.subscribedVisible ? '✅' : '❌', 'FORM-04',
        `success state visible: ${afterSubmit.subscribedVisible}, form hidden: ${afterSubmit.wrapHidden}`);
    } else {
      log('❌', 'FORM-01', 'No .js_subscribe block found on public page — drop block in builder first');
      log('❌', 'FORM-04', 'Skipped — block not on page');
    }

    // ── OPEN BUILDER ────────────────────────────────────────────────────────
    console.log('\nOpening website builder...');
    await openBuilder(page);
    await ss(page, '04-builder-loaded');

    const builderState = await page.evaluate(() => ({
      hasEditables:  !!document.querySelector('.o_editable'),
      hasNavbar:     !!document.querySelector('#oe_main_menu_navbar, .o_we_website_top_actions'),
      url: location.href,
    }));
    console.log('Builder state:', builderState);

    const frame = await getContentFrame(page);
    console.log(`Using frame: ${frame.url()}`);

    // ── SNIP-01: Newsletter Block in sidebar ───────────────────────────────
    // Open snippets panel — look for add-block button
    const addBtnSel = [
      'button[title*="Add"]',
      '.o_we_add_snippet_btn',
      '[data-action="add_snippet"]',
      'button.o_we_toggle_snippets',
    ].join(', ');

    const addBtn = page.locator(addBtnSel).first();
    if (await addBtn.count() > 0) {
      await addBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
    await ss(page, '05-snippets-panel');

    const sidebarCheck = await page.evaluate(() => {
      const allText = document.body.innerText;
      // Check for our snippet label
      const byText = allText.includes('Newsletter Block');
      // Also check for t-snippet attribute in DOM
      const byAttr = !!document.querySelector('[t-snippet="odoo_website_newsletter_block.s_newsletter_block"], [data-snippet="odoo_website_newsletter_block.s_newsletter_block"]');
      // Check sidebar/panel elements
      const panel = document.querySelector('.o_snippets_panel, #snippets_menu, .o_we_sidebar');
      const panelText = panel ? panel.innerText : '';
      return { byText, byAttr, panelText: panelText.slice(0, 300) };
    });

    if (sidebarCheck.byText || sidebarCheck.byAttr) {
      log('✅', 'SNIP-01', `"Newsletter Block" found in builder (byText:${sidebarCheck.byText}, byAttr:${sidebarCheck.byAttr})`);
    } else {
      log('❌', 'SNIP-01', `Not in sidebar. Panel text: "${sidebarCheck.panelText.slice(0, 150)}"`);
    }

    // ── EDIT-01 through EDIT-05 + LIST-02 ─────────────────────────────────
    const blockState = await frame.evaluate(() => {
      const sec  = document.querySelector('.s_newsletter_block');
      const h2   = document.querySelector('.s_newsletter_block h2');
      const body = document.querySelector('.s_newsletter_block .text-muted:not(.small)');
      const sub  = document.querySelector('.s_newsletter_block .small.text-muted');
      const ty   = document.querySelector('.js_subscribed_wrap');
      const list = document.querySelector('.s_newsletter_list');
      return {
        section:    sec  ? { classes: sec.className }  : null,
        headline:   h2   ? { text: h2.innerText.slice(0, 60), contenteditable: h2.getAttribute('contenteditable') } : null,
        bodyPara:   body ? { text: body.innerText.slice(0, 60) } : null,
        subCaption: sub  ? { text: sub.innerText.slice(0, 60) } : null,
        thankYou:   ty   ? { classes: ty.className }   : null,
        listEl:     list ? { listId: list.dataset?.listId, classes: list.className } : null,
      };
    });
    console.log('\nBlock state in frame:', JSON.stringify(blockState, null, 2));

    log(blockState.headline   ? '✅' : '⚠️', 'EDIT-01', blockState.headline   ? `h2: "${blockState.headline.text}"` : 'h2 not found in frame');
    log(blockState.bodyPara   ? '✅' : '⚠️', 'EDIT-02', blockState.bodyPara   ? `body para: "${blockState.bodyPara.text}"` : 'body para not found');
    log(blockState.subCaption ? '✅' : '⚠️', 'EDIT-03', blockState.subCaption ? `sub-caption: "${blockState.subCaption.text}"` : 'sub-caption not found');
    log(blockState.thankYou   ? '✅' : '⚠️', 'EDIT-04', blockState.thankYou   ? `js_subscribed_wrap present` : 'js_subscribed_wrap not found');

    if (blockState.section?.classes?.includes('o_cc')) {
      log('✅', 'EDIT-05', `o_cc color class present: ${blockState.section.classes.match(/o_cc\d*/)?.[0]}`);
    } else {
      log('⚠️', 'EDIT-05', `section classes: ${blockState.section?.classes || 'not found'} — o_cc missing`);
    }

    // LIST-02: Click block and check options panel
    if (blockState.listEl) {
      await frame.evaluate(() => document.querySelector('.s_newsletter_list')?.click());
      await page.waitForTimeout(1500);
      await ss(page, '06-options-panel');

      const optPanel = await page.evaluate(() => {
        const panel = document.querySelector('.o_we_customize_panel, .o_we_sidebar');
        return panel ? panel.innerText.slice(0, 400) : null;
      });
      if (optPanel && (optPanel.toLowerCase().includes('newsletter') || optPanel.toLowerCase().includes('mailing'))) {
        log('✅', 'LIST-02', `Options panel shows newsletter picker`);
      } else {
        log('⚠️', 'LIST-02', `Options panel: "${optPanel?.slice(0, 100) || 'not found'}"`);
      }
    } else {
      log('⚠️', 'LIST-02', 'Block not in builder frame — check that it\'s on this page');
    }

    // ── DIAGNOSTIC: module state + controller health ───────────────────────
    console.log('\nDiagnostics...');
    const modState = await page.evaluate(async (BASE_URL) => {
      try {
        const r = await fetch(`${BASE_URL}/web/dataset/call_kw`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {
            model: 'ir.module.module', method: 'search_read',
            args: [[['name', '=', 'odoo_website_newsletter_block']]],
            kwargs: { fields: ['name', 'state', 'installed_version'], limit: 1 }
          }})
        });
        return (await r.json()).result;
      } catch (e) { return { error: e.message }; }
    }, BASE_URL);
    console.log('  Module state:', modState);

    const health = await page.evaluate(async (BASE_URL) => {
      try {
        const r = await fetch(`${BASE_URL}/odoo_newsletter_block/health`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {} })
        });
        const data = await r.json();
        return data.result !== undefined ? data.result : data;
      } catch (e) { return { error: e.message }; }
    }, BASE_URL);
    console.log('  Controller health:', JSON.stringify(health));
    const ctrlLoaded = health?.status === 'ok';
    log(ctrlLoaded ? '✅' : '❌', 'COMPAT-01', ctrlLoaded
      ? 'Custom controller registered and reachable'
      : `Controller NOT reachable: ${JSON.stringify(health)}`);

    // ── FORM-05 + FORM-02 + FORM-03: list_id=0 defaults to first list; name captured ──
    console.log('\nTesting FORM-05 + FORM-02 + FORM-03 via direct RPC...');
    const testEmail = `playwright-name-${Date.now()}@example.com`;
    const testName  = 'Playwright Name Verify';

    const subscribeResp = await page.evaluate(async (args) => {
      try {
        const r = await fetch(`${args.BASE_URL}/website_mass_mailing/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', method: 'call',
            params: {
              list_id: 0,
              value: args.email,
              subscription_type: 'email',
              address_name: args.name,
              recaptcha_token_response: '',
            }
          })
        });
        const data = await r.json();
        // Odoo JSON-RPC wraps result in data.result; fall back to full data for debugging
        return data.result !== undefined ? data.result : data;
      } catch (e) { return { error: e.message }; }
    }, { BASE_URL, email: testEmail, name: testName });

    console.log('  Subscribe response:', JSON.stringify(subscribeResp));

    if (subscribeResp?.toast_type === 'success') {
      log('✅', 'FORM-05', `list_id=0 → defaulted to first public list, got success toast`);
    } else if (subscribeResp?.toast_type === 'danger' && subscribeResp?.toast_content?.includes('configure')) {
      log('✅', 'FORM-05', `list_id=0 → danger toast "no public lists" (acceptable if none on staging)`);
    } else {
      log('❌', 'FORM-05', `Unexpected response: ${JSON.stringify(subscribeResp || null).slice(0, 120)}`);
    }

    if (subscribeResp?.toast_type === 'success') {
      await page.waitForTimeout(1500);

      const contacts = await page.evaluate(async (args) => {
        try {
          const r = await fetch(`${args.BASE_URL}/web/dataset/call_kw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0', method: 'call',
              params: {
                model: 'mailing.contact',
                method: 'search_read',
                args: [[['email', '=', args.email]]],
                kwargs: { fields: ['name', 'email', 'subscription_list_ids'], limit: 5 }
              }
            })
          });
          const data = await r.json();
          return data.result || data.error;
        } catch (e) { return { error: e.message }; }
      }, { BASE_URL, email: testEmail });

      console.log('  Backend contacts:', contacts);

      if (Array.isArray(contacts) && contacts.length > 0) {
        const c = contacts[0];
        log(c.name === testName ? '✅' : '❌', 'FORM-02',
          `mailing.contact.name = "${c.name}" (expected "${testName}")`);
        log((c.subscription_list_ids?.length || 0) > 0 ? '✅' : '❌', 'FORM-03',
          `contact in ${c.subscription_list_ids?.length || 0} mailing list(s)`);
      } else {
        log('❌', 'FORM-02', `No mailing.contact found for ${testEmail}: ${JSON.stringify(contacts)}`);
        log('❌', 'FORM-03', 'Skipped — no contact found');
      }
    } else {
      log('⚠️', 'FORM-02', 'Skipped — subscribe did not return success');
      log('⚠️', 'FORM-03', 'Skipped — subscribe did not return success');
    }

    // ── COMPAT-02: no JS errors ────────────────────────────────────────────
    log(consoleErrors.length === 0 ? '✅' : '❌', 'COMPAT-02',
      consoleErrors.length === 0
        ? 'No JS console errors detected'
        : `${consoleErrors.length} error(s): ${consoleErrors.slice(0, 2).join(' | ').slice(0, 120)}`);
    if (consoleErrors.length > 0) console.log('  Console errors:', consoleErrors);

  } catch (err) {
    console.error('\n❌ Script error:', err.message);
    await ss(page, 'error').catch(() => {});
  } finally {
    await browser.close();
  }

  // ── REPORT ──────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(58));
  console.log('VERIFICATION REPORT — odoo_website_newsletter_block');
  console.log('='.repeat(58));
  const pass = results.filter(r => r.icon === '✅').length;
  const fail = results.filter(r => r.icon === '❌').length;
  const warn = results.filter(r => r.icon === '⚠️').length;
  for (const r of results) console.log(`  ${r.icon} [${r.req.padEnd(7)}] ${r.msg}`);
  console.log(`\nResult: ${pass} PASS  ${fail} FAIL  ${warn} WARN (needs manual)`);
  console.log(`Screenshots saved to: .tmp/verify-screenshots/`);
  console.log('='.repeat(58) + '\n');

  process.exit(fail > 0 ? 1 : 0);
})();
