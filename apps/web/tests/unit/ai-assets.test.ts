import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Feature G — the AI asset generator. Nothing here touches the network or a
 * database: `composeAssetPrompt` is pure, and the one function that would call
 * a provider runs against a mocked `ai` SDK.
 *
 * The mock is hoisted so `packages/ai/src/assets.ts` sees it at import time.
 */
const sdk = vi.hoisted(() => ({
  calls: [] as Record<string, unknown>[],
  result: null as unknown,
  error: null as unknown,
}));

/**
 * `apps/web` does not depend on the `ai` SDK directly — `@plink/ai` does — so
 * a bare `vi.mock("ai")` here would resolve to nothing and silently let the
 * real gateway client through. Pointing at the package the way the AI package
 * itself resolves it gives the mock the same module id, and the mock applies.
 */
vi.mock("../../../../packages/ai/node_modules/ai", () => ({
  generateImage: async (options: Record<string, unknown>) => {
    sdk.calls.push(options);
    if (sdk.error) throw sdk.error;
    return sdk.result;
  },
}));

import {
  ASSET_KINDS,
  ASSET_MIME_TYPES,
  ASSET_PROMPT_MAX,
  DEFAULT_IMAGE_MODEL,
  assetImageModel,
  composeAssetPrompt,
  generateAssetImage,
  isAssetKind,
  type AssetKind,
  type GeneratedAsset,
} from "@plink/ai/assets";

/** A stand-in for the SDK's `GeneratedFile`. */
function fakeImage(mediaType = "image/png", bytes = new Uint8Array([137, 80, 78, 71])) {
  return {
    image: { uint8Array: bytes, base64: "", mediaType },
    images: [],
    warnings: [],
    responses: [],
    providerMetadata: {},
    usage: {},
  };
}

const KEY = "AI_GATEWAY_API_KEY";
const MODEL_ENV = "AI_IMAGE_MODEL";

beforeEach(() => {
  sdk.calls = [];
  sdk.result = fakeImage();
  sdk.error = null;
  delete process.env[KEY];
  delete process.env[MODEL_ENV];
});

