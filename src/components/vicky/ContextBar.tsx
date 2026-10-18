import { useLocation, useNavigate } from "@tanstack/react-router";
import { useVickySession } from "@/hooks/use-vicky-dashboard";
import { meetingSearchSchema } from "@/lib/vicky-inputs";
import { CompanySwitcher } from "./CompanySwitcher";
import { MeetingPickers } from "./MeetingPickers";
export function ContextBar({ bare = false }: { bare?: boolean }) {
  const location = useLocation(),
    navigate = useNavigate(),
    session = useVickySession();
  const choice = meetingSearchSchema.parse(location.search);
  return (
    <div className={bare ? "" : "shrink-0 border-b border-border bg-section"}>
      <div
        className={
          bare
            ? "flex flex-wrap items-center justify-center gap-3"
            : "mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 py-3"
        }
      >
        <CompanySwitcher founderId={session?.user.id} />
        {!bare && <span className="hidden h-6 border-l border-border sm:block" />}
        <MeetingPickers
          {...choice}
          onChange={(next) => {
            if (location.pathname.startsWith("/practice/"))
              void navigate({
                to: "/practice/$conversationId",
                params: { conversationId: location.pathname.split("/")[2] ?? "" },
                search: {
                  ...location.search,
                  ...choice,
                  ...next,
                  mode: location.search.mode ?? "ask",
                },
              });
            else
              void navigate({
                to:
                  location.pathname === "/learn"
                    ? "/learn"
                    : location.pathname === "/practice"
                      ? "/practice"
                      : "/",
                search: {
                  ...location.search,
                  ...choice,
                  ...next,
                  mode: location.search.mode ?? "ask",
                },
              });
          }}
        />
      </div>
    </div>
  );
}
