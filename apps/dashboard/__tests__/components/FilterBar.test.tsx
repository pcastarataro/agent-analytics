import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { FilterBar } from '../../src/pages/EventsPage/FilterBar';
import type { EventFilters } from '../../src/api/types';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('FilterBar', () => {
  it('renders all filter controls', () => {
    render(<FilterBar filters={{} as EventFilters} onFilterChange={vi.fn()} />);

    expect(screen.getByLabelText('Agent Name')).toBeDefined();
    expect(screen.getByLabelText('Status')).toBeDefined();
    expect(screen.getByLabelText('From')).toBeDefined();
    expect(screen.getByLabelText('To')).toBeDefined();
  });

  it('calls onFilterChange with agent name when input changes', () => {
    const onFilterChange = vi.fn();
    render(<FilterBar filters={{} as EventFilters} onFilterChange={onFilterChange} />);

    const input = screen.getByLabelText('Agent Name');
    fireEvent.change(input, { target: { value: 'test-agent' } });

    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith({ agentName: 'test-agent' });
  });

  it('calls onFilterChange with status when select changes', () => {
    const onFilterChange = vi.fn();
    render(<FilterBar filters={{} as EventFilters} onFilterChange={onFilterChange} />);

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'error' },
    });

    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith({ status: 'error' });
  });

  it('shows Clear button when filters are active', () => {
    render(
      <FilterBar
        filters={{ agentName: 'alpha' } as EventFilters}
        onFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Clear' })).toBeDefined();
  });

  it('hides Clear button when no filters are active', () => {
    render(<FilterBar filters={{} as EventFilters} onFilterChange={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('clears all filters when Clear is clicked', () => {
    const onFilterChange = vi.fn();
    render(
      <FilterBar
        filters={{ agentName: 'alpha', status: 'success' } as EventFilters}
        onFilterChange={onFilterChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith({});
  });
});
