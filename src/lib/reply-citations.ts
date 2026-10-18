// Pulls citations out of a Vicky reply so the answer reads cleanly, and lists
// them once under the reply instead. Short source tags like [P&L] and
// benchmark links like [SaaStr, Oct 2026](url) are collected; [[chart:...]]
// and [[scenario ...]] tags are left for parseReply.

import { sourceDescription } from "./vicky-sources";

export interface ReplyCitations {
  body: string;
  sources: string[]; // short tags, in order of first use
  links: { label: string; url: string }[];
}

const CITATION_LABEL = /^[^\]]+,\s*[A-Z][a-z]{2,8}\.? \d{4}$/; // "SaaStr, Oct 2026"

export function extractCitations(text: string): ReplyCitations {
  const sources: string[] = [];
  const links: ReplyCitations["links"] = [];
  const addLink = (label: string, url: string) => {
    if (!links.some((l) => l.url === url)) links.push({ label, url });
  };

  let body = text.replace(
    /(?<!\[)\[([^[\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_m, label: string, url: string) => {
      addLink(label, url);
      // A bare citation disappears; a link written into the sentence keeps its words.
      return CITATION_LABEL.test(label.trim()) ? "" : label;
    },
  );

  body = body.replace(/\s?(?<!\[)\[([^[\]\n]+)\](?![([\]])/g, (m, tag: string) => {
    const tags = tag.split(/\s*[;,]\s*/);
    if (!tags.every((t) => sourceDescription(t))) return m;
    for (const t of tags) if (!sources.includes(t)) sources.push(t);
    return "";
  });

  body = body
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]+([.,;:!?)])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
  return { body, sources, links };
}
