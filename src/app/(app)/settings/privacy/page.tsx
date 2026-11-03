import { PageHeader } from "@/components/page-header";
import { PrivacyCard } from "@/components/privacy-card";

export const metadata = { title: "Privacy" };

export default function PrivacySettingsPage() {
  return (
    <>
      <PageHeader title="Privacy" backHref="/settings" backLabel="Settings" />
      <div className="space-y-6 px-4 pt-2 md:px-8">
        <PrivacyCard />
      </div>
    </>
  );
}
