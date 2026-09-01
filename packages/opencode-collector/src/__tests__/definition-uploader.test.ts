import { computeHash, createDefinitionUploader } from '../infra/definition-uploader';
import type { DefinitionUploaderDeps } from '../infra/definition-uploader';
import type { DefinitionPayload } from '../domain/types';

function makeDeps(overrides?: Partial<DefinitionUploaderDeps>): DefinitionUploaderDeps {
  return {
    readFile: jest.fn((): string => 'file content'),
    readdir: jest.fn((): string[] => ['SKILL.md']),
    putDefinition: jest.fn().mockResolvedValue(undefined),
    log: jest.fn(),
    ...overrides,
  };
}

describe('computeHash', () => {
  it('returns deterministic SHA-256 hex for same input', () => {
    const hash1 = computeHash('hello world');
    const hash2 = computeHash('hello world');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns different hash for different input', () => {
    const hash1 = computeHash('content A');
    const hash2 = computeHash('content B');
    expect(hash1).not.toBe(hash2);
  });
});

describe('createDefinitionUploader', () => {
  describe('buildIndex', () => {
    it('returns 0 for empty dirs', async () => {
      const deps = makeDeps({ readdir: jest.fn((): string[] => []) });
      const uploader = createDefinitionUploader(deps);

      const count = await uploader.buildIndex(['/skills']);

      expect(count).toBe(0);
    });

    it('skips missing directories silently', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }),
      });
      const uploader = createDefinitionUploader(deps);

      const count = await uploader.buildIndex(['/nonexistent']);

      expect(count).toBe(0);
      expect(deps.readFile).not.toHaveBeenCalled();
      expect(deps.putDefinition).not.toHaveBeenCalled();
    });

    it('populates index without uploading', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['SKILL.md']),
        readFile: jest.fn((): string => 'skill content'),
      });
      const uploader = createDefinitionUploader(deps);

      const count = await uploader.buildIndex(['/skills']);

      expect(count).toBe(1);
      // Key assertion: no uploads occurred — index only, no PUT
      expect(deps.putDefinition).not.toHaveBeenCalled();
    });

    it('returns count across multiple directories', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['SKILL.md']),
        readFile: jest.fn((): string => 'content'),
      });
      const uploader = createDefinitionUploader(deps);

      const count = await uploader.buildIndex(['/skills', '/agents']);

      expect(count).toBe(2);
    });

    it('recurses into subdirectories', async () => {
      const deps = makeDeps();
      (deps.readdir as jest.Mock)
        .mockReturnValueOnce(['branch-pr', 'chained-pr'])
        .mockReturnValueOnce(['SKILL.md'])
        .mockReturnValueOnce(['SKILL.md']);
      (deps.readFile as jest.Mock)
        .mockImplementationOnce(() => { throw new Error('EISDIR'); })
        .mockReturnValueOnce('branch-pr content')
        .mockImplementationOnce(() => { throw new Error('EISDIR'); })
        .mockReturnValueOnce('chained-pr content');

      const uploader = createDefinitionUploader(deps);
      const count = await uploader.buildIndex(['/skills']);

      expect(count).toBe(2);
      expect(deps.putDefinition).not.toHaveBeenCalled();
    });

    it('handles multiple top-level directories', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['skill.md']),
        readFile: jest.fn((): string => 'content'),
      });
      const uploader = createDefinitionUploader(deps);

      const count = await uploader.buildIndex(['/skills', '/agents']);

      expect(count).toBe(2);
    });
  });

  describe('scanDefinitions', () => {
    it('uploads definitions from valid directories', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['SKILL.md']),
        readFile: jest.fn((): string => 'skill content'),
      });
      const uploader = createDefinitionUploader(deps);

      await uploader.scanDefinitions(['/skills']);

      expect(deps.putDefinition).toHaveBeenCalledTimes(1);
      const payload = (deps.putDefinition as jest.Mock).mock.calls[0]![0] as DefinitionPayload;
      expect(payload.hash).toBe(computeHash('skill content'));
      expect(payload.content).toBe('skill content');
      expect(payload.type).toBe('skill');
      expect(uploader.uploadedHashes.size).toBe(1);
    });

    it('skips missing directories silently with debug log', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }),
      });
      const uploader = createDefinitionUploader(deps);

      await uploader.scanDefinitions(['/nonexistent']);

      expect(deps.putDefinition).not.toHaveBeenCalled();
      expect(deps.log).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'debug' }),
      );
    });

    it('skips files exceeding 1MB limit', async () => {
      const largeContent = 'x'.repeat(1_000_001);
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['large-skill.md']),
        readFile: jest.fn((): string => largeContent),
      });
      const uploader = createDefinitionUploader(deps);

      await uploader.scanDefinitions(['/skills']);

      expect(deps.putDefinition).not.toHaveBeenCalled();
      expect(deps.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: expect.stringContaining('exceeds 1MB'),
        }),
      );
    });

    it('infers agent type from path without /skills/', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['agent.md']),
        readFile: jest.fn((): string => 'agent content'),
      });
      const uploader = createDefinitionUploader(deps);

      await uploader.scanDefinitions(['/agents']);

      const payload = (deps.putDefinition as jest.Mock).mock.calls[0]![0] as DefinitionPayload;
      expect(payload.type).toBe('agent');
    });
  });

  describe('ensureDefinition', () => {
    it('returns immediately for cached hash', async () => {
      const deps = makeDeps();
      const uploader = createDefinitionUploader(deps);

      uploader.uploadedHashes.add('cached-hash');
      await uploader.ensureDefinition('cached-hash');

      expect(deps.putDefinition).not.toHaveBeenCalled();
    });

    it('uploads on cache miss when name is in index', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['SKILL.md']),
        readFile: jest.fn((): string => 'skill content'),
      });
      const uploader = createDefinitionUploader(deps);

      // Build the index first
      await uploader.buildIndex(['/skills']);

      const eventHash = computeHash('old content');
      const currentHash = computeHash('skill content');
      await uploader.ensureDefinition(eventHash, 'skills');

      expect(deps.readFile).toHaveBeenCalledTimes(2); // 1 for buildIndex, 1 for ensureDefinition
      expect(deps.putDefinition).toHaveBeenCalledTimes(1);
      const payload = (deps.putDefinition as jest.Mock).mock.calls[0]![0] as DefinitionPayload;
      // Should use computed hash from file content, not event hash
      expect(payload.hash).toBe(currentHash);
      expect(payload.name).toBe('skills');
      expect(payload.type).toBe('skill');
      expect(payload.content).toBe('skill content');
      expect(uploader.uploadedHashes.has(currentHash)).toBe(true);
      expect(uploader.uploadedHashes.has(eventHash)).toBe(true);
    });

    it('skips upload on cache hit', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['SKILL.md']),
        readFile: jest.fn((): string => 'skill content'),
      });
      const uploader = createDefinitionUploader(deps);

      await uploader.buildIndex(['/skills']);

      const eventHash = computeHash('event content');
      const currentHash = computeHash('skill content');
      // First call — triggers upload
      await uploader.ensureDefinition(eventHash, 'skills');
      // Second call — eventHash already in cache, returns immediately
      await uploader.ensureDefinition(eventHash, 'skills');

      // readFile called once for buildIndex + once for first ensureDefinition = 2
      // Second ensureDefinition returns early (eventHash cached)
      expect(deps.readFile).toHaveBeenCalledTimes(2);
      expect(deps.putDefinition).toHaveBeenCalledTimes(1);
    });

    it('caches hash and logs warning when name not in index', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['SKILL.md']),
        readFile: jest.fn((): string => 'skill content'),
      });
      const uploader = createDefinitionUploader(deps);

      await uploader.buildIndex(['/skills']);

      const hash = computeHash('unknown content');
      await uploader.ensureDefinition(hash, 'unknown-skill');

      expect(uploader.uploadedHashes.has(hash)).toBe(true);
      expect(deps.putDefinition).not.toHaveBeenCalled();
      expect(deps.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: expect.stringContaining('unknown-skill'),
        }),
      );
    });

    it('caches hash when name is undefined (hash-only guard)', async () => {
      const deps = makeDeps();
      const uploader = createDefinitionUploader(deps);

      await uploader.ensureDefinition('some-hash');

      expect(uploader.uploadedHashes.has('some-hash')).toBe(true);
      expect(deps.putDefinition).not.toHaveBeenCalled();
    });

    it('handles file not found gracefully', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['SKILL.md']),
        readFile: jest.fn()
          .mockReturnValueOnce('skill content') // buildIndex succeeds
          .mockImplementationOnce(() => { throw new Error('ENOENT'); }), // ensureDefinition fails
      });
      const uploader = createDefinitionUploader(deps);

      await uploader.buildIndex(['/skills']);

      const hash = computeHash('skill content');
      await uploader.ensureDefinition(hash, 'skills');

      expect(uploader.uploadedHashes.has(hash)).toBe(true);
      expect(deps.putDefinition).not.toHaveBeenCalled();
      expect(deps.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: expect.stringContaining('not found'),
        }),
      );
    });

    it('does not cache hash when PUT fails (allows retry)', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['SKILL.md']),
        readFile: jest.fn((): string => 'skill content'),
        putDefinition: jest.fn().mockRejectedValue(new Error('network')),
      });
      const uploader = createDefinitionUploader(deps);

      await uploader.buildIndex(['/skills']);

      const eventHash = computeHash('event content');
      const currentHash = computeHash('skill content');
      await uploader.ensureDefinition(eventHash, 'skills');

      expect(deps.putDefinition).toHaveBeenCalledTimes(1);
      // Neither hash should be cached when PUT fails
      expect(uploader.uploadedHashes.has(currentHash)).toBe(false);
      expect(uploader.uploadedHashes.has(eventHash)).toBe(false);
    });

    it('uploads with computed hash when file content differs from event hash', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['SKILL.md']),
        readFile: jest.fn((): string => 'updated content'),
      });
      const uploader = createDefinitionUploader(deps);

      await uploader.buildIndex(['/skills']);

      const eventHash = computeHash('old content');
      const currentHash = computeHash('updated content');
      await uploader.ensureDefinition(eventHash, 'skills');

      expect(deps.putDefinition).toHaveBeenCalledTimes(1);
      const payload = (deps.putDefinition as jest.Mock).mock.calls[0]![0] as DefinitionPayload;
      expect(payload.hash).toBe(currentHash);
      expect(payload.content).toBe('updated content');
      // Both hashes should be marked as covered
      expect(uploader.uploadedHashes.has(currentHash)).toBe(true);
      expect(uploader.uploadedHashes.has(eventHash)).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('clears uploaded hashes', async () => {
      const deps = makeDeps();
      const uploader = createDefinitionUploader(deps);

      uploader.uploadedHashes.add('hash1');
      uploader.uploadedHashes.add('hash2');
      expect(uploader.uploadedHashes.size).toBe(2);

      uploader.clearCache();
      expect(uploader.uploadedHashes.size).toBe(0);
    });
  });

  describe('inferName', () => {
    it('uses subdirectory name for nested skills', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['pr-review', 'chained-pr']),
        readFile: jest.fn()
          .mockImplementationOnce(() => { throw new Error('EISDIR'); })
          .mockReturnValueOnce('content1')
          .mockImplementationOnce(() => { throw new Error('EISDIR'); })
          .mockReturnValueOnce('content2'),
      });
      const uploader = createDefinitionUploader(deps);

      await uploader.buildIndex(['/skills']);

      // Both should be indexed by their subdirectory name
      expect(uploader.uploadedHashes.size).toBe(0);
      expect(deps.putDefinition).not.toHaveBeenCalled();
    });

    it('uses parent directory name for flat skill files', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['SKILL.md']),
        readFile: jest.fn((): string => 'content'),
      });
      const uploader = createDefinitionUploader(deps);

      await uploader.scanDefinitions(['/skills']);

      const payload = (deps.putDefinition as jest.Mock).mock.calls[0]![0] as DefinitionPayload;
      // Flat structure: /skills/SKILL.md → name = "skills" (parent directory)
      expect(payload.name).toBe('skills');
    });
  });
});
