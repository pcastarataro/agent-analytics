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

    it('skips unreadable files with warn log', async () => {
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['locked.md']),
        readFile: jest.fn((): string => {
          throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
        }),
      });
      const uploader = createDefinitionUploader(deps);

      await uploader.scanDefinitions(['/skills']);

      expect(deps.putDefinition).not.toHaveBeenCalled();
      expect(deps.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: expect.stringContaining('Failed to read'),
        }),
      );
    });

    it('skips duplicate hashes across directories', async () => {
      let callCount = 0;
      const deps = makeDeps({
        readdir: jest.fn((): string[] => (callCount++ === 0 ? ['a.md'] : ['b.md'])),
        readFile: jest.fn((): string => 'same content'),
      });
      const uploader = createDefinitionUploader(deps);

      await uploader.scanDefinitions(['/dir1', '/dir2']);

      expect(deps.putDefinition).toHaveBeenCalledTimes(1);
      expect(uploader.uploadedHashes.size).toBe(1);
    });

    it('logs error when putDefinition fails and continues', async () => {
      let putCallCount = 0;
      const deps = makeDeps({
        readdir: jest.fn((): string[] => ['a.md', 'b.md']),
        readFile: jest.fn()
          .mockReturnValueOnce('content a')
          .mockReturnValueOnce('content b') as unknown as DefinitionUploaderDeps['readFile'],
        putDefinition: jest.fn(async () => {
          if (putCallCount++ === 0) throw new Error('network');
        }),
      });
      const uploader = createDefinitionUploader(deps);

      await uploader.scanDefinitions(['/skills']);

      expect(deps.log).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', message: expect.stringContaining('Failed to upload') }),
      );
      expect(deps.putDefinition).toHaveBeenCalledTimes(2);
      // Only successful upload is cached — failed hash allows retry
      expect(uploader.uploadedHashes.size).toBe(1);
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

    it('adds hash to cache on miss (fire-and-forget)', async () => {
      const deps = makeDeps();
      const uploader = createDefinitionUploader(deps);

      expect(uploader.uploadedHashes.has('new-hash')).toBe(false);

      await uploader.ensureDefinition('new-hash');

      expect(uploader.uploadedHashes.has('new-hash')).toBe(true);
      // No putDefinition call — content not available from hash alone
      expect(deps.putDefinition).not.toHaveBeenCalled();
    });
  });
});
