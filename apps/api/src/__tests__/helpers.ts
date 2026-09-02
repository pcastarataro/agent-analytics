import type { UserRepository } from '@agent-analytics/database';

export function createMockUserRepository(): UserRepository {
  const userRepo: UserRepository = {
    findById: jest.fn().mockResolvedValue(null),
    findByName: jest.fn().mockResolvedValue(null),
    findByApiKeyHash: jest.fn().mockImplementation(async (hash: string) => {
      if (typeof hash === 'string' && hash.startsWith('hashed_aa_')) {
        return { id: 'user-1', name: 'test-user', passwordHash: '', apiKeyHash: hash, createdAt: new Date(), updatedAt: new Date() };
      }
      return null;
    }),
    create: jest.fn().mockResolvedValue({ id: 'user-1', name: 'test', apiKey: 'aa_test1234567890123456789012345678901234', createdAt: new Date() }),
    list: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(true),
    revokeKey: jest.fn().mockResolvedValue(true),
    regenerateKey: jest.fn().mockResolvedValue({ apiKey: 'aa_new12345678901234567890123456789012345' }),
    hashApiKey: jest.fn().mockImplementation(async (key: string) => `hashed_${key}`),
    comparePassword: jest.fn().mockResolvedValue(false),
  };
  return userRepo;
}
