import { expect, it } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

it('database accepts all four numeric grade criteria from 0 through 4', async () => {
  const { data, error } = await supabase.rpc('valid_practice_grade', {
    value: { evidence: 0, clarity: 4, accuracy: 2.5, ownership: 3 },
  });
  expect(error).toBeNull();
  expect(data).toBe(true);
});

it.each([-1, 5, '2', null])('database rejects a grade outside numeric 0–4: %s', async (evidence) => {
  const { data, error } = await supabase.rpc('valid_practice_grade', {
    value: { evidence, clarity: 4, accuracy: 2, ownership: 3 },
  });
  expect(error).toBeNull();
  expect(data).toBe(false);
});

it('database requires evidence, clarity, accuracy and ownership', async () => {
  const { data, error } = await supabase.rpc('valid_practice_grade', { value: { evidence: 2 } });
  expect(error).toBeNull();
  expect(data).toBe(false);
});