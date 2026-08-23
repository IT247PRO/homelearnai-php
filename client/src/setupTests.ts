import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Without this, DOM from one test's render() stays mounted into the next test.
afterEach(() => {
  cleanup();
});
