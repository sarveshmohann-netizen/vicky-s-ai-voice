import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageResponse } from "@/components/ai-elements/message";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import {
  parseReply,
  runScenario,
  describeScenario,
  type ScenarioInput,
  type ReplySegment,
  type ChartId,
} from "@/lib/vicky/coach";
import { glossary, glossaryMatchers } from "@/lib/vicky/glossary";
import type { Metric } from "@/lib/vicky/tidewell/metrics";
import { sourceTags, chatHeadingParagraphs } from "./Markdown";
import { extractCitations } from "@/lib/reply-citations";
import { sourceDescription } from "@/lib/vicky-sources";
import { SourceChip } from "./Sources";
import { ExternalLink } from "lucide-react";
import { EngineChart } from "./EngineChart";
import { ChartTooltip } from "./ChartTooltip";
import { formatValue } from "@/lib/chart-format";
import type { meetingSearchSchema } from "@/lib/vicky-inputs";
import type { z } from "zod";
type Choice = z.infer<typeof meetingSearchSchema>;
type MarkdownNode = { type: string; value?: string; url?: string; children?: MarkdownNode[] };
function glossaryLinks() {
  return (tree: MarkdownNode) => {
    const seen = new Set<string>();
    const visit = (node: MarkdownNode) => {
      if (!node.children || ["link", "code", "inlineCode"].includes(node.type)) return;
      node.children = node.children.flatMap((child: MarkdownNode) => {
        if (child.type !== "text" || !child.value) {
          visit(child);
          return [child];
        }
        let parts: MarkdownNode[] = [child];
        for (const matcher of glossaryMatchers()) {
          if (seen.has(matcher.id)) continue;
          parts = parts.flatMap((p) => {
            if (p.type !== "text") return [p];
            const m = matcher.pattern.exec(p.value ?? "");
            if (!m) return [p];
            seen.add(matcher.id);
            return [
              { type: "text", value: (p.value ?? "").slice(0, m.index) },
              {
                type: "link",
                url: "#term=" + matcher.id,
                children: [{ type: "text", value: m[0] }],
              },
              { type: "text", value: (p.value ?? "").slice(m.index + m[0].length) },
            ];
          });
        }
        return parts;
      });
    };
    visit(tree);
  };
}
function ScenarioCard({
  base,
  changes,
}: {
  base: ScenarioInput;
  changes: Extract<ReplySegment, { type: "scenario" }>["changes"];
}) {
  const [input, setInput] = useState({ ...base, ...changes });
  const result = runScenario(input);
  return (
    <article className="my-4 rounded-lg border border-border bg-section p-4">
      <h3 className="mb-3 text-sm font-semibold">What-if</h3>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { key: "monthlyGrowth", label: "Growth % / month", factor: 100 },
            { key: "monthlySpend", label: "Monthly spend", factor: 1 },
            { key: "raise", label: "Raise", factor: 1 },
          ] as const
        ).map((f) => (
          <label key={f.key} className="min-w-0 text-[10px] text-muted-foreground">
            {f.label}
            <Input
              aria-label={f.label}
              type="number"
              min={0}
              max={f.key === "monthlyGrowth" ? 100 : undefined}
              step={f.factor === 100 ? 0.1 : 1000}
              value={Number((input[f.key] * f.factor).toFixed(2))}
              onChange={(e) => {
                const value = Number(e.target.value) / f.factor;
                if (
                  Number.isFinite(value) &&
                  value >= 0 &&
                  (f.key !== "monthlyGrowth" || value <= 1)
                )
                  setInput({ ...input, [f.key]: value });
              }}
            />
          </label>
        ))}
      </div>
      <div className="mt-4 h-[200px]" role="img" aria-label="What-if MRR and cash">
        <ResponsiveContainer>
          <LineChart data={result.points}>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v) => (Number(v) === 0 ? "Now" : `M${v}`)}
              minTickGap={20}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={56}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v) => formatValue(Number(v), "usd", { compact: true })}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip kind="usd" />} />
            <Line
              dataKey="mrr"
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="cash"
              stroke="var(--chart-4)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs leading-relaxed">{describeScenario(result)}</p>
      <p className="mt-3 text-[10px] text-muted-foreground">
        Computed by Vicky's model from your numbers. A what-if, not a forecast.
      </p>
    </article>
  );
}
export function ReplyContent({
  text,
  charts,
  base,
  metrics,
  choice,
  streaming = false,
}: {
  text: string;
  charts: Partial<Record<ChartId, unknown[]>>;
  base: ScenarioInput | null;
  metrics: Record<string, Metric>;
  choice: Choice;
  streaming?: boolean;
}) {
  const terms = glossary(metrics);
  // Citations come out of the sentences and are listed once under the reply.
  const cited = extractCitations(text);
  return (
    <>
      {parseReply(cited.body).map((part, i) =>
        part.type === "chart" ? (
          <EngineChart key={i} id={part.id} charts={charts} inline />
        ) : part.type === "scenario" ? (
          base && <ScenarioCard key={i} base={base} changes={part.changes} />
        ) : (
          <MessageResponse
            key={i}
            isAnimating={streaming}
            remarkPlugins={[sourceTags, chatHeadingParagraphs, glossaryLinks]}
            components={{
              a: ({ href, children }) => {
                if (href?.startsWith("#vicky-source="))
                  return <SourceChip tag={decodeURIComponent(href.slice(14))} />;
                if (href?.startsWith("#term=")) {
                  const id = href.slice(6),
                    term = terms.find((t) => t.id === id);
                  return (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <Link
                          to="/learn"
                          search={choice}
                          hash={id}
                          className="underline decoration-dotted underline-offset-4"
                        >
                          {children}
                        </Link>
                      </HoverCardTrigger>
                      <HoverCardContent className="text-xs">
                        {term?.plain}
                        <Link
                          to="/learn"
                          search={choice}
                          hash={id}
                          className="mt-3 block text-primary"
                        >
                          Learn more
                        </Link>
                      </HoverCardContent>
                    </HoverCard>
                  );
                }
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-primary"
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {part.text.replace(/\[\[[\s\S]*?(?:\]\]|$)/g, "")}
          </MessageResponse>
        ),
      )}
      {!streaming && (cited.sources.length > 0 || cited.links.length > 0) && (
        <ReplySources sources={cited.sources} links={cited.links} />
      )}
    </>
  );
}

const FRIENDLY: Record<string, string> = {
  "P&L": "Your P&L",
  You: "Numbers you entered",
  Deck: "Your deck",
  Plan: "Your forecast",
  Vicky: "Vicky's calculation",
};

function ReplySources({
  sources,
  links,
}: {
  sources: string[];
  links: { label: string; url: string }[];
}) {
  return (
    <footer className="mt-4 border-t border-border pt-3">
      <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Sources</h4>
      <ul className="flex flex-wrap gap-2 text-xs">
        {sources.map((tag) => (
          <li key={tag}>
            <HoverCard openDelay={150}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  className="min-h-7 rounded-full border border-border bg-secondary px-3 py-1 text-secondary-foreground"
                >
                  {FRIENDLY[tag] ?? tag.replace(/^Pack ([A-Z])\d*$/, "Data pack, Appendix $1")}
                </button>
              </HoverCardTrigger>
              <HoverCardContent className="text-xs">{sourceDescription(tag)}</HoverCardContent>
            </HoverCard>
          </li>
        ))}
        {links.map((l) => (
          <li key={l.url}>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-7 items-center gap-1 rounded-full border border-border px-3 py-1 text-primary hover:bg-secondary"
            >
              {l.label}
              <ExternalLink aria-hidden className="size-3" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
