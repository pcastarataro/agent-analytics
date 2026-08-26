import {
  builtinDefinitionHash,
  extractTokenMetrics,
  resolveDefinitionVersion,
  resolveStatus,
  type OpenCodeTokensShape,
} from '../normalize';

describe('Definition Version and Hash Resolution', () => {
  describe('resolveDefinitionVersion', () => {
    it('returns the first defined candidate', () => {
      expect(resolveDefinitionVersion('1.2.3')).toBe('1.2.3');
      expect(resolveDefinitionVersion(undefined, '0.9.0', '2.0.0')).toBe('0.9.0');
    });

    it("falls back to 'unknown' when no candidate is defined", () => {
      expect(resolveDefinitionVersion(undefined)).toBe('unknown');
      expect(resolveDefinitionVersion(null, undefined)).toBe('unknown');
      expect(resolveDefinitionVersion()).toBe('unknown');
    });
  });

  describe('builtinDefinitionHash', () => {
    it('yields exactly builtin:explore for built-in agent explore', () => {
      expect(builtinDefinitionHash('explore')).toBe('builtin:explore');
    });

    it('never yields null, undefined, or an empty string', () => {
      const hash = builtinDefinitionHash('');
      expect(hash).not.toBeNull();
      expect(hash).not.toBeUndefined();
      expect(hash.length).toBeGreaterThan(0);
    });
  });
});

describe('Status Mapping From Error Taxonomy', () => {
  it.each([
    ['undefined error', undefined, 'success'],
    ['null error', null, 'success'],
    ['MessageAbortedError', { name: 'MessageAbortedError' }, 'cancelled'],
    ['ProviderAuthError', { name: 'ProviderAuthError' }, 'error'],
    ['unknown SomeNewError', { name: 'SomeNewError' }, 'error'],
    ['plain Error instance', new Error('boom'), 'error'],
  ])('maps %s → %s', (_label, error, expected) => {
    expect(resolveStatus(error)).toBe(expected);
  });
});

describe('Token Metrics Extraction', () => {
  it('maps structural token fields onto canonical metric names', () => {
    expect(extractTokenMetrics({ input: 120, output: 45, cached: 8 })).toEqual({
      inputTokens: 120,
      outputTokens: 45,
      cachedTokens: 8,
    });
  });

  it('omits absent token fields and tolerates missing input', () => {
    expect(extractTokenMetrics({ input: 7 })).toEqual({ inputTokens: 7 });
    expect(extractTokenMetrics(undefined)).toEqual({});
  });
});

describe('Helper Purity', () => {
  it('returns deeply equal outputs on repeated calls and leaves inputs unchanged', () => {
    const statusInput = Object.freeze({ name: 'SomeNewError' });
    const tokensInput: OpenCodeTokensShape = Object.freeze({ input: 3, output: 4, cached: 5 });
    const statusSnapshot = structuredClone(statusInput);
    const tokensSnapshot = structuredClone(tokensInput);

    const results = [
      [resolveStatus(statusInput), resolveStatus(statusInput)],
      [
        resolveDefinitionVersion('1.0.0', undefined, null),
        resolveDefinitionVersion('1.0.0', undefined, null),
      ],
      [builtinDefinitionHash('explore'), builtinDefinitionHash('explore')],
      [extractTokenMetrics(tokensInput), extractTokenMetrics(tokensInput)],
    ];

    for (const [first, second] of results) {
      expect(first).toEqual(second);
    }

    expect(statusInput).toEqual(statusSnapshot);
    expect(tokensInput).toEqual(tokensSnapshot);
  });
});
