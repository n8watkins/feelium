import { PageHeader } from "@/components/page-header";
import { CategoryManager } from "@/components/tracking/category-manager";
import { listBehaviorCategories } from "@/server/data";

export const metadata = { title: "Behavior categories" };

export default async function BehaviorCategoriesPage() {
  const categories = await listBehaviorCategories();

  return (
    <>
      <PageHeader
        title="Behavior categories"
        description="Group related behaviors and give each group a color."
        backHref="/settings/behaviors"
        backLabel="Behaviors"
      />
      <div className="px-4 pb-6 pt-2 md:px-8">
        <CategoryManager
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
            color: category.color,
          }))}
        />
      </div>
    </>
  );
}
