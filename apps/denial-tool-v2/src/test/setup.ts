/**
 * Vitest setup — runs before every test file.
 *
 * - Extends expect with jest-dom matchers (toBeInTheDocument, toBeDisabled, etc.)
 * - Resets stub state between tests so they don't bleed into each other
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

import { __resetMocks } from '../../stubs/tensaw/actions';
import {
  __resetSearchParams,
  __resetPathname,
} from '../../stubs/react-router-dom';

beforeEach(() => {
  __resetMocks();
  __resetSearchParams();
  __resetPathname();
});

afterEach(() => {
  cleanup();
});
