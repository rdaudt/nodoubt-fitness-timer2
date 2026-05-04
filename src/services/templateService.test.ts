import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Template } from '../types';
import { createTimerFromTemplate, saveTemplate } from './templateService';

const { upsertMock, clearBuiltinDeletedMarkMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  clearBuiltinDeletedMarkMock: vi.fn(),
}));

vi.mock('./storage', () => ({
  TemplateRepository: {
    upsert: upsertMock,
    clearBuiltinDeletedMark: clearBuiltinDeletedMarkMock,
  },
}));

const template: Template = {
  id: 'builtin:general-001',
  name: 'General A',
  stationCount: 2,
  stationWorkoutTypes: ['Pushups', 'Squats'],
  roundsPerStation: 3,
  workMinutes: 0,
  workSeconds: 30,
  restMinutes: 0,
  restSeconds: 15,
  stationTransitionMinutes: 0,
  stationTransitionSeconds: 20,
  startStationWorkManually: false,
  warmupEnabled: true,
  warmupMinutes: 5,
  warmupSeconds: 0,
  cooldownEnabled: true,
  cooldownMinutes: 5,
  cooldownSeconds: 0,
  category: 'GENERAL',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  source: 'builtin',
};

describe('templateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new timer from template with a new id and preserved workout shape', async () => {
    const timer = await createTimerFromTemplate({ ...template, category: 'FAT-LOSS' });
    expect(timer.id).not.toBe(template.id);
    expect(timer.name).toBe(template.name);
    expect(timer.stationCount).toBe(2);
    expect(timer.category).toBe('GENERAL');
  });

  it('saving a builtin template creates a user-owned override', async () => {
    const saved = await saveTemplate({ ...template, category: 'PERFORMANCE' });
    expect(saved.source).toBe('user');
    expect(saved.builtinTemplateId).toBe('builtin:general-001');
    expect(saved.category).toBe('GENERAL');
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(clearBuiltinDeletedMarkMock).toHaveBeenCalledWith('builtin:general-001');
  });
});
