import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventTable } from '../../src/pages/EventsPage/EventTable';
import type { UsageEventDTO } from '../../src/api/types';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeEvent(overrides: Partial<UsageEventDTO> = {}): UsageEventDTO {
  return {
    id: '0192e000-1000-7000-8000-000000000001',
    actor: { userId: 'user-1' },
    project: {},
    session: {},
    execution: { traceId: 'trace-abc' },
    agent: { name: 'test-agent' },
    skill: { name: 'test-skill' },
    tool: {},
    model: {},
    metrics: { inputTokens: 120, outputTokens: 340 },
    result: { status: 'success' },
    timestamp: '2026-08-26T10:30:00Z',
    ...overrides,
  };
}

describe('EventTable', () => {
  it('renders column headers when events exist', () => {
    render(<EventTable events={[makeEvent()]} />);

    expect(screen.getByText('Timestamp')).toBeDefined();
    expect(screen.getByText('Agent')).toBeDefined();
    expect(screen.getByText('Agent Version')).toBeDefined();
    expect(screen.getByText('Tool')).toBeDefined();
    expect(screen.getByText('Skill')).toBeDefined();
    expect(screen.getByText('Skill Version')).toBeDefined();
    expect(screen.getByText('Model')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Session')).toBeDefined();
    expect(screen.getByText('Prompt')).toBeDefined();
    expect(screen.getByText('Response')).toBeDefined();
  });

  it('shows empty state when no events', () => {
    render(<EventTable events={[]} />);

    expect(screen.getByText('No events found.')).toBeDefined();
  });

  it('renders event rows with correct data', () => {
    const events = [
      makeEvent({
        agent: { name: 'alpha', version: '1.2.3' },
        skill: { name: 'test-skill', version: '2.0.0' },
        model: { name: 'gpt-4' },
        result: { status: 'success' },
        execution: { traceId: 'sess-1' },
        metrics: { inputTokens: 100, outputTokens: 200 },
      }),
    ];

    render(<EventTable events={events} />);

    expect(screen.getByText('alpha')).toBeDefined();
    expect(screen.getByText('1.2.3')).toBeDefined();
    expect(screen.getByText('2.0.0')).toBeDefined();
    expect(screen.getByText('gpt-4')).toBeDefined();
    expect(screen.getByText('success')).toBeDefined();
    expect(screen.getByText('sess-1')).toBeDefined();
    expect(screen.getByText('100')).toBeDefined();
    expect(screen.getByText('200')).toBeDefined();
  });

  it('renders dash for missing agent version, skill version, and model', () => {
    const events = [
      makeEvent({
        agent: { name: 'alpha' },
        skill: { name: 'test-skill' },
        model: {},
        metrics: {},
      }),
    ];

    render(<EventTable events={events} />);

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('renders dash for missing token counts', () => {
    const events = [makeEvent({ metrics: {} })];

    render(<EventTable events={events} />);

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('renders dash for missing timestamp', () => {
    const events = [makeEvent({ timestamp: undefined, metrics: {} })];

    render(<EventTable events={events} />);

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders multiple events', () => {
    const events = [
      makeEvent({ id: 'evt-1', agent: { name: 'alpha' } }),
      makeEvent({ id: 'evt-2', agent: { name: 'beta' } }),
    ];

    render(<EventTable events={events} />);

    expect(screen.getByText('alpha')).toBeDefined();
    expect(screen.getByText('beta')).toBeDefined();
  });
});
