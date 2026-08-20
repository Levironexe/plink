import type { ComponentType, SVGProps } from "react";
import {
  InstagramIcon, TiktokIcon, XIcon, YoutubeIcon, TwitchIcon, LinkedinIcon,
  FacebookIcon, GithubIcon, SpotifyIcon, ThreadsIcon, PinterestIcon,
  DiscordIcon, SubstackIcon, WebsiteIcon,
} from "@/components/brand-icons";

export type SocialPlatform = {
  id: string;
  name: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
  placeholder: string;
  /** Turns a raw handle into a full profile URL. */
  toUrl: (value: string) => string;
};

const handle = (v: string) => v.trim().replace(/^@/, "");
const asUrl = (prefix: string) => (v: string) => {
  const value = v.trim();
  if (/^https?:\/\//i.test(value)) return value;
  return prefix + handle(value);
};

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { id: "instagram", name: "Instagram", icon: InstagramIcon, color: "#E1306C", placeholder: "@yourhandle", toUrl: asUrl("https://instagram.com/") },
  { id: "tiktok", name: "TikTok", icon: TiktokIcon, color: "#010101", placeholder: "@yourhandle", toUrl: asUrl("https://tiktok.com/@") },
  { id: "youtube", name: "YouTube", icon: YoutubeIcon, color: "#FF0000", placeholder: "@yourchannel", toUrl: asUrl("https://youtube.com/@") },
  { id: "x", name: "X", icon: XIcon, color: "#0f1419", placeholder: "@yourhandle", toUrl: asUrl("https://x.com/") },
  { id: "threads", name: "Threads", icon: ThreadsIcon, color: "#000000", placeholder: "@yourhandle", toUrl: asUrl("https://threads.net/@") },
  { id: "twitch", name: "Twitch", icon: TwitchIcon, color: "#9146FF", placeholder: "yourchannel", toUrl: asUrl("https://twitch.tv/") },
  { id: "spotify", name: "Spotify", icon: SpotifyIcon, color: "#1DB954", placeholder: "artist link", toUrl: asUrl("https://open.spotify.com/") },
  { id: "linkedin", name: "LinkedIn", icon: LinkedinIcon, color: "#0A66C2", placeholder: "in/yourname", toUrl: asUrl("https://linkedin.com/") },
  { id: "facebook", name: "Facebook", icon: FacebookIcon, color: "#1877F2", placeholder: "yourpage", toUrl: asUrl("https://facebook.com/") },
  { id: "pinterest", name: "Pinterest", icon: PinterestIcon, color: "#E60023", placeholder: "yourprofile", toUrl: asUrl("https://pinterest.com/") },
  { id: "discord", name: "Discord", icon: DiscordIcon, color: "#5865F2", placeholder: "invite link", toUrl: asUrl("https://discord.gg/") },
  { id: "github", name: "GitHub", icon: GithubIcon, color: "#181717", placeholder: "yourname", toUrl: asUrl("https://github.com/") },
  { id: "substack", name: "Substack", icon: SubstackIcon, color: "#FF6719", placeholder: "yourpub", toUrl: (v) => (/^https?:/i.test(v) ? v : `https://${handle(v)}.substack.com`) },
  { id: "website", name: "Website", icon: WebsiteIcon, color: "#334155", placeholder: "yoursite.com", toUrl: asUrl("https://") },
];

export const SOCIAL_MAP = new Map(SOCIAL_PLATFORMS.map((p) => [p.id, p]));

export function socialPlatform(id: string) {
  return SOCIAL_MAP.get(id);
}
