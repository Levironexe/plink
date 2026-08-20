import type { ThemeShape } from "@/lib/themes";

export type PublicBlock = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  url: string;
  imageUrl: string | null;
  config: string;
  visible: boolean;
  highlight: boolean;
};

export type PublicSocial = {
  id: string;
  platform: string;
  url: string;
};

export type PublicProduct = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  type: string;
};

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  verified: boolean;
  category: string | null;
  location: string | null;
  theme: ThemeShape;
  blocks: PublicBlock[];
  socials: PublicSocial[];
  products: PublicProduct[];
};
