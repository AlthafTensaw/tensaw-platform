import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { useAuthStore, type AuthStore } from '@tensaw/runtime';

import { loadUserFromToken } from '../../bootstrap';
import { fetchAuthSession } from 'aws-amplify/auth';

function SignInRedirector() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const signIn = useAuthStore((s: AuthStore) => s.signIn);

  useEffect(() => {
    async function syncAuth() {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (token) {
          const { user, clinicId } = loadUserFromToken(token);
          signIn({ user, clinicId });
        }
      } catch (e) {
        console.warn('Failed to sync auth session', e);
      }
      const next = params.get('next') ?? '/inbox';
      navigate(next, { replace: true });
    }
    syncAuth();
  }, [params, navigate, signIn]);

  return <p className="text-sm text-muted-foreground">Redirecting...</p>;
}

export function RealSignInPage(): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const status = useAuthStore((s: AuthStore) => s.status);

  // If already logged in, redirect away without full reload
  useEffect(() => {
    if (status === 'signed-in') {
      const next = params.get('next') ?? '/inbox';
      navigate(next, { replace: true });
    }
  }, [status, navigate, params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">

      
        
        {/* The AWS Authenticator renders the login form until the user signs in. */}
        <Authenticator hideSignUp>
          {() => (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">Signed in successfully.</p>
              <SignInRedirector />
            </div>
          )}
        </Authenticator>

    </div>
  );
}
