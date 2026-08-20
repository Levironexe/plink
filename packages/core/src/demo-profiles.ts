import { generatedAvatar } from "./avatar";
import { THEME_PRESETS, presetToTheme, type ThemeShape } from "./themes";
import type { PublicProfile } from "./profile-types";

function theme(id: string, overrides: Partial<ThemeShape> = {}): ThemeShape {
  const preset = THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
  return { ...presetToTheme(preset), ...overrides };
}

let n = 0;
const b = (
  type: string,
  data: Partial<PublicProfile["blocks"][number]> = {},
): PublicProfile["blocks"][number] => ({
  id: `demo-${++n}`,
  type,
  title: "",
  subtitle: "",
  url: "",
  imageUrl: null,
  config: "{}",
  visible: true,
  highlight: false,
  ...data,
});

const s = (platform: string, url: string) => ({ id: `s-${platform}-${++n}`, platform, url });

export const DEMO_PROFILES: PublicProfile[] = [
  {
    id: "demo-maya",
    username: "mayabuilds",
    displayName: "Maya Osei",
    bio: "Product designer turned indie maker. I write about design systems, ship small tools, and answer every DM.",
    avatarUrl: generatedAvatar("mayabuilds", "MO"),
    bannerUrl: null,
    verified: true,
    category: "Design & tech",
    location: "Lisbon",
    theme: theme("moonlight"),
    socials: [
      s("instagram", "https://instagram.com/"),
      s("x", "https://x.com/"),
      s("youtube", "https://youtube.com/"),
      s("github", "https://github.com/"),
    ],
    products: [
      {
        id: "p-maya-1",
        name: "The Design System Starter",
        description: "62 Figma components + tokens, ready to fork.",
        priceCents: 4900,
        currency: "USD",
        imageUrl: generatedAvatar("design-system-kit"),
        type: "digital",
      },
    ],
    blocks: [
      b("link", { title: "New: my design system course", subtitle: "Enrolment closes Friday", url: "https://example.com/course", highlight: true }),
      b("product", { title: "Starter kit", config: JSON.stringify({ productId: "p-maya-1" }) }),
      b("email", {
        title: "The Tuesday Note",
        subtitle: "One design idea, every week. 24k readers.",
        config: JSON.stringify({ buttonLabel: "Join", placeholder: "you@email.com" }),
      }),
      b("link", { title: "Portfolio", subtitle: "Selected work 2019–2026", url: "https://example.com" }),
      b("socials"),
    ],
  },
  {
    id: "demo-noah",
    username: "noahcooks",
    displayName: "Noah Reyes",
    bio: "30-minute dinners, no fuss. New recipe every Sunday.",
    avatarUrl: generatedAvatar("noahcooks", "NR"),
    bannerUrl: null,
    verified: false,
    category: "Food creator",
    location: "Austin, TX",
    theme: theme("sunbeam"),
    socials: [s("tiktok", "https://tiktok.com/"), s("instagram", "https://instagram.com/"), s("youtube", "https://youtube.com/")],
    products: [
      {
        id: "p-noah-1",
        name: "Weeknight Cookbook (PDF)",
        description: "40 recipes, all under 30 minutes.",
        priceCents: 1800,
        currency: "USD",
        imageUrl: generatedAvatar("cookbook"),
        type: "digital",
      },
    ],
    blocks: [
      b("header", { title: "This week" }),
      b("link", { title: "🍜 15-minute chilli garlic noodles", url: "https://example.com/recipe" }),
      b("product", { config: JSON.stringify({ productId: "p-noah-1" }) }),
      b("tipjar", { title: "Buy me a coffee", subtitle: "Fuels the Sunday recipe testing", config: JSON.stringify({ amounts: [3, 5, 15] }) }),
      b("link", { title: "My kitchen gear", subtitle: "Everything I actually use", url: "https://example.com/gear" }),
      b("socials"),
    ],
  },
  {
    id: "demo-atlas",
    username: "atlas.sound",
    displayName: "ATLAS",
    bio: "Producer. New EP ‘NIGHTFORM’ out now.",
    avatarUrl: generatedAvatar("atlas.sound", "A"),
    bannerUrl: null,
    verified: true,
    category: "Music",
    location: null,
    theme: theme("noir"),
    socials: [s("spotify", "https://open.spotify.com/"), s("x", "https://x.com/"), s("tiktok", "https://tiktok.com/"), s("discord", "https://discord.gg/")],
    products: [],
    blocks: [
      b("link", { title: "NIGHTFORM — stream now", url: "https://open.spotify.com/", highlight: true }),
      b("link", { title: "Tour dates", subtitle: "EU + UK · Spring 2026", url: "https://example.com/tour" }),
      b("link", { title: "Sample pack vol. 3", url: "https://example.com/samples" }),
      b("faq", {
        title: "Working together",
        config: JSON.stringify({
          items: [
            { q: "Do you take beat commissions?", a: "Yes — two slots a month. Email the address below." },
            { q: "Can I use your samples commercially?", a: "Royalty-free with the paid licence." },
          ],
        }),
      }),
      b("socials"),
    ],
  },
  {
    id: "demo-june",
    username: "junestudio",
    displayName: "June Studio",
    bio: "Brand & web design for small teams. Currently booking Q3.",
    avatarUrl: generatedAvatar("junestudio", "JS"),
    bannerUrl: null,
    verified: false,
    category: "Studio",
    location: "Remote",
    theme: theme("linen"),
    socials: [s("instagram", "https://instagram.com/"), s("linkedin", "https://linkedin.com/"), s("website", "https://example.com")],
    products: [],
    blocks: [
      b("text", { title: "", subtitle: "We build brands that don’t look like everyone else’s." }),
      b("calendar", { title: "Book an intro call", subtitle: "20 minutes, no pitch deck", url: "https://cal.com/" }),
      b("link", { title: "Case studies", url: "https://example.com/work" }),
      b("link", { title: "Rate card 2026", url: "https://example.com/rates" }),
      b("socials"),
    ],
  },
  {
    id: "demo-kira",
    username: "kiralifts",
    displayName: "Kira Lund",
    bio: "Strength coach. Programs for people who hate gyms.",
    avatarUrl: generatedAvatar("kiralifts", "KL"),
    bannerUrl: null,
    verified: true,
    category: "Fitness",
    location: "Copenhagen",
    theme: theme("citrus"),
    socials: [s("instagram", "https://instagram.com/"), s("youtube", "https://youtube.com/"), s("substack", "https://example.substack.com")],
    products: [
      {
        id: "p-kira-1",
        name: "8-Week Home Strength",
        description: "Dumbbells only. Video for every movement.",
        priceCents: 6500,
        currency: "USD",
        imageUrl: generatedAvatar("strength-program"),
        type: "digital",
      },
    ],
    blocks: [
      b("product", { config: JSON.stringify({ productId: "p-kira-1" }) }),
      b("link", { title: "Free 5-day starter", subtitle: "No equipment needed", url: "https://example.com/free" }),
      b("email", { title: "Weekly training notes", subtitle: "Short, practical, free.", config: JSON.stringify({ buttonLabel: "Sign up" }) }),
      b("socials"),
    ],
  },
  {
    id: "demo-oma",
    username: "omatravels",
    displayName: "Oma Ade",
    bio: "Slow travel, big cities, cheap flights. 42 countries so far.",
    avatarUrl: generatedAvatar("omatravels", "OA"),
    bannerUrl: null,
    verified: false,
    category: "Travel",
    location: "Nairobi → Tokyo",
    theme: theme("arctic"),
    socials: [s("instagram", "https://instagram.com/"), s("tiktok", "https://tiktok.com/"), s("pinterest", "https://pinterest.com/")],
    products: [],
    blocks: [
      b("header", { title: "Start here" }),
      b("link", { title: "My flight deal alerts", subtitle: "Free, 2 emails a week", url: "https://example.com/deals", highlight: true }),
      b("link", { title: "Tokyo in 5 days — full itinerary", url: "https://example.com/tokyo" }),
      b("link", { title: "Packing list", url: "https://example.com/packing" }),
      b("tipjar", { title: "Fund the next trip", subtitle: "Every coffee helps", config: JSON.stringify({ amounts: [2, 8, 20] }) }),
      b("socials"),
    ],
  },
];

export const DEMO_BY_USERNAME = new Map(DEMO_PROFILES.map((p) => [p.username, p]));
