import { describe, expect, it } from 'vitest';
import { parseTopics } from './lessons';

describe('lesson topic scope', () => {
  it('stores the all scope as a single value', () => {
    expect(parseTopics('all, revenue')).toEqual(['all']);
  });
  it('stores multiple topics as an array', () => {
    expect(parseTopics('runway, churn')).toEqual(['runway', 'churn']);
  });
});