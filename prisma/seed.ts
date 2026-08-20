/**
 * Seeds a fully-populated demo account so the dashboard, analytics and store
 * all have something real to show. Safe to re-run: it deletes the demo user
 * first, then rebuilds everything.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { generatedAvatar } from "../src/lib/avatar";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

const DEMO_EMAIL = "maya@plink.demo";
const DEMO_PASSWORD = "plinkdemo123";

/** Deterministic PRNG so re-seeding produces the same charts. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const REFERRERS = ["instagram.com", "tiktok.com", "direct", "youtube.com", "x.com", "google.com", "substack.com"];
const DEVICES = ["mobile", "mobile", "mobile", "desktop", "tablet"];

const HISTORY_DAYS = 90;

async function main() {
  console.log("Seeding Plink demo data…");

  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  // The account predates the analytics history so every range has data to show.
  const accountCreatedAt = new Date();
  accountCreatedAt.setDate(accountCreatedAt.getDate() - (HISTORY_DAYS + 30));

  const user = await prisma.user.create({
    data: {
      createdAt: accountCreatedAt,
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      username: "maya",
      displayName: "Maya Osei",
      bio: "Product designer turned indie maker. I write about design systems, ship small tools, and answer every DM.",
      category: "Design & tech",
      location: "Lisbon",
      verified: true,
      onboarded: true,
      plan: "pro",
      theme: {
        create: {
          presetId: "moonlight",
          bgType: "gradient",
          bgColor: "#1b1032",
          bgColorTwo: "#3d1f6b",
          bgPattern: "dots",
          textColor: "#ffffff",
          mutedColor: "#c4b5fd",
          accentColor: "#8b5cf6",
          buttonStyle: "glass",
          buttonRadius: "full",
          buttonColor: "#ffffff",
          buttonTextColor: "#ffffff",
          fontFamily: "inter",
          avatarShape: "circle",
          hideBranding: false,
        },
      },
      mediaKit: {
        create: {
          published: true,
          headline: "Design systems, indie tools and a very online newsletter.",
          about:
            "I make things for designers and the engineers who work with them. My audience skews senior — design leads, staff engineers, founders — and they buy tools that save them a sprint.\n\nI take on two partnerships a quarter so each one gets real attention.",
          audience: JSON.stringify({
            followers: "284k",
            reach: "96k",
            engagement: "7.4%",
            ageRange: "24–34",
            splitFemale: "54% female",
            topCountries: "US, UK, DE",
          }),
          rateCard: JSON.stringify([
            { deliverable: "Instagram Reel", priceCents: 320000 },
            { deliverable: "TikTok video", priceCents: 280000 },
            { deliverable: "Newsletter feature", priceCents: 150000 },
            { deliverable: "Full campaign", priceCents: 900000 },
          ]),
          brands: JSON.stringify(["Figma", "Linear", "Vercel", "Framer", "Raycast"]),
        },
      },
      socials: {
        create: [
          { platform: "instagram", url: "https://instagram.com/mayabuilds", position: 0 },
          { platform: "x", url: "https://x.com/mayabuilds", position: 1 },
          { platform: "youtube", url: "https://youtube.com/@mayabuilds", position: 2 },
          { platform: "github", url: "https://github.com/mayabuilds", position: 3 },
        ],
      },
    },
  });

  const products = await Promise.all([
    prisma.product.create({
      data: {
        userId: user.id,
        name: "The Design System Starter",
        description: "62 Figma components, tokens and docs — ready to fork.",
        priceCents: 4900,
        imageUrl: generatedAvatar("design-system-starter"),
        type: "digital",
        sales: 1284,
      },
    }),
    prisma.product.create({
      data: {
        userId: user.id,
        name: "1:1 Portfolio Review",
        description: "45 minutes, recorded, with written notes afterwards.",
        priceCents: 12000,
        imageUrl: generatedAvatar("portfolio-review"),
        type: "service",
        sales: 46,
      },
    }),
    prisma.product.create({
      data: {
        userId: user.id,
        name: "Component Naming Cheatsheet",
        description: "A free one-pager. Print it, pin it, stop arguing.",
        priceCents: 0,
        imageUrl: generatedAvatar("naming-cheatsheet"),
        type: "digital",
        sales: 5210,
      },
    }),
  ]);

  const blocks = await Promise.all(
    [
      {
        type: "link",
        title: "New: my design system course",
        subtitle: "Enrolment closes Friday",
        url: "https://example.com/course",
        highlight: true,
        clicks: 4820,
      },
      {
        type: "product",
        title: "Starter kit",
        config: JSON.stringify({ productId: products[0].id }),
        clicks: 3110,
      },
      {
        type: "email",
        title: "The Tuesday Note",
        subtitle: "One design idea, every week. 24k readers.",
        config: JSON.stringify({ buttonLabel: "Join", placeholder: "you@email.com" }),
        clicks: 0,
      },
      { type: "header", title: "Work with me", clicks: 0 },
      {
        type: "calendar",
        title: "Book a portfolio review",
        subtitle: "45 minutes · recorded",
        url: "https://cal.com/maya",
        clicks: 940,
      },
      {
        type: "link",
        title: "Portfolio",
        subtitle: "Selected work 2019–2026",
        url: "https://example.com/work",
        clicks: 2260,
      },
      {
        type: "video",
        title: "How I ship a design system in a week",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        clicks: 1180,
      },
      {
        type: "faq",
        title: "Before you ask",
        config: JSON.stringify({
          items: [
            { q: "Do you take freelance work?", a: "Two projects a quarter. Book a call above and we'll talk." },
            { q: "What tools do you use?", a: "Figma, Linear, and far too many terminal aliases." },
          ],
        }),
        clicks: 0,
      },
      { type: "socials", title: "", clicks: 0 },
    ].map((b, position) =>
      prisma.block.create({
        data: {
          userId: user.id,
          type: b.type,
          title: b.title ?? "",
          subtitle: b.subtitle ?? "",
          url: b.url ?? "",
          config: b.config ?? "{}",
          highlight: b.highlight ?? false,
          clicks: b.clicks ?? 0,
          position,
        },
      }),
    ),
  );

  const clickableBlocks = blocks.filter((b) => b.clicks > 0);
  const random = makeRandom(20260820);

  const pageViews: { userId: string; referrer: string; device: string; createdAt: Date }[] = [];
  const clickEvents: { userId: string; blockId: string; referrer: string; device: string; createdAt: Date }[] = [];

  for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo--) {
    // A gentle upward trend with a weekend dip and some noise.
    const trend = 1 + (HISTORY_DAYS - 1 - daysAgo) / 60;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const base = 42 * trend * (weekend ? 0.72 : 1) * (0.75 + random() * 0.5);
    const views = Math.max(4, Math.round(base));

    for (let i = 0; i < views; i++) {
      const at = new Date(date);
      at.setHours(Math.floor(random() * 24), Math.floor(random() * 60), Math.floor(random() * 60), 0);
      pageViews.push({
        userId: user.id,
        referrer: REFERRERS[Math.floor(random() * REFERRERS.length)],
        device: DEVICES[Math.floor(random() * DEVICES.length)],
        createdAt: at,
      });
    }

    const clicks = Math.round(views * (0.28 + random() * 0.12));
    for (let i = 0; i < clicks; i++) {
      const at = new Date(date);
      at.setHours(Math.floor(random() * 24), Math.floor(random() * 60), Math.floor(random() * 60), 0);
      // Weight the top link more heavily than the rest.
      const weighted = random() < 0.4 ? 0 : Math.floor(random() * clickableBlocks.length);
      clickEvents.push({
        userId: user.id,
        blockId: clickableBlocks[weighted].id,
        referrer: REFERRERS[Math.floor(random() * REFERRERS.length)],
        device: DEVICES[Math.floor(random() * DEVICES.length)],
        createdAt: at,
      });
    }
  }

  // createMany in chunks keeps the SQLite parameter count in range.
  const chunk = <T,>(items: T[], size: number) =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

  for (const part of chunk(pageViews, 500)) {
    await prisma.pageView.createMany({ data: part });
  }
  for (const part of chunk(clickEvents, 500)) {
    await prisma.clickEvent.createMany({ data: part });
  }

  const firstNames = ["alex", "sam", "jordan", "riley", "casey", "morgan", "avery", "quinn", "rowan", "sasha", "noor", "kai"];
  const domains = ["gmail.com", "hey.com", "proton.me", "outlook.com", "fastmail.com"];
  const subscribers = Array.from({ length: 148 }, (_, i) => {
    const created = new Date();
    created.setDate(created.getDate() - Math.floor(random() * HISTORY_DAYS));
    return {
      userId: user.id,
      email: `${firstNames[i % firstNames.length]}${i}@${domains[i % domains.length]}`,
      name: "",
      source: "page",
      createdAt: created,
    };
  });
  for (const part of chunk(subscribers, 300)) {
    await prisma.subscriber.createMany({ data: part });
  }

  const orders = Array.from({ length: 64 }, (_, i) => {
    const created = new Date();
    created.setDate(created.getDate() - Math.floor(random() * HISTORY_DAYS));
    const tip = random() < 0.35;
    const product = products[Math.floor(random() * 2)];
    return {
      userId: user.id,
      productId: tip ? null : product.id,
      email: `${firstNames[i % firstNames.length]}${i}@${domains[i % domains.length]}`,
      amountCents: tip ? [300, 500, 1500][Math.floor(random() * 3)] : product.priceCents,
      status: "paid",
      createdAt: created,
    };
  });
  for (const part of chunk(orders, 300)) {
    await prisma.order.createMany({ data: part });
  }

  console.log(`✓ Demo account ready — ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  ${pageViews.length} views · ${clickEvents.length} clicks · ${subscribers.length} subscribers · ${orders.length} orders`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
