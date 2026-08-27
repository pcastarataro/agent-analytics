import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Polyfill ResizeObserver for jsdom (used by recharts ResponsiveContainer)
class ResizeObserverMock {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

// Auto-cleanup between tests
afterEach(() => {
  cleanup();
});
