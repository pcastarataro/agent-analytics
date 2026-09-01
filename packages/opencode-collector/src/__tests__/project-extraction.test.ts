import { extractProjectName, detectGitBranch, getCachedBranch, createBranchCache } from '../project-extraction';

describe('extractProjectName', () => {
  it('returns basename of directory', () => {
    expect(extractProjectName('/home/user/my-project')).toBe('my-project');
  });

  it('returns directory name for nested paths', () => {
    expect(extractProjectName('/home/user/projects/agent-analytics')).toBe('agent-analytics');
  });

  it('returns "unknown" for undefined directory', () => {
    expect(extractProjectName(undefined)).toBe('unknown');
  });

  it('returns "unknown" for empty string', () => {
    expect(extractProjectName('')).toBe('unknown');
  });

  it('returns the name itself if it has no slashes', () => {
    expect(extractProjectName('simple-project')).toBe('simple-project');
  });
});

describe('detectGitBranch', () => {
  it('returns "unknown" for undefined directory', async () => {
    const branch = await detectGitBranch(undefined);
    expect(branch).toBe('unknown');
  });

  it('returns branch name for a git repository', async () => {
    // Use the current project directory which is a git repo
    const branch = await detectGitBranch('/Users/pablocastarataro/agent-analytics');
    expect(typeof branch).toBe('string');
    expect(branch.length).toBeGreaterThan(0);
  });

  it('returns "detached" for non-git directory', async () => {
    const branch = await detectGitBranch('/tmp');
    expect(branch).toBe('detached');
  });
});

describe('getCachedBranch', () => {
  it('returns same promise for same directory', () => {
    const cache = createBranchCache();
    const p1 = getCachedBranch(cache, '/tmp');
    const p2 = getCachedBranch(cache, '/tmp');
    expect(p1).toBe(p2);
  });

  it('returns different promises for different directories', () => {
    const cache = createBranchCache();
    const p1 = getCachedBranch(cache, '/tmp');
    const p2 = getCachedBranch(cache, '/var');
    expect(p1).not.toBe(p2);
  });

  it('caches the "unknown" key for undefined directory', () => {
    const cache = createBranchCache();
    const p1 = getCachedBranch(cache, undefined);
    const p2 = getCachedBranch(cache, undefined);
    expect(p1).toBe(p2);
  });
});
