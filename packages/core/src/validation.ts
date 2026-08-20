import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username is too long")
    .regex(/^[a-z0-9._-]+$/, "Use lowercase letters, numbers, dots, dashes or underscores"),
  displayName: z.string().min(1).max(60).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const blockSchema = z.object({
  type: z.string(),
  title: z.string().max(120).optional(),
  subtitle: z.string().max(240).optional(),
  url: z.string().max(500).optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  config: z.string().optional(),
  visible: z.boolean().optional(),
  highlight: z.boolean().optional(),
});

export const profileSchema = z.object({
  displayName: z.string().min(1, "Add a display name").max(60),
  bio: z.string().max(300).optional(),
  avatarUrl: z.string().max(500).nullable().optional(),
  bannerUrl: z.string().max(500).nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  location: z.string().max(80).nullable().optional(),
});
