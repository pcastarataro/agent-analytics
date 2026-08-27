import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GanttChart } from './GanttChart';
import type { SessionEvent } from '../../api/types';

function makeEvent(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    id: 'evt-1',
    actor: { userId: 'user-1' },
    project: {},
    session: {},
    execution: { traceId: 'trace-1' },
    agent: { name: 'test-agent' },
    skill: { name: 'test-skill' },
    tool: {},
    model: {},
    metrics: { durationMs: 500 },
    result: { status: 'success' },
    timestamp: '2025-01-01T12:00:00Z',
    eventType: 'tool_call',
    ...overrides,
  };
}

describe('GanttChart', () => {
  it('renders empty state when no events', () => {
    render(<GanttChart events={[]} />);
    expect(screen.getByText('No events to display')).toBeDefined();
  });

  it('renders bars for events with duration', () => {
    const events = [
      makeEvent({ id: 'evt-1', eventType: 'tool_call', metrics: { durationMs: 1000 } }),
      makeEvent({ id: 'evt-2', eventType: 'assistant_message', metrics: { durationMs: 500 } }),
    ];
    const { container } = render(<GanttChart events={events} />);
    const rects = container.querySelectorAll('rect');
    // At least 2 bar rects (one per event) + row backgrounds
    expect(rects.length).toBeGreaterThanOrEqual(2);
  });

  it('renders dots for zero-duration events', () => {
    const events = [
      makeEvent({ id: 'evt-1', eventType: 'user_message', metrics: {} }),
    ];
    const { container } = render(<GanttChart events={events} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(1);
  });

  it('applies correct color for event types', () => {
    const events = [
      makeEvent({ id: 'evt-1', eventType: 'tool_call', metrics: { durationMs: 100 } }),
    ];
    const { container } = render(<GanttChart events={events} />);
    const bar = container.querySelector('rect[fill="#F59E0B"]');
    expect(bar).toBeTruthy();
  });

  it('shows tooltip on hover', () => {
    const events = [
      makeEvent({
        id: 'evt-1',
        eventType: 'tool_call',
        metrics: { durationMs: 200 },
        tool: { name: 'my-tool' },
      }),
    ];
    const { container } = render(<GanttChart events={events} />);
    const eventGroup = container.querySelector('g.cursor-pointer');
    expect(eventGroup).toBeTruthy();
    fireEvent.mouseEnter(eventGroup!);
    // Tooltip renders with specific tooltip class
    const tooltip = container.querySelector('.pointer-events-none.absolute');
    expect(tooltip).toBeTruthy();
    expect(screen.getByText(/Tool: my-tool/)).toBeDefined();
    expect(screen.getByText(/Duration: 200ms/)).toBeDefined();
  });

  it('renders time axis labels', () => {
    const events = [
      makeEvent({ id: 'evt-1', timestamp: '2025-01-01T12:00:00Z', metrics: { durationMs: 100 } }),
      makeEvent({ id: 'evt-2', timestamp: '2025-01-01T12:00:05Z', metrics: { durationMs: 100 } }),
    ];
    const { container } = render(<GanttChart events={events} />);
    const texts = container.querySelectorAll('text');
    expect(texts.length).toBeGreaterThan(0);
  });

  it('renders color legend with all event types', () => {
    const events = [
      makeEvent({ id: 'evt-1', eventType: 'tool_call', metrics: { durationMs: 100 } }),
    ];
    const { container } = render(<GanttChart events={events} />);
    const legend = container.querySelector('.flex.flex-wrap');
    expect(legend).toBeTruthy();
    const legendLabels = legend!.querySelectorAll('span.text-xs');
    const labelTexts = Array.from(legendLabels).map((el) => el.textContent);
    expect(labelTexts).toContain('session_created');
    expect(labelTexts).toContain('user_message');
    expect(labelTexts).toContain('assistant_message');
    expect(labelTexts).toContain('tool_call');
    expect(labelTexts).toContain('skill_call');
    expect(labelTexts).toContain('unknown');
    expect(labelTexts).toHaveLength(6);
  });
});
