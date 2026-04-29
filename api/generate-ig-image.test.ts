import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

type MockResponse = {
  statusCode: number;
  body: unknown;
};

const createMockRes = (): { res: { status: (code: number) => { json: (body: unknown) => void } }; store: MockResponse } => {
  const store: MockResponse = { statusCode: 200, body: null };
  return {
    res: {
      status(code: number) {
        store.statusCode = code;
        return {
          json(body: unknown) {
            store.body = body;
          },
        };
      },
    },
    store,
  };
};

describe('generate-ig-image API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as unknown as typeof fetch);
  });

  it('rejects invalid payload with 400', async () => {
    const { default: handler } = await import('./generate-ig-image');
    const { res, store } = createMockRes();

    await handler({ method: 'POST', body: { bad: true } }, res);

    expect(store.statusCode).toBe(400);
    expect(store.body).toEqual(expect.objectContaining({ error: expect.stringContaining('Invalid request payload') }));
  });

  it('calls OpenAI with configured model and returns base64 PNG payload', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: 'Zm9v' }],
    }), { status: 200 }));

    const { default: handler } = await import('./generate-ig-image');
    const { res, store } = createMockRes();

    await handler({
      method: 'POST',
      body: {
        run: {
          id: 'run-1',
          timerNameAtRun: 'Demo Timer',
          ranAt: '2026-02-01T10:00:00.000Z',
          location: 'Gym',
          stationSetWorkoutTypes: [{ stationSetNumber: 1, workoutType: 'Burpees' }],
          timerSnapshot: {
            stationCount: 1,
            roundsPerStation: 1,
            workSeconds: 30,
            restSeconds: 0,
            stationTransitionSeconds: 30,
          },
        },
      },
    }, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/images/edits');
    const fetchOptions = fetchMock.mock.calls[0][1] as RequestInit;
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer test-key' }));
    const formData = fetchOptions.body as FormData;
    expect(formData.get('model')).toBe('gpt-image-2');
    expect(formData.get('size')).toBe('1088x1360');
    expect(formData.get('output_format')).toBe('png');

    expect(store.statusCode).toBe(200);
    expect(store.body).toEqual(expect.objectContaining({
      imageBase64: 'Zm9v',
      mimeType: 'image/png',
      size: '1088x1360',
      model: 'gpt-image-2',
    }));
  });
});
