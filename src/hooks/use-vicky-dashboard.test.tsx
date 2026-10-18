import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { analyzeTidewell } from "@/lib/vicky/tidewell/analysis";
import { meetingBrief } from "@/lib/vicky/tidewell/brief";
import { useVickyDashboard } from "./use-vicky-dashboard";

const auth = vi.hoisted(() => ({ listener: (_event: string, _session: Session | null) => {} }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: (listener: typeof auth.listener) => {
        auth.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  },
}));
vi.mock("@/lib/vicky.functions", () => ({
  getTidewellAnalysis: async () => analyzeTidewell(),
  getMeetingBrief: async ({ data }: { data: { persona: "lead-seed"; stage: "seed" } }) =>
    meetingBrief(data.persona, data.stage),
}));
vi.mock("@/lib/companies.functions", () => ({ getCompanyDashboard: vi.fn() }));

it("preserves hook order across sign-in, investor changes, company selection and sign-out", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender, unmount } = renderHook(
    ({ persona, company_id }: { persona: "lead-seed" | "yc"; company_id: string | undefined }) =>
      useVickyDashboard({ persona, stage: "seed", company_id }),
    {
      wrapper,
      initialProps: {
        persona: "lead-seed" as "lead-seed" | "yc",
        company_id: undefined as string | undefined,
      },
    },
  );
  expect(result.current.data?.brief.lens.persona).toBe("lead-seed");
  act(() =>
    auth.listener("SIGNED_IN", { user: { id: "6997c3be-193f-4536-90da-7e2bf8c4c0a3" } } as Session),
  );
  await waitFor(() =>
    expect(result.current.session?.user.id).toBe("6997c3be-193f-4536-90da-7e2bf8c4c0a3"),
  );
  rerender({ persona: "yc", company_id: undefined });
  expect(result.current.data?.brief.lens.persona).toBe("yc");
  act(() => auth.listener("SIGNED_OUT", null));
  rerender({ persona: "yc", company_id: "00000000-0000-4000-8000-000000000001" });
  expect(result.current.data).toBeUndefined();
  rerender({ persona: "lead-seed", company_id: undefined });
  expect(result.current.data?.analysis.company.name).toBe(analyzeTidewell().company.name);
  unmount();
  client.clear();
});
