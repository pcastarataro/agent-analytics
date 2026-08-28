import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { SkillVersion } from '../api/types';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

interface SkillGroup {
  skillName: string;
  versions: SkillVersion[];
}

export function SkillsPage() {
  const [groups, setGroups] = useState<SkillGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/v1/stats/skills/versions')
      .then((res) => {
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const versions: SkillVersion[] = json.data ?? [];
        // Group by skillName
        const groupMap = new Map<string, SkillVersion[]>();
        for (const v of versions) {
          const existing = groupMap.get(v.skillName) ?? [];
          existing.push(v);
          groupMap.set(v.skillName, existing);
        }
        // Sort groups by name, versions by creation date (newest first)
        const sorted = Array.from(groupMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([skillName, versions]) => ({
            skillName,
            versions: versions.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            ),
          }));
        setGroups(sorted);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, []);

  const allVersions = groups.flatMap((g) => g.versions);
  const selected = allVersions.find((v) => v.definitionHash === selectedHash) ?? null;

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Skills</h2>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="text-gray-500">No skills found.</p>
          <p className="mt-2 text-sm text-gray-400">
            Skills appear here once the collector uploads their definitions.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Sidebar: skill list with version badges */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-3">
              <h3 className="text-sm font-medium text-gray-700">
                {groups.length} skill{groups.length !== 1 ? 's' : ''}
              </h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {groups.map((group) => (
                <div key={group.skillName}>
                  <div className="px-3 py-2 bg-gray-50">
                    <Link
                      to={`/skills/${encodeURIComponent(group.skillName)}`}
                      className="text-sm font-semibold text-gray-900 hover:underline"
                    >
                      {group.skillName}
                    </Link>
                    <span className="ml-2 text-xs text-gray-400">
                      {group.versions.length} version{group.versions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {group.versions.map((v) => (
                    <button
                      key={v.definitionHash}
                      onClick={() => setSelectedHash(v.definitionHash)}
                      className={`w-full px-3 py-2 pl-6 text-left text-sm hover:bg-gray-50 ${
                        selectedHash === v.definitionHash ? 'bg-blue-50' : ''
                      }`}
                    >
                      <p className="font-mono text-xs text-gray-600">
                        {v.definitionHash.slice(0, 12)}...
                      </p>
                      <p className="text-xs text-gray-400">
                        {v.version ?? 'no version'} · {new Date(v.createdAt).toLocaleDateString()}
                        {v.executionCount > 0 && (
                          <> · {v.executionCount} use{v.executionCount !== 1 ? 's' : ''}</>
                        )}
                      </p>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Main: selected definition content */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{selected.skillName}</h3>
                    <p className="text-xs text-gray-500">
                      <span className="font-mono">{selected.definitionHash.slice(0, 16)}...</span>
                      {' · '}
                      {selected.version ? `v${selected.version}` : 'no version'}
                      {' · '}
                      {new Date(selected.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {selected.executionCount > 0 && (
                      <>
                        <p>{selected.executionCount} execution{selected.executionCount !== 1 ? 's' : ''}</p>
                        <p>{selected.successRate.toFixed(1)}% success</p>
                        <p>${selected.totalCost.toFixed(4)} total</p>
                      </>
                    )}
                    {selected.executionCount === 0 && (
                      <p className="text-gray-400">No usage yet</p>
                    )}
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <MarkdownViewer content={selected.content} />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
                <p className="text-gray-500">Select a skill version to view its definition</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
