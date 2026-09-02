import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '../api/client';
import { CreateUserModal } from '../components/CreateUserModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface User {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

function formatDate(val: unknown): string {
  if (!val) return '—';
  try {
    return new Date(String(val)).toLocaleString();
  } catch {
    return '—';
  }
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: 'revoke' | 'regenerate' | 'delete';
    user: User;
    newApiKey?: string;
  } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<User[]>('/v1/users');
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleRevoke(user: User) {
    try {
      await fetchApi(`/v1/users/${user.id}/key/revoke`, { method: 'POST' });
      setConfirmAction(null);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Revoke failed');
    }
  }

  async function handleRegenerate(user: User) {
    try {
      const res = await fetchApi<{ api_key: string }>(`/v1/users/${user.id}/key/regenerate`, {
        method: 'POST',
      });
      setConfirmAction({ type: 'regenerate', user, newApiKey: res.api_key });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Regenerate failed');
    }
  }

  async function handleDelete(user: User) {
    try {
      await fetchApi(`/v1/users/${user.id}`, { method: 'DELETE' });
      setConfirmAction(null);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Users</h2>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={fetchUsers}
            className="mt-2 rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Users</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create User
        </button>
      </div>

      {users.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="mb-4 text-sm text-gray-500">No users yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create User
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    <Link
                      to={`/users/${encodeURIComponent(u.id)}`}
                      className="text-blue-600 hover:underline"
                    >
                      {u.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setConfirmAction({ type: 'revoke', user: u })}
                        className="rounded bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-100"
                      >
                        Revoke
                      </button>
                      <button
                        onClick={() => handleRegenerate(u)}
                        className="rounded bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        Regenerate
                      </button>
                      <button
                        onClick={() => setConfirmAction({ type: 'delete', user: u })}
                        className="rounded bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          onCreated={() => {
            setShowCreate(false);
            fetchUsers();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Confirm dialogs */}
      {confirmAction?.type === 'revoke' && (
        <ConfirmDialog
          title="Revoke API Key"
          message={`Revoke API key for ${confirmAction.user.name}? They will no longer be able to send events.`}
          confirmLabel="Revoke"
          danger
          onConfirm={() => handleRevoke(confirmAction.user)}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {confirmAction?.type === 'regenerate' && confirmAction.newApiKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="mb-2 text-base font-semibold text-gray-900">Key Regenerated</h3>
            <p className="mb-4 text-sm text-gray-600">
              New API key for <strong>{confirmAction.user.name}</strong>. The old key is now invalid.
            </p>
            <div className="mb-2 rounded-md border border-yellow-200 bg-yellow-50 p-3">
              <p className="mb-2 text-xs font-medium text-yellow-800">
                ⚠ Save this key now. It won't be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-white px-3 py-2 text-sm font-mono text-gray-900 border border-gray-200">
                  {confirmAction.newApiKey}
                </code>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(confirmAction.newApiKey!);
                  }}
                  className="shrink-0 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setConfirmAction(null);
                  fetchUsers();
                }}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction?.type === 'delete' && (
        <ConfirmDialog
          title="Delete User"
          message={`Delete user ${confirmAction.user.name}? This will also delete all their events. This action cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(confirmAction.user)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
