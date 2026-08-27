import type { UsageEventDTO } from '../../api/types';

interface EventTableProps {
  events: UsageEventDTO[];
}

function formatTimestamp(event: UsageEventDTO): string {
  if (event.timestamp) {
    return new Date(event.timestamp).toLocaleString();
  }
  return '—';
}

export function EventTable({ events }: EventTableProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        No events found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Timestamp</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Agent</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Agent Version</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Tool</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Skill</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Skill Version</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Model</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Session</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">Prompt</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">Response</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {events.map((event) => (
            <tr key={event.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                {formatTimestamp(event)}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-900">
                {event.agent.name}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                {event.agent.version ?? event.agent.definitionHash ?? '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                {event.tool?.name ? String(event.tool.name) : '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                {event.skill?.name ? String(event.skill.name) : '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                {event.skill?.version ?? '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                {event.model?.id
                  ? `${event.model.provider ? `${event.model.provider}/` : ''}${String(event.model.id)}`
                  : '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge status={event.result.status} />
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-gray-500">
                {event.execution.traceId}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right text-gray-700">
                {event.metrics.inputTokens?.toLocaleString() ?? '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right text-gray-700">
                {event.metrics.outputTokens?.toLocaleString() ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: 'bg-green-50 text-green-700',
    error: 'bg-red-50 text-red-700',
    cancelled: 'bg-yellow-50 text-yellow-700',
  };

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {status}
    </span>
  );
}
