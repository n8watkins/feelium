import { PageHeader } from "@/components/page-header";
import { TagManager } from "@/components/tracking/tag-manager";
import { listTags } from "@/server/data";

export const metadata = { title: "Tags" };

export default async function TagsPage() {
  const tags = await listTags();

  return (
    <>
      <PageHeader
        title="Tags"
        description="Reusable labels you can attach to check-ins."
        backHref="/settings"
        backLabel="Settings"
      />
      <div className="px-4 pt-2 md:px-8">
        <TagManager tags={tags.map((t) => ({ id: t.id, name: t.name }))} />
      </div>
    </>
  );
}
