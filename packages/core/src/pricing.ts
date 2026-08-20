export type Plan = {
  id: "free" | "pro" | "vip";
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  cta: string;
  featured?: boolean;
  features: string[];
  limits: { blocks: number | null; products: number | null; subscribers: number | null };
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Everything you need to get a real page live.",
    monthly: 0,
    yearly: 0,
    cta: "Start free",
    features: [
      "Unlimited links and blocks",
      "12 themes with full colour control",
      "Email capture, up to 500 subscribers",
      "Basic analytics (7-day history)",
      "Sell up to 3 products (5% fee)",
      "Plink badge on your page",
    ],
    limits: { blocks: null, products: 3, subscribers: 500 },
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For creators earning from their audience.",
    monthly: 9,
    yearly: 84,
    cta: "Go Pro",
    featured: true,
    features: [
      "Everything in Free",
      "0% platform fee on every sale",
      "Unlimited products and subscribers",
      "Full analytics history + referrers",
      "Media kit with editable rate card",
      "Remove Plink branding",
      "Custom domain",
    ],
    limits: { blocks: null, products: null, subscribers: null },
  },
  {
    id: "vip",
    name: "Studio",
    tagline: "For teams and creators running a business.",
    monthly: 29,
    yearly: 288,
    cta: "Talk to us",
    features: [
      "Everything in Pro",
      "Up to 5 pages under one account",
      "Team seats with roles",
      "Priority support",
      "Advanced audience segments",
      "Data export API",
    ],
    limits: { blocks: null, products: null, subscribers: null },
  },
];

export const FAQS = [
  {
    q: "Is Plink really free?",
    a: "Yes. The free plan is not a trial — you get unlimited links, all twelve themes, email capture and analytics without ever entering a card. Pro exists for creators who want to sell without a platform fee, remove branding and use a custom domain.",
  },
  {
    q: "Can I move my existing link-in-bio over?",
    a: "You can rebuild a typical page in about two minutes: add your links, pick a theme, drop in your socials. Everything is drag-and-drop and the live preview updates as you type.",
  },
  {
    q: "Who owns my email list?",
    a: "You do. Subscribers collected through your page can be exported to CSV at any time, on any plan. We never email your audience.",
  },
  {
    q: "What are the fees when I sell something?",
    a: "Free plans pay a 5% platform fee on sales. Pro and Studio pay 0% — you only cover the payment processor's own fee.",
  },
  {
    q: "Can I use my own domain?",
    a: "Yes, on Pro and above. Point a CNAME at Plink and your page lives on yourdomain.com with SSL handled for you.",
  },
  {
    q: "What happens to my page if I downgrade?",
    a: "Your page stays live. Pro-only features (custom domain, hidden branding, unlimited products) switch off, but nothing is deleted — upgrade again and it all comes back.",
  },
];
