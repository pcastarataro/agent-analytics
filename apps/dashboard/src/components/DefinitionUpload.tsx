import { useState, useRef } from 'react';
import type { Definition } from '../api/types';

interface DefinitionUploadProps {
  entityType: 'agent' | 'skill';
  entityName: string;
  existingDefinition: Definition | null;
  onSaved: (definition: Definition) => void;
}

export function DefinitionUpload({
  entityType,
  entityName,
  existingDefinition,
  onSaved,
}: DefinitionUploadProps) {
  const [content, setContent] = useState(existingDefinition?.content ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 65536) {
      setMessage({ type: 'error', text: 'File too large (max 64KB)' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setContent(reader.result as string);
      setMessage(null);
    };
    reader.onerror = () => {
      setMessage({ type: 'error', text: 'Failed to read file' });
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (!content.trim()) {
      setMessage({ type: 'error', text: 'Content cannot be empty' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const hash = await computeHash(content);
      const res = await fetch(`/v1/definitions/${hash}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, entityType, entityName }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error ?? `HTTP ${res.status}`);
      }

      const definition = (await res.json()) as Definition;
      setMessage({ type: 'success', text: 'Definition saved successfully' });
      onSaved(definition);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,.txt"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Upload .md file
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setMessage(null);
        }}
        placeholder="Enter markdown content..."
        className="w-full rounded border border-gray-300 p-3 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        rows={12}
      />

      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(content));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
