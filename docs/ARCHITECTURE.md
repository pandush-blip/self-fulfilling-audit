# Architecture

The control plane around a self-fulfilling offer. Five moving parts, one contract.

## The chain

1. **Every reply gets read.** A reply watcher reads every inbound. Each one hits an intent screen. Only real audit requests pass. Positive intent plus an explicit ask for the audit, draft, or report.
2. **Dispatch, with tripwires.** The workflow pulls the prospect's domain from their website. No website? It reads the email domain, and rejects free mailboxes. If the company can't be verified, the lead parks instead of dispatching.
3. **A small engine builds the audit.** The dispatch fires a job to an audit engine. It researches the prospect's business and drafts them a real audit page. Then it runs its own QA and publishes it on your own domain.
4. **The callback gate.** Only one payload passes: published status, QA passed, URL on your domain. Anything less parks for review.
5. **Atomic delivery claim.** The job moves through a single-claim state machine in the database. Retries lose the race by design. Nothing double-sends, ever.
6. **The delivery reply is drafted inside the real thread.** Not a new email. A native reply to the prospect's verified message ID.
7. **The validation gate.** The draft must pass a hard checklist in code before it sends. 14 checks, see validate-reply.js. Fail one check and the exact failures go back to the model. It rewrites once. Fail again, it goes to a human review queue.
8. **Thread verification right before send.** The thread gets re-read from the provider. Pagination must be complete. The prospect's message must still be the latest one.
9. **Send, confirm, record.** The reply goes out from the client's inbox. The provider's acknowledgement ID is required as proof. Every state change lands in the tracker.

## What each workflow does

### 01 audit dispatch (5 nodes)

Flow: webhook in, build the request, POST to your audit engine. Then hold if the delivery domain is not ready.

- Derives the company domain from the website, or from the email for company domains only.
- Builds a `company_name_hint` from the subject line when the payload lacks one.
- The request carries `domain`, `lead`, `offer_mode`, and a `callback_url` your engine must call when done.
- If delivery-domain DNS or HTTPS isn't verified, the lead is held, never dispatched.

### 02 audit complete callback (37 nodes)

The delivery machine. In order:

- **Validate the callback.** Only `status: 'published'`, `qa.passed: true`, and an `audit_url` on your domain pass. Anything else parks the lead.
- **Upsert the job and tracker row.** The audit URL is written to the lead. The tracker sheet gets the same.
- **Atomic claim.** `follow_up_state` moves `AWAITING_VIEW` -> `SENDING` with one conditional update. A second claim cannot win.
- **Before-send gate.** A database function returns `allowed` plus a reason string. Bookings, suppression, and new inbound all block here.
- **Draft the reply.** One OpenAI call with the delivery prompt from prompts/. Strict JSON output.
- **Validate the draft.** All 14 checks in validate-reply.js run in the workflow itself. Failures get quoted back for a single rewrite, then a human reviews.
- **Re-verify the thread from the provider.** Pagination must be complete. The target message is still the latest. Sender account resolves from the thread itself.
- **Send as a native reply.** Instantly reply endpoint, same thread, same account. The provider's acknowledgement ID is required as proof.
- **Record everything.** Messages, states, and audit log rows. Every branch that cannot verify something writes a `needs_review` state with an attention reason.

### 03 audit telemetry (4 nodes)

Webhook -> filter event -> record and update state. Page views and engagement calls come back here and move the follow-up state.

## The database contract

The workflows call into Postgres. Recreate these tables and functions in your stack; the exports show the exact call signatures.

**Tables**

- `appointment_leads`: one row per prospect. Status, `last_inbound_at`, `last_outbound_at`, `follow_up_count`, booking fields, locks (`locked_until`, `lock_token`), `next_contact_at`.
- `appointment_messages`: every message in and out. `direction`, `message_kind` (`reply`, `audit_reply`, `follow_up`), `provider_message_id`.
- `appointment_drafts`: draft history with `approval_status` (`pending`, `not_required`, `sent`, `superseded`).
- `audit_jobs`: one row per audit job. Status plus `follow_up_state` (`AWAITING_VIEW`, `SENDING`, `REVIEW`, ...).
- `appointment_reply_claims`: dedupes provider inbound IDs so one reply is processed exactly once.
- `appointment_audit_log`: append-only event log (`send_blocked`, `follow_up_recovery`, ...).

**Functions**

- `appointment_before_send_gate(lead_id, ...)`: returns `allowed` and `reason`. The last word before any send.
- `appointment_claim_due_followups(client, window)`: returns due leads, atomically claimed.
- `appointment_next_sending_window(now, tz, ...)`: computes the next allowed send time.
- `audit_upsert_job(...)`: audit job upsert plus counters.

## Failure behavior

- Any failed check parks the lead in `needs_review` with an attention reason. Nothing guesses.
- New inbound pauses sequences. Bookings stop them. Neither restarts automatically.
- Verification failures (thread changed, provider unconfirmed) hold the lead instead of sending blind.
