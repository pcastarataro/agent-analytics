import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Definition } from '../api/types';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function DefinitionsPage() {
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/v1/definitions')
      .then((res) => {
        if (!res.ok) return { data: [] };
        return res.json();
      })
      .then((json) => {
        setDefinitions(json.data ?? []);
        setLoading(false);
      })
      .catch(() => {
        setDefinitions([]);
        setLoading(false);
      });
  }, []);

  const selected = definitions.find((d) => d.hash === selectedHash) ?? null;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Definitions</h2>

      {definitions.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="text-gray-500">No definitions uploaded yet.</p>
          <p className="mt-2 text-sm text-gray-400">
            Upload definitions from agent or skill detail pages.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-3">
              <h3 className="text-sm font-medium text-gray-700">All Definitions</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {definitions.map((def) => (
                <button
                  key={def.hash}
                  onClick={() => setSelectedHash(def.hash)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    selectedHash === def.hash ? 'bg-blue-50' : ''
                  }`}
                >
                  <p className="font-medium text-gray-900">{def.entityName}</p>
                  <p className="text-xs text-gray-500">
                    {def.entityType} · {def.version ?? '—'} · {def.hash.slice(0, 8)}...
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            {selected ? (
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{selected.entityName}</h3>
                    <p className="text-xs text-gray-500">
                      {selected.entityType} · {selected.version ? `v${selected.version}` : 'no version'} · Updated {new Date(selected.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <Link
                    to={`/${selected.entityType === 'agent' ? 'agents' : 'skills'}/${selected.entityName}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View detail →
                  </Link>
                </div>
                <MarkdownViewer content={selected.content} />
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
                <p className="text-gray-500">Select a definition to view</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
