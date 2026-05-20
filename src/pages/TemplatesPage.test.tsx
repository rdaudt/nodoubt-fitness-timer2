import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplatesPage } from './TemplatesPage';
import type { Template, Timer } from '../types';

const { listTemplatesMock, createTimerFromTemplateMock } = vi.hoisted(() => ({
  listTemplatesMock: vi.fn(),
  createTimerFromTemplateMock: vi.fn(),
}));
const { upsertTimerMock } = vi.hoisted(() => ({
  upsertTimerMock: vi.fn(),
}));

vi.mock('../services/authContext', () => ({
  useCoachMode: () => true,
}));

vi.mock('../services/templateService', () => ({
  listTemplates: listTemplatesMock,
  createTimerFromTemplate: createTimerFromTemplateMock,
  deleteTemplate: vi.fn(),
}));

vi.mock('../services/storage', () => ({
  TimerRepository: {
    upsert: upsertTimerMock,
  },
}));

const template: Template = {
  id: 'builtin:general-001',
  name: 'General A',
  stationCount: 2,
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

const createdTimer: Timer = {
  ...template,
  id: 'timer-1',
};

describe('TemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listTemplatesMock.mockResolvedValue([template]);
    createTimerFromTemplateMock.mockResolvedValue(createdTimer);
    upsertTimerMock.mockResolvedValue(undefined);
  });

  it('renders templates and creates a timer when using a template', async () => {
    render(
      <MemoryRouter initialEntries={['/templates']}>
        <Routes>
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/timer/:id" element={<p>Timer detail</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('General A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use' }));
    await waitFor(() => expect(upsertTimerMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'timer-1' })));
    expect(await screen.findByText('Timer detail')).toBeInTheDocument();
  });
});
