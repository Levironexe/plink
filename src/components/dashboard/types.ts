import type { PublicBlock, PublicProduct, PublicSocial } from "@/components/profile/types";
import type { ThemeShape } from "@/lib/themes";

export type EditorBlock = PublicBlock & { clicks: number };

export type EditorProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  verified: boolean;
  category: string | null;
  location: string | null;
  plan: string;
};

export type EditorData = {
  profile: EditorProfile;
  theme: ThemeShape;
  blocks: EditorBlock[];
  socials: PublicSocial[];
  products: PublicProduct[];
};
