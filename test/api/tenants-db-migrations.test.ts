import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeMock = vi.fn();
const batchMock = vi.fn();

vi.mock('@libsql/client/web', () => ({
  createClient: vi.fn(() => ({
    execute: executeMock,
    batch: batchMock,
  })),
}));

describe('tenant DB migrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.TURSO_DATABASE_URL = 'libsql://test-db.turso.io';
    process.env.TURSO_AUTH_TOKEN = 'test-token';
    batchMock.mockResolvedValue({ rows: [] });
    executeMock.mockImplementation(async (statement: string | { sql: string }) => {
      const sql = typeof statement === 'string' ? statement : statement.sql;
      if (/^PRAGMA table_info/i.test(sql)) {
        return { rows: [] };
      }
      if (/ALTER TABLE coach_class_locations ADD COLUMN is_default/i.test(sql)) {
        throw new Error('SQLite error: duplicate column name: is_default');
      }
      return { rows: [] };
    });
  });

  it('treats duplicate-column errors as a successful concurrent migration', async () => {
    const { createTenantTablesIfNeeded } = await import('../../api/_tenantsDb');

    await expect(createTenantTablesIfNeeded()).resolves.toBeUndefined();

    expect(executeMock).toHaveBeenCalledWith(expect.stringMatching(/ALTER TABLE coach_class_locations ADD COLUMN is_default/));
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringMatching(/UPDATE coach_hiit_classes/i),
    }));
    expect(batchMock).toHaveBeenCalledTimes(2);
  });
});
