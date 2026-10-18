import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { formatMetric, type Metric } from '@/lib/vicky/tidewell/metrics';
import { shortRefs } from '@/lib/vicky/tidewell/refs';
import { Sources } from './Sources';

export function MetricsDialog({ metrics }: { metrics: Record<string, Metric> }) {
  return <Dialog><DialogTrigger asChild><Button variant="link" className="px-0 text-xs">All metrics <Info className="size-3" /></Button></DialogTrigger><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>All Tidewell metrics</DialogTitle></DialogHeader><TooltipProvider><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.values(metrics).map(m => <Tooltip key={m.id}><TooltipTrigger asChild><article tabIndex={0} className="metric-card rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">{m.label}</p><p className="my-2 text-xl font-semibold tabular-nums">{formatMetric(m)}</p><span className="text-[10px] font-semibold uppercase text-accent">{m.basis === 'historical' ? 'Historical' : 'Forecast'}</span><div className="mt-2"><Sources refs={shortRefs(m.source)} /></div></article></TooltipTrigger><TooltipContent className="max-w-sm text-xs"><p>{m.calculation}</p><p className="mt-2">{m.source}</p></TooltipContent></Tooltip>)}</div></TooltipProvider></DialogContent></Dialog>;
}