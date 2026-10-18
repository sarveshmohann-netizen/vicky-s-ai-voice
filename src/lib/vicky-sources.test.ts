import { describe, expect, it } from 'vitest';
import { sourceDescription, splitSourceText } from './vicky-sources';
import { SOURCE_KEY } from './vicky/tidewell/refs';
import { meetingSearchSchema } from './vicky-inputs';

describe('meeting preferences and sources', () => {
  it('defaults investor and stage to lead-seed and seed', () => {
    expect(meetingSearchSchema.parse({})).toEqual({ persona: 'lead-seed', stage: 'seed' });
    expect(meetingSearchSchema.parse({ persona: 'yc', stage: 'series-a' })).toEqual({ persona: 'yc', stage: 'series-a' });
  });
  it('resolves Pack D3 to the Pack D source', () => {
    expect(sourceDescription('Pack D3')).toBe(SOURCE_KEY['Pack D']);
    expect(sourceDescription('P&L')).toBe(SOURCE_KEY['P&L']);
  });
  it('recognizes source tags without treating unknown brackets as sources', () => {
    expect(splitSourceText('Revenue [P&L] and [Pack D3], not [unknown]').filter(p => p.tag).map(p => p.tag)).toEqual(['P&L', 'Pack D3']);
  });
});