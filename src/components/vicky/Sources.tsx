import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { sourceDescription, splitSourceText } from '@/lib/vicky-sources';

export function SourceChip({ tag }: { tag: string }) {
  const full = sourceDescription(tag);
  return <TooltipProvider><Popover><Tooltip><TooltipTrigger asChild><PopoverTrigger asChild>
    <Button variant="secondary" size="sm" className="mx-0.5 inline-flex h-6 rounded-full px-2 py-0 align-baseline text-[11px] font-medium">{tag}</Button>
  </PopoverTrigger></TooltipTrigger><TooltipContent className="max-w-xs">{full}</TooltipContent></Tooltip><PopoverContent className="text-xs">{full}</PopoverContent></Popover></TooltipProvider>;
}

export function SourceText({ children }: { children: string }) {
  return <>{splitSourceText(children).map((part, i) => part.tag ? <SourceChip key={i} tag={part.tag} /> : part.text)}</>;
}

export function Sources({ refs }: { refs: string[] }) {
  return <span className="inline-flex flex-wrap gap-1">{refs.map(tag => <SourceChip key={tag} tag={tag} />)}</span>;
}