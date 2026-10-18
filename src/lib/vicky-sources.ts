import { SOURCE_KEY } from './vicky/tidewell/refs';

export function sourceDescription(tag: string) {
  return SOURCE_KEY[tag] ?? SOURCE_KEY[tag.replace(/(Pack [A-Z])\d+$/, '$1')];
}

export function splitSourceText(text: string) {
  return text.split(/(\[[^\]\n]+\])/g).filter(Boolean).map(text => {
    const tag = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : undefined;
    return { text, tag: tag && sourceDescription(tag) ? tag : undefined };
  });
}