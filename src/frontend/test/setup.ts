import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';

Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  value: () => 'blob:maize-detection-test',
  writable: true,
});

Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: () => undefined,
  writable: true,
});

beforeEach(() => {
  const indexedDb = new IDBFactory();
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: indexedDb,
  });
  Object.defineProperty(window, 'indexedDB', {
    configurable: true,
    value: indexedDb,
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
