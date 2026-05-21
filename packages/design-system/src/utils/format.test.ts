import { describe, expect, it } from 'vitest';
import { formatDurationMs } from './format';

describe('formatDurationMs', () => {
  it('returns "—" for null', () => {
    expect(formatDurationMs(null)).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(formatDurationMs(undefined)).toBe('—');
  });

  it('formats 0 ms as "0ms"', () => {
    expect(formatDurationMs(0)).toBe('0ms');
  });

  it('formats sub-second durations as integer milliseconds', () => {
    expect(formatDurationMs(1)).toBe('1ms');
    expect(formatDurationMs(42)).toBe('42ms');
    expect(formatDurationMs(999)).toBe('999ms');
  });

  it('rounds fractional milliseconds in the sub-second bucket', () => {
    expect(formatDurationMs(42.4)).toBe('42ms');
    expect(formatDurationMs(42.6)).toBe('43ms');
  });

  it('formats sub-minute durations as one-decimal seconds', () => {
    expect(formatDurationMs(1000)).toBe('1.0s');
    expect(formatDurationMs(1234)).toBe('1.2s');
    expect(formatDurationMs(59_999)).toBe('60.0s');
  });

  it('formats minute-and-above durations as "Nm Ms"', () => {
    expect(formatDurationMs(60_000)).toBe('1m 0s');
    expect(formatDurationMs(65_000)).toBe('1m 5s');
    expect(formatDurationMs(125_500)).toBe('2m 6s');
  });

  it('handles large durations cleanly (10 minutes plus)', () => {
    expect(formatDurationMs(600_000)).toBe('10m 0s');
    expect(formatDurationMs(3_661_000)).toBe('61m 1s');
  });
});
