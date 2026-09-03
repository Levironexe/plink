# Spike — image generation in the installed AI SDK (`ai@7.0.70`)

Feature G (`feat/asset-generator`). Written before `packages/ai/src/assets.ts`
was implemented, because the AI SDK's image API changed between major versions
and this repo's `AGENTS.md` warns that training-data APIs may not match what is
installed. Everything below was verified against the package on disk, not from
memory.

## What is actually installed

`packages/ai/node_modules/ai` → `node_modules/.pnpm/ai@7.0.70_zod@4.4.3/node_modules/ai`
(`ai` **7.0.70**), with `@ai-sdk/gateway@4.0.56` underneath it.

## Finding 1 — the function is `generateImage`, not `experimental_generateImage`

`dist/index.d.ts:7132` declares `generateImage`, and the export list at
`dist/index.d.ts:9330` contains `generateImage` as a stable name. There is **no**
`experimental_generateImage` export in this version — the v4/v5 spelling most
training data carries would fail at import. (`experimental_generateSpeech`,
`experimental_generateVideo` and `experimental_transcribe` *are* still
experimental; image generation graduated.)

The only deprecated leftover is the type alias
`Experimental_GeneratedImage = GeneratedFile` ("will be removed in v8").

```ts
import { generateImage } from "ai";
```

## Finding 2 — a plain `"provider/model"` string routes through the gateway

`type ImageModel = string | ImageModelV4 | ImageModelV3 | ImageModelV2`
(`dist/index.d.ts:35`), and `resolveImageModel` in `dist/index.js` sends a
string through `globalThis.AI_SDK_DEFAULT_PROVIDER ?? gateway` →
`provider.imageModel(id)`. That is exactly the pattern
`packages/ai/src/index.ts` already documents for text models
(`DEFAULT_MODEL = "anthropic/claude-sonnet-5"`), so images need no new
dependency, no provider import and no client constructed at import time.

`@ai-sdk/gateway` types the accepted ids as `GatewayImageModelId` — a union of
known ids widened with `(string & {})`. The list on disk includes
`google/imagen-4.0-*`, `openai/gpt-image-*`, `bfl/flux-*`, `bytedance/seedream-*`,
`recraft/*`, `xai/grok-imagine-image*`.

Auth is the same `AI_GATEWAY_API_KEY` the gateway already reads from the
environment on each call, so the existing `aiEnabled()` lazy-key discipline
(constitution I.3) carries over unchanged: nothing is read at import.

## Finding 3 — result shape

```ts
const { image, images, warnings, providerMetadata, usage } = await generateImage({ … });
```

`image: GeneratedFile` (`dist/index.d.ts:1013`) exposes `base64: string`,
`uint8Array: Uint8Array` and `mediaType: string` (e.g. `"image/png"`).
`uint8Array` is what we want — base64 would inflate the payload by a third on
the way to the blob store.

`warnings` collects unsupported-setting notices rather than throwing, so an
aspect ratio a model does not support degrades silently. We log the warnings
instead of trusting the request was honoured verbatim.

## Decision — default model and per-kind geometry

**Default: `google/imagen-4.0-fast-generate-001`**, overridable at call time via
`AI_IMAGE_MODEL`.

Why: it is the *fast* (cheapest) tier of a current gateway image family, which
matches the "pick the cheapest model that can do the job" rule already encoded
in `modelFor()`; and it takes `aspectRatio` (`1:1`, `3:4`, `4:3`, `9:16`,
`16:9`) rather than a fixed size list, so one model covers all three asset
kinds. The OpenAI `gpt-image-*` family only accepts `size` from a three-value
list, which would force a size table and still not reach 16:9.

| Kind | `aspectRatio` | Prompt framing |
| --- | --- | --- |
| `hero` | `16:9` | Wide cinematic banner art, subject off-centre, calm space for a headline |
| `banner` | `16:9` | Ultra-wide strip composition, safe to crop hard top and bottom |
| `thumbnail` | `1:1` | Square, single subject, centred, readable at 200 px |

Caveat recorded deliberately: `imagen-4.0` cannot render a true 21:9
ultra-wide. `banner` therefore asks the model for an ultra-wide *composition* at
16:9 with generous vertical margins, so the studio can crop to a strip without
losing the subject. Operators who want a genuine 21:9 can point
`AI_IMAGE_MODEL` at `xai/grok-imagine-image` (supports `20:9`) — no code change,
because the model id is read at call time.

## Decision — failure is a message, never a crash

The gateway rejects an unknown or unentitled image model with a
`GatewayModelNotFoundError` / auth error, and `generateImage` throws
`NoImageGeneratedError` when a provider returns nothing usable. None of that may
reach a user as a stack trace (the page must keep rendering — Article I.3's
"boots with blank keys" spirit). So `generateAssetImage`:

1. throws `Error("AI is not configured")` when `aiEnabled()` is false, checked
   at call time, before any SDK work;
2. wraps the `generateImage` call in `try/catch` and rethrows a single-sentence
   `Error` whose message names the model id — enough for an operator to fix the
   gateway entitlement, with no key material in it;
3. rejects an empty result, a zero-byte image, or a `mediaType` outside the
   PNG/JPEG/WebP allowlist with its own clear message.

The route maps every one of those to a 502 with the message, and the studio page
shows it inline. The app never crashes on a bad image model.

## Decision — the package does not upload

The stub returned `{ url, mimeType }`, implying `@plink/ai` would call
`@plink/storage` itself. That would point a *core-adjacent* package at an
integration package, against the one-way dependency direction in Article V.1,
and would make the function untestable without a blob token. The stub is
unreleased and has no callers (grep: only its own file), so `GeneratedAsset`
becomes `{ bytes: Uint8Array; mimeType: string }` and the API route owns the
upload. Storage stays out of `@plink/ai`.