afterEach(() => {
  delete process.env[KEY];
  delete process.env[MODEL_ENV];
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ kinds */

describe("asset kinds", () => {
  it("exposes exactly hero, banner and thumbnail", () => {
    expect([...ASSET_KINDS]).toEqual(["hero", "banner", "thumbnail"]);
  });

  it("accepts every declared kind", () => {
    for (const kind of ASSET_KINDS) expect(isAssetKind(kind)).toBe(true);
  });

  it("rejects anything else, including near misses and non-strings", () => {
    for (const value of ["Hero", "avatar", "", " hero", null, undefined, 3, {}, ["hero"]]) {
      expect(isAssetKind(value)).toBe(false);
    }
  });

  it("stores only raster formats a CDN can serve safely", () => {
    expect([...ASSET_MIME_TYPES]).toEqual(["image/png", "image/jpeg", "image/webp"]);
    expect(ASSET_MIME_TYPES as readonly string[]).not.toContain("image/svg+xml");
  });
});

/* --------------------------------------------------------- prompt shaping */

describe("composeAssetPrompt", () => {
  it("carries the operator's words through verbatim", () => {
    expect(composeAssetPrompt("hero", "a misty pine forest at dawn")).toContain(
      "Subject: a misty pine forest at dawn",
    );
  });

  it("gives each kind its own framing", () => {
    const prompts = Object.fromEntries(
      ASSET_KINDS.map((kind) => [kind, composeAssetPrompt(kind, "a ceramic studio")]),
    ) as Record<AssetKind, string>;

    expect(prompts.hero).toMatch(/16:9 hero banner/i);
    expect(prompts.banner).toMatch(/ultra-wide banner strip/i);
    expect(prompts.thumbnail).toMatch(/square thumbnail/i);

    // Three distinct prefixes, not one prompt with the kind pasted in.
    expect(new Set(Object.values(prompts)).size).toBe(3);
  });

  it("appends the shared house rules to every kind", () => {
    for (const kind of ASSET_KINDS) {
      const prompt = composeAssetPrompt(kind, "a market stall");
      expect(prompt).toMatch(/Do not render any text/i);
      expect(prompt).toMatch(/Do not depict real, recognisable people/i);
    }
  });

  it("clamps a long prompt to ASSET_PROMPT_MAX characters", () => {
    const long = "x".repeat(ASSET_PROMPT_MAX + 500);
    const subject = composeAssetPrompt("hero", long).split("Subject: ")[1]!.split("\n")[0]!;
    expect(subject).toHaveLength(ASSET_PROMPT_MAX);
  });

  it("keeps a prompt that is already short", () => {
    const short = "y".repeat(ASSET_PROMPT_MAX);
    const subject = composeAssetPrompt("hero", short).split("Subject: ")[1]!.split("\n")[0]!;
    expect(subject).toBe(short);
  });

  it("strips control characters and trims", () => {
    const prompt = composeAssetPrompt("thumbnail", "  \u0007a \u0000brass lamp\u001f  ");
    expect(prompt).toContain("Subject: a brass lamp");
    // Nothing that could smuggle content past a naive consumer survives.
    expect(prompt).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/);
  });

  it("survives a non-string prompt without throwing", () => {
    expect(() => composeAssetPrompt("hero", undefined as unknown as string)).not.toThrow();
    expect(composeAssetPrompt("hero", 42 as unknown as string)).toContain("Subject: ");
  });

  it("is pure — same input, same output, no environment reads", () => {
    const once = composeAssetPrompt("banner", "a linocut of the sea");
    process.env[KEY] = "sk-test";
    expect(composeAssetPrompt("banner", "a linocut of the sea")).toBe(once);
    expect(sdk.calls).toHaveLength(0);
  });
});

/* ------------------------------------------------------------- model id */

describe("assetImageModel", () => {
  it("defaults to a gateway 'provider/model' string", () => {
    expect(assetImageModel()).toBe(DEFAULT_IMAGE_MODEL);
    expect(DEFAULT_IMAGE_MODEL).toMatch(/^[a-z0-9-]+\/[a-z0-9.-]+$/);
  });

  it("takes an override at call time, not at import time", () => {
    process.env[MODEL_ENV] = "xai/grok-imagine-image";
    expect(assetImageModel()).toBe("xai/grok-imagine-image");
  });

  it("ignores a blank override", () => {
    process.env[MODEL_ENV] = "   ";
    expect(assetImageModel()).toBe(DEFAULT_IMAGE_MODEL);
  });
});

/* --------------------------------------------------------- generation */

describe("generateAssetImage", () => {
  it("refuses to call the provider when the gateway key is absent", async () => {
    await expect(generateAssetImage({ kind: "hero", prompt: "a rooftop garden" })).rejects.toThrow(
      "AI is not configured",
    );
    expect(sdk.calls).toHaveLength(0);
  });

  it("treats a whitespace-only key as absent", async () => {
    process.env[KEY] = "   ";
    await expect(generateAssetImage({ kind: "hero", prompt: "a rooftop garden" })).rejects.toThrow(
      "AI is not configured",
    );
    expect(sdk.calls).toHaveLength(0);
  });

  it("returns bytes and a mime type — never a url", async () => {
    process.env[KEY] = "sk-test";
    const asset: GeneratedAsset = await generateAssetImage({ kind: "thumbnail", prompt: "a brass compass" });

    expect(asset.bytes).toBeInstanceOf(Uint8Array);
    expect(asset.bytes.byteLength).toBeGreaterThan(0);
    expect(asset.mimeType).toBe("image/png");
    expect(Object.keys(asset).sort()).toEqual(["bytes", "mimeType"]);
  });

  it("sends the composed prompt, the kind's aspect ratio and one image", async () => {
    process.env[KEY] = "sk-test";
    await generateAssetImage({ kind: "banner", prompt: "a coastline at dusk" });

    const call = sdk.calls[0]!;
    expect(call.model).toBe(DEFAULT_IMAGE_MODEL);
    expect(call.prompt).toBe(composeAssetPrompt("banner", "a coastline at dusk"));
    expect(call.aspectRatio).toBe("16:9");
    expect(call.n).toBe(1);
  });

  it("asks for a square when the kind is a thumbnail", async () => {
    process.env[KEY] = "sk-test";
    await generateAssetImage({ kind: "thumbnail", prompt: "a brass compass" });
    expect(sdk.calls[0]!.aspectRatio).toBe("1:1");
  });

  it("normalises a parameterised media type", async () => {
    process.env[KEY] = "sk-test";
    sdk.result = fakeImage("image/JPEG; charset=binary");
    const asset = await generateAssetImage({ kind: "hero", prompt: "a workshop bench" });
    expect(asset.mimeType).toBe("image/jpeg");
  });

  it("rejects an unknown kind before spending a call", async () => {
    process.env[KEY] = "sk-test";
    await expect(
      generateAssetImage({ kind: "avatar" as AssetKind, prompt: "a portrait" }),
    ).rejects.toThrow(/Unknown asset kind: avatar/);
    expect(sdk.calls).toHaveLength(0);
  });

  it("rejects a prompt that clamps to nothing", async () => {
    process.env[KEY] = "sk-test";
    await expect(generateAssetImage({ kind: "hero", prompt: "    " })).rejects.toThrow(
      /Describe the image you want/,
    );
    expect(sdk.calls).toHaveLength(0);
  });

  it("degrades to a clear message naming the model when the gateway rejects it", async () => {
    process.env[KEY] = "sk-test";
    sdk.error = new Error("model not found");

    await expect(generateAssetImage({ kind: "hero", prompt: "a lantern-lit alley" })).rejects.toThrow(
      `Image generation failed for "${DEFAULT_IMAGE_MODEL}": model not found`,
    );
  });

  it("survives a non-Error rejection from the SDK", async () => {
    process.env[KEY] = "sk-test";
    sdk.error = "boom";
    await expect(generateAssetImage({ kind: "hero", prompt: "a lantern-lit alley" })).rejects.toThrow(
      /the gateway rejected the request/,
    );
  });

  it("refuses a media type outside the allowlist", async () => {
    process.env[KEY] = "sk-test";
    sdk.result = fakeImage("image/svg+xml", new Uint8Array([60, 115, 118, 103]));
    await expect(generateAssetImage({ kind: "hero", prompt: "a paper crane" })).rejects.toThrow(
      /Only PNG, JPEG and WebP are stored/,
    );
  });

  it("refuses an empty image", async () => {
    process.env[KEY] = "sk-test";
    sdk.result = fakeImage("image/png", new Uint8Array());
    await expect(generateAssetImage({ kind: "hero", prompt: "a paper crane" })).rejects.toThrow(
      /returned an empty image/,
    );
  });

  it("refuses a result with no image at all", async () => {
    process.env[KEY] = "sk-test";
    sdk.result = { ...fakeImage(), image: undefined };
    await expect(generateAssetImage({ kind: "hero", prompt: "a paper crane" })).rejects.toThrow(
      /returned no image/,
    );
  });

  it("logs provider warnings instead of failing on them", async () => {
    process.env[KEY] = "sk-test";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    sdk.result = { ...fakeImage(), warnings: [{ type: "unsupported-setting" }] };

    const asset = await generateAssetImage({ kind: "banner", prompt: "a harbour at night" });
    expect(asset.mimeType).toBe("image/png");
    expect(warn).toHaveBeenCalledOnce();
  });
});
