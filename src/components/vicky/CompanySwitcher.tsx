import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { Plus, Settings2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listCompanies } from "@/lib/companies.functions";
import { meetingSearchSchema } from "@/lib/vicky-inputs";
import { CompanyDialog } from "./CompanyDialog";
import { SessionGate } from "./AppShell";
import { Dialog,DialogContent,DialogTitle } from "@/components/ui/dialog";
export function CompanySwitcher({ founderId }: { founderId?: string | undefined }) {
  const location = useLocation();
  const navigate = useNavigate();
  const choice = meetingSearchSchema.parse(location.search);
  const companies = useQuery({
    queryKey: ["companies", founderId],
    queryFn: () => listCompanies(),
    enabled: !!founderId,
  });
  const [dialog, setDialog] = useState<"add" | "edit" | null>(null);
  const selected = companies.data?.find((c) => c.id === choice.company_id);
  async function select(id?: string) {
    const to = location.pathname.startsWith("/practice") ? "/practice" : location.pathname === "/learn" ? "/learn" : "/";
    await navigate({ to, search: { ...choice, company_id: id, mode: "ask" } });
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Building2 className="size-4 text-muted-foreground" />
      <Select
        value={choice.company_id ?? "sample"}
        onValueChange={(v) => void select(v === "sample" ? undefined : v)}
      >
        <SelectTrigger aria-label="Company" className="w-full min-w-0 bg-card sm:w-48">
          <SelectValue>
            {selected?.name ?? (choice.company_id ? "Your company" : "Sample: Tidewell")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sample">Sample: Tidewell</SelectItem>
          {companies.data?.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={() => setDialog("add")}>
        <Plus className="size-3.5" />
        Add your company
      </Button>
      {choice.company_id && (
        <Button variant="ghost" size="sm" onClick={() => setDialog("edit")}>
          <Settings2 className="size-3.5" />
          Company details
        </Button>
      )}
      {companies.isError && (
        <p role="alert" className="text-xs text-destructive">
          {companies.error.message}
        </p>
      )}
      {dialog && !founderId && <Dialog open onOpenChange={() => setDialog(null)}><DialogContent><DialogTitle>Add your company</DialogTitle><SessionGate>{() => <CompanyDialog onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />}</SessionGate></DialogContent></Dialog>}
      {dialog && founderId && (
        <CompanyDialog
          key={dialog + (choice.company_id ?? "")}
          companyId={dialog === "edit" ? choice.company_id : undefined}
          onClose={() => setDialog(null)}
          onSaved={(id) => {
            setDialog(null);
            void navigate({ to: "/", search: { ...choice, company_id: id } });
          }}
        />
      )}
    </div>
  );
}
