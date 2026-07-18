/**
 * Nest ↔ Python contract e2e (CI).
 *
 * Calls real PYTHON_SERVICE_URL over HTTP (not Python TestClient).
 * Requires Python running with USE_AI_STUB=1 for deterministic stroke escalation.
 *
 *   PYTHON_SERVICE_URL=http://127.0.0.1:8000 npm run test:e2e
 */
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { AiClient } from '../src/integrations/ai/ai.client';
import { FallbackService } from '../src/triage/fallback.service';
import { AuraResponseSchema } from '../src/validation/aura.schema';
import type { TriageRequestPayload } from '../src/triage/triage.types';

const PYTHON_URL = (
  process.env.PYTHON_SERVICE_URL ?? 'http://127.0.0.1:8000'
).replace(/\/$/, '');

const STROKE_PAYLOAD: TriageRequestPayload = {
  transcript: 'my face is drooping and speech slurred',
  baseline: {
    age: 58,
    sex: 'male',
    chronicConditions: ['hypertension'],
    currentMeds: ['lisinopril'],
  },
  recentLogs: [],
  recurringConditions: [],
  pendingTriage: null,
};

const ALLOWED_ACTIONS = new Set([
  'ask_follow_up',
  'resolve',
  'emergency_escalation',
  'general_response',
]);
const ALLOWED_MODES = new Set(['preventive', 'urgent_care', 'emergency']);
const ALLOWED_METRICS = new Set(['pain_level', 'sleep_hours']);

function assertNestZodShape(data: unknown) {
  const parsed = AuraResponseSchema.parse(data);
  expect(ALLOWED_ACTIONS.has(parsed.action_type)).toBe(true);
  expect(ALLOWED_MODES.has(parsed.detected_mode)).toBe(true);
  expect(parsed.action_type).not.toBe('clinical_alert' as never);
  expect(Array.isArray(parsed.reasoning_trace)).toBe(true);
  expect(parsed.reasoning_trace.length).toBeGreaterThanOrEqual(1);
  expect(parsed.reasoning_trace.length).toBeLessThanOrEqual(3);
  const bad = Object.keys(parsed.extracted_dashboard_metrics).filter(
    (k) => !ALLOWED_METRICS.has(k),
  );
  expect(bad).toEqual([]);
  return parsed;
}

async function pythonReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${PYTHON_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

describe('Nest ↔ Python real HTTP (PYTHON_SERVICE_URL)', () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await pythonReachable();
    if (!reachable) {
      console.warn(
        `Skipping live Python tests — ${PYTHON_URL}/health not reachable. ` +
          'Start Python with USE_AI_STUB=1 for CI.',
      );
    }
  });

  it('GET /health for Nest/Docker', async () => {
    if (!reachable) return;
    const res = await fetch(`${PYTHON_URL}/health`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ok' });
  });

  it('stroke → Zod parse + emergency_escalation (real /triage)', async () => {
    if (!reachable) return;

    const res = await fetch(`${PYTHON_URL}/triage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(STROKE_PAYLOAD),
      signal: AbortSignal.timeout(15_000),
    });

    expect(res.status).toBe(200);
    const body = assertNestZodShape(await res.json());
    expect(body.action_type).toBe('emergency_escalation');
    expect(body.detected_mode).toBe('emergency');
    expect(body.pending_triage_update).toBeNull();
    expect(body.reasoning_trace.length).toBeGreaterThanOrEqual(1);
    expect(
      body.reasoning_trace.some((line) =>
        /stroke|emergency|bypass/i.test(line),
      ),
    ).toBe(true);
  });

  it('AiClient.triage hits PYTHON_SERVICE_URL and passes Zod + reasoning_trace', async () => {
    if (!reachable) return;

    const config = {
      get: (key: string) => {
        if (key === 'useAiStub') return false;
        if (key === 'pythonServiceUrl') return PYTHON_URL;
        if (key === 'pythonServiceTimeoutMs') return 15_000;
        return undefined;
      },
    } as unknown as ConfigService;

    const client = new AiClient(config);
    const ai = await client.triage(STROKE_PAYLOAD);
    const parsed = assertNestZodShape(ai);
    expect(parsed.action_type).toBe('emergency_escalation');
    expect(parsed.reasoning_trace.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /fairness/stats is non-PHI buckets only', async () => {
    if (!reachable) return;
    const res = await fetch(`${PYTHON_URL}/fairness/stats`);
    expect(res.status).toBe(200);
    const snap = (await res.json()) as {
      total_triage_events: number;
      by_bucket: Array<Record<string, unknown>>;
    };
    expect(typeof snap.total_triage_events).toBe('number');
    expect(Array.isArray(snap.by_bucket)).toBe(true);
    for (const row of snap.by_bucket) {
      expect(Object.keys(row).sort()).toEqual(
        [
          'action_type',
          'age_band',
          'count',
          'detected_mode',
          'sex_group',
        ].sort(),
      );
    }
  });
});

describe('Nest 502 → offline fallback', () => {
  let server: http.Server;
  let badUrl: string;

  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: 'Triage LLM failure: simulated' }));
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address() as AddressInfo;
    badUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('AiClient throws on 502 from Python-shaped error', async () => {
    const config = {
      get: (key: string) => {
        if (key === 'useAiStub') return false;
        if (key === 'pythonServiceUrl') return badUrl;
        if (key === 'pythonServiceTimeoutMs') return 5_000;
        return undefined;
      },
    } as unknown as ConfigService;

    const client = new AiClient(config);
    await expect(client.triage(STROKE_PAYLOAD)).rejects.toThrow(
      /AI service returned 502/,
    );
  });

  it('FallbackService returns emergency fallback for stroke transcript (Nest owns fallback)', () => {
    const fallback = new FallbackService();
    const result = fallback.resolve(STROKE_PAYLOAD.transcript);

    expect(result.action_type).toBe('emergency_escalation');
    expect(result.detected_mode).toBe('emergency');
    expect(result.is_emergency_state).toBe(true);
    expect(Array.isArray(result.reasoning_trace)).toBe(true);
    expect(result.reasoning_trace.length).toBeGreaterThanOrEqual(1);
    // Same shape TriageMapper passes through on POST /api/triage/turn
    expect(result).toHaveProperty('reasoning_trace');
  });
});
