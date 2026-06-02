/**
 * Auth store.
 *
 * Replaces Redux authSlice. Tracks signed-in user, current clinic id, and
 * last activity timestamp (used by idle timeout).
 *
 * The session-expired transition (formerly the SESSION_EXPIRED_ACTION
 * extraReducer) becomes the `expireSession` method, called directly by the
 * API layer's 401 handler.
 *
 * Persistence: `user`, `clinicId`, and `status` are written to localStorage
 * under the key `tensaw-auth` via Zustand's `persist` middleware. On a hard
 * refresh the store rehydrates synchronously from storage so route guards
 * see the restored session before they render, preventing the flash-redirect
 * to /sign-in. Only data fields are persisted — action methods are excluded
 * via `partialize`.
 */
import { create } from 'zustand';
import { subscribeWithSelector, persist, createJSONStorage } from 'zustand/middleware';
import type { AuthState, AuthUser } from '../types';

export interface AuthStore extends AuthState {
  signIn: (params: { user: AuthUser; clinicId: string | number | null }) => void;
  signOut: () => void;
  switchClinic: (clinicId: string | number) => void;
  recordActivity: () => void;
  expireSession: () => void;
}

const INITIAL: AuthState = {
  status: 'unknown',
  user: null,
  clinicId: null,
  lastActivityAt: null,
};

export const useAuthStore = create<AuthStore>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        ...INITIAL,
        signIn: ({ user, clinicId }) =>
          { set({
            status: 'signed-in',
            user,
            clinicId,
            lastActivityAt: new Date().toISOString(),
          }); },
        signOut: () =>
          { set({
            status: 'signed-out',
            user: null,
            clinicId: null,
            lastActivityAt: null,
          }); },
        switchClinic: (clinicId) => { set({ clinicId }); },
        recordActivity: () => { set({ lastActivityAt: new Date().toISOString() }); },
        expireSession: () =>
          { set({
            status: 'session-expired',
            user: null,
          }); },
      }),
      {
        name: 'tensaw-auth',
        storage: createJSONStorage(() => localStorage),
        onRehydrateStorage: () => (state) => {
          if (state && state.status === 'unknown') {
            useAuthStore.setState({ status: 'signed-out' });
          }
        },
        // Only persist data fields — methods are recreated by Zustand.
        partialize: (s) => ({
          status: s.status,
          user: s.user,
          clinicId: s.clinicId,
          lastActivityAt: s.lastActivityAt,
        }),
      },
    ),
  ),
);

/** Test/bootstrap helper — reset to initial. */
export function _resetAuthStore(): void {
  useAuthStore.setState({ ...INITIAL });
  localStorage.removeItem('tensaw-auth');
}
