import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="20 August 2026"
      intro="What Plink collects, why, and what we never do with it."
      sections={[
        {
          heading: "What we collect",
          body: [
            "Account data: your email address, a hashed password, your username and anything you choose to put on your profile.",
            "Page analytics: a record that a page was viewed or a link was tapped, along with the referring domain and a coarse device type. We do not set advertising cookies and we do not build cross-site profiles of your visitors.",
            "Audience data: email addresses your visitors give you directly through an email capture block.",
          ],
        },
        {
          heading: "What we never do",
          body: [
            "We do not sell your data, and we do not sell or rent your subscriber list.",
            "We do not email your audience on our own behalf. Your list is yours.",
            "We do not track your visitors across other websites.",
          ],
        },
        {
          heading: "Cookies",
          body: [
            "One cookie: a signed, HTTP-only session cookie that keeps you logged in. It is not used for advertising and is removed when you log out.",
          ],
        },
        {
          heading: "Your rights",
          body: [
            "Export your subscribers, orders and links to CSV at any time from your dashboard.",
            "Ask us to delete your account and we will remove your data within 30 days, aside from records we must retain for legal or tax reasons.",
          ],
        },
        {
          heading: "Contact",
          body: ["Questions about this policy can go to privacy@plink.example."],
        },
      ]}
    />
  );
}
