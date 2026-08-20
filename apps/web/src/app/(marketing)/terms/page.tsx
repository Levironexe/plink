import type { Metadata } from "next";
import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="20 August 2026"
      intro="Plink is an open-source study of the link-in-bio category. These terms describe the deal between you and Plink when you use the service."
      sections={[
        {
          heading: "1. Your account",
          body: [
            "You must be at least 13 years old to create an account, and you are responsible for everything that happens under it. Keep your password to yourself.",
            "One person or organisation per account. Usernames are assigned first-come, first-served, and we may reclaim names that impersonate someone else or that sit unused.",
          ],
        },
        {
          heading: "2. Your content",
          body: [
            "You keep every right you already had in the text, images, links and products you publish through Plink. You grant us only the licence we need to store your content and show it to visitors of your page.",
            "You are responsible for having the rights to what you publish, and for making sure it is lawful where your audience reads it.",
          ],
        },
        {
          heading: "3. Acceptable use",
          body: [
            "No malware, phishing, spam, harassment, or content that is illegal where it is published. No linking to material that sexually exploits minors. No misrepresenting who you are in a way designed to deceive.",
            "We may suspend or remove a page that breaks these rules, usually after a warning where the situation allows one.",
          ],
        },
        {
          heading: "4. Payments",
          body: [
            "Paid plans renew automatically until cancelled. Cancel any time and your plan stays active until the end of the period you already paid for.",
            "Where Plink processes sales on your behalf, the platform fee for your plan applies in addition to the payment processor's own fees. Payouts follow the processor's schedule.",
          ],
        },
        {
          heading: "5. Availability",
          body: [
            "We aim for high availability but do not promise uninterrupted service. Features may change as the product develops.",
            "You can export your links, subscribers and orders at any time.",
          ],
        },
        {
          heading: "6. Ending things",
          body: [
            "You can delete your account whenever you like; doing so removes your page and your data from our systems within 30 days, excluding records we must keep for tax or legal reasons.",
            "We may end an account that materially breaches these terms.",
          ],
        },
      ]}
    />
  );
}
