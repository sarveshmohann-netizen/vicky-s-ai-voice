import { createFileRoute } from "@tanstack/react-router";
import { PracticePage } from "@/components/vicky/PracticeWorkspace";
import { practiceSearchSchema } from "@/lib/conversations";
export const Route = createFileRoute("/practice_/$conversationId")({
  validateSearch: (input) => practiceSearchSchema.parse(input),
  head: () => ({
    meta: [
      { title: "Conversation · Vicky Investor Practice" },
      {
        name: "description",
        content: "Continue your private investor practice conversation with Vicky.",
      },
      { property: "og:title", content: "Conversation · Vicky Investor Practice" },
      {
        property: "og:description",
        content: "Saved investor coaching, answer editing and mock-meeting scorecards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PracticeConversation,
});
function PracticeConversation() {
  return <PracticePage id={Route.useParams().conversationId} search={Route.useSearch()} />;
}
