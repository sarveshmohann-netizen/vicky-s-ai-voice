import { createFileRoute } from "@tanstack/react-router";
import { PracticePage } from "@/components/vicky/PracticeWorkspace";
import { practiceSearchSchema } from "@/lib/conversations";
export const Route = createFileRoute("/practice")({
  validateSearch: (input) => practiceSearchSchema.parse(input),
  head: () => ({
    meta: [
      { title: "Vicky Chat · June Analytics" },
      {
        name: "description",
        content: "Private saved conversations for investor questions and mock meetings with Vicky.",
      },
      { property: "og:title", content: "Vicky Chat · June Analytics" },
      {
        property: "og:description",
        content: "Prepare, rehearse and return to your saved investor conversations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Practice,
});
function Practice() {
  return <PracticePage search={Route.useSearch()} />;
}
