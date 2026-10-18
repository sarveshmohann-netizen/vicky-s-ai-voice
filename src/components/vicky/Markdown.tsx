import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink } from 'lucide-react';
import { SourceChip } from './Sources';
import { splitSourceText } from '@/lib/vicky-sources';

type Node = { type: string; value?: string; children?: Node[]; url?: string };
function sourceTags() {
  return (tree: Node) => {
    const visit = (node: Node) => {
      if (!node.children || ['link', 'code', 'inlineCode'].includes(node.type)) return;
      node.children = node.children.flatMap(child => {
        if (child.type === 'text' && child.value) return splitSourceText(child.value).map(part => part.tag
          ? { type: 'link', url: '#vicky-source=' + encodeURIComponent(part.tag), children: [{ type: 'text', value: part.tag }] }
          : { type: 'text', value: part.text });
        visit(child); return [child];
      });
    };
    visit(tree);
  };
}

export function Markdown({ children }: { children: string }) {
  return <div className="space-y-3 text-[15px] leading-relaxed [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc [&_strong]:font-semibold [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_a]:text-accent [&_a]:underline">
    <ReactMarkdown remarkPlugins={[remarkGfm, sourceTags]} components={{ a: ({ href, children }) => href?.startsWith('#vicky-source=')
      ? <SourceChip tag={decodeURIComponent(href.slice(14))} />
      : <a href={href} target="_blank" rel="noopener noreferrer" className="mx-0.5 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium !no-underline">{children}<ExternalLink className="size-3" /></a> }}>{children}</ReactMarkdown>
  </div>;
}
