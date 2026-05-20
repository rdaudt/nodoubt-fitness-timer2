import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeMock = vi.fn();

vi.mock('../../api/_tenantsDb', () => ({
  getTenantsDb: vi.fn(() => ({
    execute: executeMock,
  })),
}));

type MockResponse = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
};

const createMockRes = (): {
  res: {
    status: (code: number) => { json: (body: unknown) => void };
    setHeader: (name: string, value: string) => void;
  };
  store: MockResponse;
} => {
  const store: MockResponse = { statusCode: 200, body: null, headers: {} };
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
      setHeader(name: string, value: string) {
        store.headers[name] = value;
      },
    },
    store,
  };
};

describe('tenant-public API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tenant profile in slug mode', async () => {
    executeMock
      .mockResolvedValueOnce({
        rows: [{
          id: 'tenant-1',
          slug: 'fit-coach',
          business_name: 'Fit Business',
          coach_name: 'Coach A',
          header_tagline: 'Tag',
          ig_username: 'coacha',
          bio: 'Bio',
          logo_url: '',
          coach_photo_url: '',
          qr_code_url: '',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ label: 'Instagram', url: 'https://instagram.com/coacha', sort_order: 1 }],
      });
    const { default: handler } = await import('../../api/tenant-public');
    const { res, store } = createMockRes();

    await handler({ method: 'GET', query: { slug: 'fit-coach' } }, res);

    expect(store.statusCode).toBe(200);
    expect(store.body).toMatchObject({
      slug: 'fit-coach',
      coachName: 'Coach A',
      businessName: 'Fit Business',
      socialLinks: [{ label: 'Instagram' }],
    });
  });

  it('returns coach directory in directory mode with minimal fields', async () => {
    executeMock
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            slug: 'fit-coach',
            coach_name: 'Coach A',
            business_name: 'Fit A',
            coach_photo_url: '',
            ig_username: 'coacha',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      });
    const { default: handler } = await import('../../api/tenant-public');
    const { res, store } = createMockRes();

    await handler({ method: 'GET', query: { view: 'directory', query: 'fit', page: '1', pageSize: '1' } }, res);

    expect(store.statusCode).toBe(200);
    expect(store.body).toEqual({
      items: [{
        slug: 'fit-coach',
        coachName: 'Coach A',
        businessName: 'Fit A',
        coachPhotoUrl: '',
        igUsername: 'coacha',
      }],
      page: 1,
      pageSize: 1,
      total: 2,
      hasNextPage: true,
    });
  });
});
