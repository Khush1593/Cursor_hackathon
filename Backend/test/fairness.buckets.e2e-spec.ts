import { ageBand, sexGroup } from '../src/fairness/fairness.buckets';

describe('fairness buckets (mirror Python)', () => {
  it('age bands match Python/fairness.py', () => {
    expect(ageBand(10)).toBe('0-17');
    expect(ageBand(25)).toBe('18-29');
    expect(ageBand(35)).toBe('30-39');
    expect(ageBand(45)).toBe('40-49');
    expect(ageBand(58)).toBe('50-59');
    expect(ageBand(65)).toBe('60-69');
    expect(ageBand(80)).toBe('70+');
    expect(ageBand(-1)).toBe('unknown');
  });

  it('sex groups match Python/fairness.py', () => {
    expect(sexGroup('female')).toBe('female');
    expect(sexGroup('Male')).toBe('male');
    expect(sexGroup('')).toBe('unknown');
    expect(sexGroup('nonbinary')).toBe('other');
  });
});
