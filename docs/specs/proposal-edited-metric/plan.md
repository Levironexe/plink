# Plan — feat/proposal-edited-metric

## Shape of the change

One file of production code. No new layer, no new dependency edge:

```
apps/web/src/lib/site-store.ts
  publishSite()
    └── transaction: version snapshot + site update + audit + `publish` event   (unchanged)
    └── recordAiProposalOutcome()          ← new private helper, non-fatal, post-commit
            ├── prisma.aiGeneration.findFirst   (latest applied "site" proposal)
            ├── prisma.eventLog.findMany        (idempotency: already credited?)
            ├── safeParseSiteDocument           (@plink/core, existing)
            ├── diffDocuments                   (@plink/core, existing)
            └── logEvent                        (existing exported creator)
```

`packages/core/**` is read-only for this feature; `studio/**` is untouched
except for one line in `docs/specs/website-generator/spec.md`.

## Key decisions

1. **Publish time, not editor session** (spike:
   `docs/spikes/2026-09-03-proposal-edited-at-publish-time.md`). The original
   spec proposed threading a `generationId` through the editor so
   `finalApplied` could hold the edited document. Rejected: it needs a
   client-supplied id on a public endpoint (Art. I.2), a session concept the
   editor does not have, and it still measures the wrong instant — a draft
   the operator abandoned would count as human effort. Publish is the one
   moment where a human has demonstrably committed to a result.

2. **Idempotency derived from `EventLog`, not a column.** The schema is
   frozen (Art. II.3), so "this generation was already measured" is answered
   by scanning the two credit event types for this site and comparing
   `data.generationId`. `EventLog` already carries `@@index([siteId, type,
   createdAt])`, so the read is one indexed lookup over a handful of rows.
   The alternative — writing a marker into `AiGeneration.finalApplied` — is
   a mutation of a frozen model's semantics and loses the diff counts.

3. **Two events, not one with a boolean.** `ai_proposal_kept_verified` and
   `ai_proposal_edited` are separate types because the event store is queried
   by `type` (that is what the index is for); a `{ edited: true }` payload
   would force every consumer to parse JSON to count a ratio.

4. **Outside the transaction, and silent on failure.** Constitution III.3
   demands that an important operation not commit without its audit row —
   which is why the `publish` audit and event stay *inside* the transaction.
   This metric is deliberately the opposite: it is an observation of a
   completed operation, and a dead analytics read must never cost an operator
   their publish. The helper therefore runs after the transaction commits and
   wraps everything in one `try/catch` that swallows, with a comment saying
   why. The catch is the feature, not an oversight.

5. **Parse both sides, guess nothing.** `AiGeneration.output` is a string
   column written months earlier under an older schema revision; it can
   legitimately fail `safeParseSiteDocument`. In that case no event is
   written at all. A metric that is sometimes absent is repairable; a metric
   that is sometimes wrong is not.

6. **`lte`, not `lt`, on `createdAt`.** A row can only be read after it was
   created, so the bound is defensive rather than load-bearing; using `lte`
   avoids discarding a generation that landed in the same millisecond as the
   publish (which happens routinely in tests and under a fast clock).

## Testing seam

`apps/web/tests/unit/proposal-metric.test.ts` reuses the mocking approach
proven in `versioning.test.ts` — `vi.hoisted` in-memory tables,
`vi.mock("@plink/db")`, `vi.mock("@/lib/auth")`, `vi.mock("server-only")` —
extended with an `aiGeneration` table (`findFirst` honouring
`kind`/`status`/`createdAt` + `orderBy createdAt desc`) and an
`eventLog.findMany` that filters on `siteId` and `type: { in: [...] }`. The
"metrics must not break the publish" case forces `eventLog.create` to reject
for the metric write only and asserts the publish still returns
`{ ok: true, versionNumber }`.

## Risks

- **Double counting across sites.** A generation row is scoped by `siteId`
  in both the lookup and the idempotency scan, so two sites cannot credit
  each other's proposals.
- **Rollback publishes.** `rollbackSite` writes its own `rollback` event and
  does *not* run the metric — restoring an old snapshot is not a statement
  about the model's work. Left deliberately out of scope.
- **A generation applied but never published** simply never produces a
  verified/edited event; the `ai_proposal_kept` row from apply time still
  records that it was accepted.
