# Self-Fulfilling Audit

Someone replies asking for the free audit you promised. This control plane gets it built, delivered, and followed up without a human touch. Inside: n8n workflows, the reply gate, and the production prompts. It runs at a cold email agency right now.

- **The offer IS the fulfillment.** A reply watcher catches the ask. A dispatch job builds the audit. The delivery lands in the prospect's real thread, in minutes.
- **Nothing sends on vibes.** The delivery reply must pass a 14-check gate in code. `validate-reply.js` runs it, self-test included. Fail once, it rewrites. Fail twice, a human decides.
- **No double sends, ever.** Delivery moves through an atomic claim in Postgres before any send.
- **Follow-ups with a second opinion.** Every follow-up passes an independent reviewer at 0.9 confidence. Then a format check, a database gate, and a live calendar check.
- **Bring your own audit engine.** Any service that researches a company and publishes audit pages. Your domain, your format, a callback when done.

## What's inside

```text
workflows/          n8n exports: dispatch, completion callback, telemetry
validate-reply.js   the reply gate, standalone, run it with node
prompts/            the delivery reply prompt + the follow-up review prompt
docs/               architecture, the database contract, the follow-up rules
```

## How it fits together

1. Your reply pipeline calls the dispatch webhook for positive replies.
2. Dispatch validates the company domain, then posts the job to your audit engine.
3. The engine builds and publishes the audit, then calls the callback webhook.
4. The callback gates on QA, drafts the delivery reply, and validates it in code. Then it sends and records everything.
5. A follow-up dispatcher nudges until the prospect books, then stops (rules in docs/FOLLOW-UPS.md).

## Quickstart

- Import the three workflows into n8n (they are sanitized exports; rewire credentials on import).
- Point POST /webhook/audit-dispatch at your own reply pipeline. Point the dispatch node at your audit engine URL.
- The callback expects `{status: "published", qa: {passed: true}, audit_url, lead, job_id}` and rejects anything less.
- `node validate-reply.js` shows the gate accept and reject real drafts.

## Notes

- The workflows reference a Postgres layer (claims, gates, follow-up cursors). The contract is described in docs/ARCHITECTURE.md; wire it to your own schema.
- The follow-up dispatcher export is not included. It reads too much client state to run anywhere else. Its rules and the reviewer prompt are in prompts/ and docs/FOLLOW-UPS.md.
- Everything here is sanitized: no client names, no domains, no credentials.

---

Built by [The Revenue Inbox](https://therevenueinbox.com). Steal it, adapt it, change it.
