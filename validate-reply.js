// validate-reply.js
// The reply gate from a production self-fulfilling audit system.
// Every audit delivery reply must pass all checks before it can send.
//
// Run: node validate-reply.js   (executes the self-test)
// This file is standalone. No dependencies. Node 18+.

const CONFIG = {
  bookingUrl: 'https://calendly.com/your-company/consultation',
  auditUrlPattern: /^https:\/\/audit\.example\.com\/audit\/[a-z0-9-]+$/i,
};

function normalizeLayout(text, sender) {
  let t = String(text || '').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/[ \t]{2,}/g, ' ').trim();
  t = t.replace(/^(Hi[^,\n]*,)[ \t]*/, '$1\n\n');
  t = t.replace(/([^\n])\s+(https?:\/\/[^\s]+)/g, '$1\n\n$2');
  t = t.replace(/(https?:\/\/[^\s]+)[ \t]*\n[ \t]*(?=\S)/g, '$1\n\n');
  t = t.replace(/(https?:\/\/[^\s]+)[ \t]+(?=\S)/g, '$1\n\n');
  if (sender) t = t.replace(/\n*Best,[ \t]*\n?[ \t]*([A-Z][a-z]{1,19})[ \t]*$/, '\n\nBest,\n\n$1');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

function validate(text, c) {
  const checks = [];
  const check = (name, passed, detail = '') => checks.push({ name, passed: !!passed, detail });
  const t = String(text || '').trim();
  const urls = t.match(/https?:\/\/[^\s<>"\])]+/g) || [];
  check('plain_text', !/<[\/]?[a-z][^>]*>|\*\*|__|\[[^\]]+\]\(|^\s*#{1,6}\s|&(?:nbsp|amp|lt|gt);/im.test(t));
  check('greeting', !!c.firstName && t.startsWith('Hi ' + c.firstName + ',\n\n'));
  check('paragraph_spacing', t.includes('\n\n') && t.split(/\n\n/).every(p => p.length <= 500));
  check('paragraph_structure', t.split(/\n{2,}/).map(x => x.trim()).filter(Boolean).length >= 3);
  check('url_own_line', urls.every(u => t.split('\n').some(line => line.trim() === u)));
  check('sender', !!c.sender && /^[A-Z][a-z]{1,19}$/.test(String(c.sender || '')) && t.endsWith('Best,\n\n' + c.sender));
  check('length', (t.replace(/https?:\/\/\S+/g, '').match(/\S+/g) || []).length <= 120);
  check('booking_url', urls.includes(CONFIG.bookingUrl));
  check('delivery_url', !!c.audit_url && CONFIG.auditUrlPattern.test(c.audit_url) && urls.includes(c.audit_url));
  check('approved_urls', urls.every(u => u === c.audit_url || u === CONFIG.bookingUrl));
  check('article_first', t.indexOf(c.audit_url) >= 0 && t.indexOf(c.audit_url) < t.indexOf(CONFIG.bookingUrl));
  check('no_audit_summary', !/\bthe audit (?:covers|shows|includes|reviews|looks at)\b|the proposed angle is|the draft shows how|findings (?:show|reveal)|the analysis covers|search position, while the draft/i.test(t));
  check('no_invented_commitments', !/ready to (?:place|publish)|Forbes article|published feature|in your voice|guaranteed publication|invitation (?:has been|was) sent/i.test(t));
  check('verified_thread', c.thread_verified === true && !!c.reply_to_uuid && !!c.email_account);
  return { passed: checks.every(x => x.passed), checks };
}

module.exports = { normalizeLayout, validate, CONFIG };

// ---- self-test: node validate-reply.js ----
if (require.main === module) {
  const ctx = {
    firstName: 'Jane',
    sender: 'Alex',
    audit_url: 'https://audit.example.com/audit/jane-doe-co',
    thread_verified: true,
    reply_to_uuid: 'msg_123',
    email_account: 'alex@youragency.example.com',
  };

  const good = `Hi Jane,

Absolutely, here's the audit and draft article:

${ctx.audit_url}

We identified a few PR opportunities for Jane Doe Co that I think are worth discussing.

Happy to show you which ones we'd prioritise and how we'd approach getting the coverage.

${CONFIG.bookingUrl}

Best,

Alex`;
  const normalized = normalizeLayout(good, ctx.sender);
  const pass = validate(normalized, ctx);
  console.log('good draft:', pass.passed ? 'PASS' : 'FAIL');
  if (!pass.passed) console.log(pass.checks.filter(c => !c.passed));

  const bad = normalized
    .replace("We identified a few PR opportunities for Jane Doe Co that I think are worth discussing.",
             "The audit covers your search visibility and the proposed angle is clear.")
    .replace('Best,\n\nAlex', 'Best,\n\nUnknown');
  const badRes = validate(bad, ctx);
  const failed = badRes.checks.filter(c => !c.passed).map(c => c.name);
  console.log('bad draft failed checks:', failed.join(', '));

  if (badRes.passed) throw new Error('bad draft should not pass');
  if (pass.passed && failed.includes('no_audit_summary')) console.log('self-test OK');
  else process.exit(1);
}
