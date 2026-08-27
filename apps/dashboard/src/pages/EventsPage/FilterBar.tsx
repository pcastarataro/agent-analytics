import type { EventFilters } from '../../api/types';

interface FilterBarProps {
  filters: EventFilters;
  onFilterChange: (filters: EventFilters) => void;
}

const STATUS_OPTIONS = ['success', 'error', 'cancelled'] as const;

export function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="agent-filter" className="text-xs font-medium text-gray-500">
          Agent Name
        </label>
        <input
          id="agent-filter"
          type="text"
          placeholder="All agents"
          value={filters.agentName ?? ''}
          onChange={(e) =>
            onFilterChange({ ...filters, agentName: e.target.value || undefined })
          }
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="status-filter" className="text-xs font-medium text-gray-500">
          Status
        </label>
        <select
          id="status-filter"
          value={filters.status ?? ''}
          onChange={(e) =>
            onFilterChange({ ...filters, status: e.target.value || undefined })
          }
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="from-filter" className="text-xs font-medium text-gray-500">
          From
        </label>
        <input
          id="from-filter"
          type="date"
          value={filters.from ?? ''}
          onChange={(e) =>
            onFilterChange({ ...filters, from: e.target.value || undefined })
          }
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="to-filter" className="text-xs font-medium text-gray-500">
          To
        </label>
        <input
          id="to-filter"
          type="date"
          value={filters.to ?? ''}
          onChange={(e) =>
            onFilterChange({ ...filters, to: e.target.value || undefined })
          }
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {(filters.agentName || filters.status || filters.from || filters.to) && (
        <button
          onClick={() => onFilterChange({ limit: filters.limit })}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Clear
        </button>
      )}
    </div>
  );
}
