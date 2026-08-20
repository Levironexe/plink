import type { PublicBlock, PublicProduct, PublicSocial } from "./profile-types";
import type { ThemeShape } from "./themes";

export type EditorBlock = PublicBlock & {
  clicks: number;
  /** ISO strings, or null for an open bound. Drives scheduling in the editor. */
  startsAt: string | null;
  endsAt: string | null;
};

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
