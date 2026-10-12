# Follow-up rules

The follow-up dispatcher export is not in this repo. It reads too much client state to run anywhere else. These are its rules, as they run in production.

## Eligibility

Follow-ups only fire when all of this is true:

- The audit was actually delivered in the verified thread.
- The prospect genuinely replied, and the team already answered.
- No consultation is booked.

Silence after delivery is not negative intent. Automated replies and out-of-office messages are never nudged.

## The review loop

Every follow-up gets a second opinion before sending:

1. One pass writes the draft. It must materially reference the real audit angle or a specific article detail. Company-name substitution alone is not personalization.
2. An independent reviewer pass must approve it with confidence 0.9 or higher (prompt in prompts/follow-up-review-prompt.md).
3. The format check must pass: greeting, sender signature, paragraph lengths.
4. The database before-send gate must allow it.

A rejected draft stays in review. It does not send.

## Cadence

- The first follow-up lands about 2 days after delivery.
- After that the gaps stretch: 3, 4, 5 days.
- Weekdays only, inside an afternoon sending window in the prospect's timezone.
- Pinned to the hour they replied. The window example from production: Mon-Fri, 16:00-21:00, prefer the reply hour clamped between 16:00 and 20:00.

## Stop conditions

- A live calendar check runs right before every send. A booking stops the sequence instantly.
- New inbound from the prospect pauses the sequence automatically. The thread is the source of truth, not the plan.
- Any verification failure parks the lead for a human instead of guessing. Thread changed, provider didn't confirm, gate denied: all hold.

## Position and posture

- Article first. Never open with the audit or findings.
- The article is a draft, not confirmed publication. Talk about "your feature", "the piece", "the draft".
- No apologies for writing, no mentions of elapsed time, no manufactured urgency.
- Banned phrases: just checking in, circling back, bumping this, did you get a chance. Also I hope, no worries if not, let me know your thoughts.
