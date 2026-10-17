import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/vicky/AppShell';
import { Chat } from '@/components/vicky/Chat';

export const Route = createFileRoute('/ask')({
  head: () => ({ meta: [
    { title: 'Ask Vicky · June Analytics' },
    { name: 'description', content: 'Ask Vicky about Tidewell’s numbers, deck claims and forecast before you raise.' },
    { property: 'og:title', content: 'Ask Vicky · June Analytics' },
    { property: 'og:description', content: 'An AI VC coach that explains Tidewell’s computed numbers.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => <AppShell eyebrow="Coaching" title="Ask Vicky" intro="Ask anything about Tidewell’s metrics, deck or forecast. Vicky answers from the computed numbers.">
    {id => <Chat founderId={id} mode="ask" placeholder="e.g. Why does the deck’s ARR not hold up?"
      empty={<div><p className="font-medium">Try asking</p><ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        <li>• What will a lead investor push back on first?</li><li>• Explain our CAC payback in plain words.</li><li>• Which forecast assumption is riskiest?</li></ul></div>} />}
  </AppShell>,
});
