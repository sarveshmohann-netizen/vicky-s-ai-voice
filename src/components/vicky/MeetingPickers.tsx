import { PERSONAS, STAGES, type PersonaId, type Stage } from "@/lib/vicky/knowledge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { personaSchema, stageSchema } from "@/lib/vicky-inputs";

export function MeetingPickers({
  persona,
  stage,
  onChange,
}: {
  persona: PersonaId;
  stage: Stage;
  onChange: (choice: { persona: PersonaId; stage: Stage }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-full min-w-0 sm:w-52">
        <label id="investor-label" className="sr-only">
          Who are you pitching?
        </label>
        <Select
          value={persona}
          onValueChange={(value) => onChange({ persona: personaSchema.parse(value), stage })}
        >
          <SelectTrigger aria-labelledby="investor-label" className="bg-card">
            <SelectValue>{PERSONAS[persona].name}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.values(PERSONAS).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="block font-medium">{p.name}</span>
                <span className="block text-xs">{p.cheque}</span>
                {p.basedOn && (
                  <span className="block text-[11px]">Based on their published advice</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-32">
        <label id="stage-label" className="sr-only">
          Stage
        </label>
        <Select
          value={stage}
          onValueChange={(value) => onChange({ persona, stage: stageSchema.parse(value) })}
        >
          <SelectTrigger aria-labelledby="stage-label" className="bg-card">
            <SelectValue>{STAGES[stage].label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.values(STAGES).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
