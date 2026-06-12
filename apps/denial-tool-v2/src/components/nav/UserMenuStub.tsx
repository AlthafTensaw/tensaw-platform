/**
 * UserMenuStub — placeholder for the existing UserMenu.
 *
 * The FE team's real UserMenu has sign-out, profile, theme toggle, etc.
 * This stub just renders the user's name + initial avatar to fill the
 * layout slot. Replace with the real component in production.
 *
 * Drop-in path: src/components/nav/UserMenuStub.tsx
 */

export interface UserMenuStubProps {
  userName: string;
}

export function UserMenuStub({ userName }: UserMenuStubProps): React.ReactElement {
  const initial = userName.trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-200">
      <span
        aria-hidden="true"
        className="
          inline-flex h-7 w-7 items-center justify-center
          rounded-full bg-slate-700 text-xs font-semibold text-slate-100
        "
      >
        {initial}
      </span>
      <span className="hidden sm:inline">{userName}</span>
    </div>
  );
}
