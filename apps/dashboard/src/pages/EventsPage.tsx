import { useState, useCallback, useEffect } from 'react';

import type { PaginatedEvents, EventFilters } from '../api/types';
import { fetchApi } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { FilterBar } from './EventsPage/FilterBar';
import { EventTable } from './EventsPage/EventTable';

const PAGE_LIMIT = 50;

function buildQueryString(filters: EventFilters, cursor?: string): string {
  const params = new URLSearchParams();
  params.set('limit', String(filters.limit ?? PAGE_LIMIT));
  if (filters.agentName) params.set('agentName', filters.agentName);
  if (filters.status) params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

export function EventsPage() {
  const [filters, setFilters] = useState<EventFilters>({});
  const [events, setEvents] = useState<PaginatedEvents['data']>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = useCallback(async (cursor?: string, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const qs = buildQueryString(filters, cursor);
      const result = await fetchApi<PaginatedEvents>(`/v1/events?${qs}`);

      if (append) {
        setEvents((prev: PaginatedEvents['data']) => [...prev, ...result.data]);
      } else {
        setEvents(result.data);
      }
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const handleFilterChange = useCallback((newFilters: EventFilters) => {
    setFilters(newFilters);
    setEvents([]);
    setNextCursor(null);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (nextCursor) {
      void fetchEvents(nextCursor, true);
    }
  }, [fetchEvents, nextCursor]);

  if (loading && events.length === 0) return <LoadingSpinner />;
  if (error && events.length === 0) {
    return <ErrorMessage message={error.message} onRetry={() => void fetchEvents()} />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Events</h2>
      <FilterBar filters={filters} onFilterChange={handleFilterChange} />
      <EventTable events={events} />
      {nextCursor && (
        <div className="flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}
      {error && events.length > 0 && (
        <ErrorMessage message={error.message} onRetry={() => void fetchEvents()} />
      )}
    </div>
  );
}
