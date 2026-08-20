import type { LucideIcon } from "lucide-react";
import {
  Link2, Heading1, AlignLeft, Image as ImageIcon, CirclePlay, Share2, Mail,
  Coffee, ShoppingBag, Minus, LayoutGrid, HelpCircle, CalendarDays, Music,
} from "lucide-react";

export type BlockType =
  | "link" | "header" | "text" | "image" | "video" | "socials" | "email"
  | "tipjar" | "product" | "divider" | "gallery" | "faq" | "calendar" | "music";

export type BlockDefinition = {
  type: BlockType;
  label: string;
  description: string;
  icon: LucideIcon;
  category: "Essentials" | "Content" | "Monetize" | "Grow";
  defaults: {
    title?: string;
    subtitle?: string;
    url?: string;
    config?: Record<string, unknown>;
  };
};

export const BLOCK_LIBRARY: BlockDefinition[] = [
  {
    type: "link",
    label: "Link",
    description: "Send visitors anywhere with a tappable button.",
    icon: Link2,
    category: "Essentials",
    defaults: { title: "My new link", url: "https://" },
  },
  {
    type: "header",
    label: "Header",
    description: "Break your page into labelled sections.",
    icon: Heading1,
    category: "Essentials",
    defaults: { title: "Section title" },
  },
  {
    type: "text",
    label: "Text",
    description: "A paragraph for context, updates or a note.",
    icon: AlignLeft,
    category: "Content",
    defaults: { title: "", subtitle: "Tell your audience something." },
  },
  {
    type: "image",
    label: "Image",
    description: "Show a photo, poster or cover art.",
    icon: ImageIcon,
    category: "Content",
    defaults: { title: "", url: "" },
  },
  {
    type: "video",
    label: "Video",
    description: "Embed a YouTube or Vimeo video inline.",
    icon: CirclePlay,
    category: "Content",
    defaults: { title: "Watch this", url: "https://www.youtube.com/watch?v=" },
  },
  {
    type: "socials",
    label: "Social icons",
    description: "A compact row of your social profiles.",
    icon: Share2,
    category: "Essentials",
    defaults: { title: "" },
  },
  {
    type: "email",
    label: "Email capture",
    description: "Collect emails straight into your audience list.",
    icon: Mail,
    category: "Grow",
    defaults: {
      title: "Join my newsletter",
      subtitle: "Weekly drops, no spam.",
      config: { buttonLabel: "Subscribe", placeholder: "you@email.com" },
    },
  },
  {
    type: "tipjar",
    label: "Tip jar",
    description: "Let supporters send you a one-off tip.",
    icon: Coffee,
    category: "Monetize",
    defaults: {
      title: "Buy me a coffee",
      subtitle: "Support the work",
      config: { amounts: [3, 5, 10], currency: "USD" },
    },
  },
  {
    type: "product",
    label: "Product",
    description: "Sell a digital product, preset pack or service.",
    icon: ShoppingBag,
    category: "Monetize",
    defaults: { title: "My product", config: { productId: "" } },
  },
  {
    type: "divider",
    label: "Divider",
    description: "A little breathing room between blocks.",
    icon: Minus,
    category: "Content",
    defaults: {},
  },
  {
    type: "gallery",
    label: "Gallery",
    description: "A scrollable row of images with links.",
    icon: LayoutGrid,
    category: "Content",
    defaults: { title: "Recent work", config: { items: [] } },
  },
  {
    type: "faq",
    label: "FAQ",
    description: "Answer the questions you always get asked.",
    icon: HelpCircle,
    category: "Grow",
    defaults: { title: "FAQ", config: { items: [{ q: "How do we work together?", a: "Send me a message." }] } },
  },
  {
    type: "calendar",
    label: "Booking",
    description: "Link a calendar so people can book time.",
    icon: CalendarDays,
    category: "Monetize",
    defaults: { title: "Book a call", subtitle: "30 min intro", url: "https://cal.com/" },
  },
  {
    type: "music",
    label: "Music",
    description: "Embed a Spotify or SoundCloud player.",
    icon: Music,
    category: "Content",
    defaults: { title: "Latest release", url: "https://open.spotify.com/" },
  },
];

export const BLOCK_MAP = new Map(BLOCK_LIBRARY.map((b) => [b.type, b]));

export function blockDefinition(type: string) {
  return BLOCK_MAP.get(type as BlockType);
}

export function parseConfig<T = Record<string, unknown>>(raw: string | null | undefined): T {
  if (!raw) return {} as T;
  try {
    const parsed = JSON.parse(raw);
    return (typeof parsed === "object" && parsed !== null ? parsed : {}) as T;
  } catch {
    return {} as T;
  }
}

/** Convert a share URL into an embeddable player URL. Returns null when unsupported. */
export function toEmbedUrl(raw: string): { src: string; aspect: string } | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).pop();
    if (id) return { src: `https://www.youtube-nocookie.com/embed/${id}`, aspect: "16 / 9" };
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    if (id) return { src: `https://www.youtube-nocookie.com/embed/${id}`, aspect: "16 / 9" };
  }
  if (host === "vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).pop();
    if (id) return { src: `https://player.vimeo.com/video/${id}`, aspect: "16 / 9" };
  }
  if (host === "open.spotify.com") {
    const path = url.pathname.replace(/^\/(intl-[a-z]+\/)?/, "/");
    return { src: `https://open.spotify.com/embed${path}`, aspect: "auto" };
  }
  if (host === "soundcloud.com") {
    return {
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.toString())}&color=%23ffffff&auto_play=false`,
      aspect: "auto",
    };
  }
  if (host === "player.vimeo.com" || host === "www.youtube-nocookie.com") {
    return { src: url.toString(), aspect: "16 / 9" };
  }
  return null;
}
