import { useState, type FormEvent } from 'react';
import { fetchApi } from '../api/client';

interface CreateUserModalProps {
  onCreated: () => void;
  onCancel: () => void;
}

interface CreateUserResponse {
  id: string;
  name: string;
  api_key: string;
  createdAt: string;
}

export function CreateUserModal({ onCreated, onCancel }: CreateUserModalProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetchApi<CreateUserResponse>('/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });
      setApiKey(res.api_key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
      const el = document.getElementById('api-key-display');
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  // After creation — show the key
  if (apiKey) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
          <h3 className="mb-2 text-base font-semibold text-gray-900">User Created</h3>
          <p className="mb-4 text-sm text-gray-600">
            API key for <strong>{name}</strong>. Copy it now — it won't be shown again.
          </p>
          <div className="mb-2 rounded-md border border-yellow-200 bg-yellow-50 p-3">
            <p className="mb-2 text-xs font-medium text-yellow-800">
              ⚠ Save this key now. It won't be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code
                id="api-key-display"
                className="flex-1 break-all rounded bg-white px-3 py-2 text-sm font-mono text-gray-900 border border-gray-200"
              >
                {apiKey}
              </code>
              <button
                onClick={copyToClipboard}
                className="shrink-0 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => {
                setApiKey(null);
                onCreated();
              }}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Create form
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-gray-900">Create User</h3>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="create-name" className="mb-1 block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="create-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="create-password" className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="create-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
