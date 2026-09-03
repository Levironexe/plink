# Spike — measuring human edits of an AI proposal at publish time

**Question.** Product Plan VI §6 wants a kept-vs-edited-vs-discarded ratio for
AI generations, and constitution III.4 requires *human edits* of AI generations
to be recorded. Today `ai_proposal_kept` fires when the operator clicks *Apply*
— before they have read a single section — so a proposal that was rewritten
end to end is indistinguishable from one shipped verbatim. Where does the
"edited" signal come from, and when does it fire?

## Options considered

### 1. Thread a `generationId` through the editor session (the original spec's plan)

`docs/specs/website-generator/spec.md` reserved `ai_proposal_edited` with this
sketch: Feature E's editor carries a `generationId` for the duration of an edit
session; when the operator finishes, `AiGeneration.finalApplied` is written
with the *edited* document while `output` keeps the model's original, and the
diff between the two columns is the metric.

Rejected, for four reasons:

- **There is no session to hang it on.** The studio editor autosaves drafts
  through `saveDraft`; it has no notion of a session start, a session end, or
  a "done editing" moment. Inventing one is a Feature E change — and Feature E
  is not this agent's file.
- **It puts a client-supplied id on the write path.** The `generationId` would
  arrive from the browser on every autosave. Constitution I.2 says a server
  action is a public endpoint and LLM/browser input is never trusted; the
  generate actions already went out of their way to accept *only ids* and
  re-read the document server-side. Accepting an attribution id per keystroke
  reintroduces exactly the tampering surface that design avoided.
- **It measures the wrong instant.** A draft is not a decision. An operator
  who edits for ten minutes, dislikes the result and rolls back to the
  proposal would generate a large "human effort" number for work that was
  thrown away. Worse, autosave would make the metric fire continuously and
  the ratio would count keystrokes, not outcomes.
- **It writes to a frozen model.** `AiGeneration.finalApplied` belongs to the
  schema owner (Art. II.3). The same information fits in an `EventLog` row,
  which this feature is allowed to append to.

### 2. Diff on every `saveDraft`

Cheap to implement (the diff summary is already computed there) but produces
one event per autosave. The ratio would then be dominated by how long someone
left the tab open. Rejected.

### 3. Diff at publish time — **chosen**

Publish is the only point in the pipeline where a human has *finished* editing
and *committed* to a result: it is deliberate, explicit, and already the
transaction that freezes an immutable `SiteVersion`. Comparing that snapshot
against `AiGeneration.output` answers precisely the question §6 asks — "how
much of what we shipped did the model actually write?" — with no new input
surface, no session concept, and no schema change.

Consequences accepted:

- A proposal that is applied but never published produces no
  verified/edited event. Correct: nothing shipped, so there is nothing to
  measure. The apply-time `ai_proposal_kept` row still records acceptance.
- A hand-built site (no applied generation) emits no AI metric at all, rather
  than a misleading zero.
- Publishing credits the *latest* applied `kind: "site"` generation. After a
  regenerate-then-apply, the older proposal is no longer what seeded the
  document, and crediting it would be wrong.
- `rollbackSite` deliberately does not run the metric. Restoring an old
  snapshot is a recovery action, not a statement about the model's work.

## "Measured exactly once", with the schema frozen

Each generation must be counted once, however many times the site is published
afterwards — otherwise a site that publishes weekly would slowly bury its own
"edited" verdict under repeats. The natural implementation is a `creditedAt`
column on `AiGeneration`, and it is unavailable: Art. II.3 freezes the schema
for feature agents.

The derivation used instead treats the event store as its own ledger. The two
credit events, `ai_proposal_kept_verified` and `ai_proposal_edited`, both carry
`data.generationId`. Before writing, the store reads this site's rows of those
two types and looks for one whose `generationId` matches the generation it is
about to credit; a match means the work is already counted and the publish is
silent. Properties that make this sound:

- **It is the same fact, not a proxy.** "An event exists for this generation"
  *is* the definition of "already measured" — there is no second source of
  truth to drift from.
- **It is scoped and indexed.** The scan is `WHERE siteId = ? AND type IN
  (...)`, matching `EventLog`'s `@@index([siteId, type, createdAt])`, over the
  handful of AI credit rows a single site accumulates. `data` is a string
  column, so the `generationId` comparison happens in application code after
  a cheap indexed fetch rather than as a JSON query.
- **It cannot leak across sites.** Both the generation lookup and the ledger
  scan are filtered by `siteId`.
- **It is self-healing.** If the event write fails (see below), nothing is
  recorded, and the *next* publish of that generation gets another chance.
  An exactly-once guarantee under failure would need a transaction the
  feature explicitly refuses to take.

The one race this does not close: two concurrent publishes of the same site
could both read "not yet credited" and both write. The publish transaction
itself is serialized by `@@unique([siteId, number])`, so this requires two
publishes overlapping within the metric read — and the failure mode is a
duplicate analytics row, not a corrupted site. A locking read is not worth
what it would cost the publish path.

## Why the helper swallows every error

The metric runs *after* the publish transaction commits and catches
everything. This is a deliberate inversion of constitution III.3's rule for
audit rows — "an important operation without its audit row must not commit" —
and the distinction is worth stating: the `site.publish` audit row and the
`publish` event *describe the operation itself* and stay inside the
transaction; this metric *observes an operation that already happened*. A
failed observation must never retroactively cost the operator their version
snapshot, and a published site must never report failure because an analytics
insert timed out. Metrics do not get to break the product.
