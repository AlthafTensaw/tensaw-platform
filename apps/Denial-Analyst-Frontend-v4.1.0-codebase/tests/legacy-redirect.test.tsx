/**
 * P1.12 — LegacyRedirect tests.
 *
 * Verifies /denials/* URLs redirect to /inbox via the Navigate component.
 */

import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LegacyRedirect } from '../src/components/LegacyRedirect';
import {
  __setPathname,
  __setSearchParams,
  __getPathname,
} from '../stubs/react-router-dom';

describe('LegacyRedirect', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('redirects /denials to /inbox by default', async () => {
    __setPathname('/denials');
    render(<LegacyRedirect />);
    await waitFor(() => {
      expect(__getPathname()).toBe('/inbox');
    });
  });

  it('redirects /denials/work/DEN-123 to /inbox (drops v3 path segments)', async () => {
    __setPathname('/denials/work/DEN-123');
    render(<LegacyRedirect />);
    await waitFor(() => {
      expect(__getPathname()).toBe('/inbox');
    });
  });

  it('logs the source URL so analysts notice legacy bookmarks', async () => {
    __setPathname('/denials');
    __setSearchParams('denial=DEN-456');
    render(<LegacyRedirect />);
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    // The log should mention both the source and target
    const calls = consoleSpy.mock.calls.flat().join(' ');
    expect(calls).toMatch(/denials/);
    expect(calls).toMatch(/inbox/);
  });

  it('respects custom `to` prop when provided', async () => {
    __setPathname('/denials');
    render(<LegacyRedirect to="/work-queue" />);
    await waitFor(() => {
      expect(__getPathname()).toBe('/work-queue');
    });
  });
});
