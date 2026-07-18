import { inferMetricsFromTranscript } from '../src/common/utils/metrics';

describe('inferMetricsFromTranscript (7-day chart fill)', () => {
  it('extracts numeric pain and sleep', () => {
    expect(
      inferMetricsFromTranscript('pain is a 7 and I slept 5 hours'),
    ).toEqual({
      pain_level: 7,
      sleep_hours: 5,
    });
  });

  it('infers poor sleep without a number', () => {
    expect(inferMetricsFromTranscript('I slept poorly last night')).toEqual({
      sleep_hours: 4,
    });
  });

  it('infers severe pain without a number', () => {
    expect(
      inferMetricsFromTranscript(
        'please help me and having very severe chest pain',
      ),
    ).toMatchObject({ pain_level: 8 });
  });

  it('returns empty for non-vital chatter', () => {
    expect(inferMetricsFromTranscript('just heading to the gym')).toEqual({});
  });
});
