/**
 * PrivacyField — denial-tool wrapper around the platform PrivacyField.
 *
 * PR-7 fixes:
 *   - Icon rendering: platform IconButton takes icon: ReactNode (a React
 *     element), not a string. And the platform uses Lucide via
 *     lucide-react, so the name is PascalCase (Eye, EyeOff), not Tabler
 *     kebab-case. Bug #16.
 *   - reveal-phi dispatch: flatten the request to include
 *     classification_id at top level (snake_case) so the dispatcher
 *     substitutes into the {classification_id} path placeholder. Bug #14.
 *   - Token rewrites.
 */

import { PrivacyField as PlatformPrivacyField } from '@tensaw/design-system/rcm';
import { Icon, IconButton } from '@tensaw/design-system/primitives';
import { useActionMutation } from '@tensaw/actions';
import type { RevealPhiPurpose, RevealPhiResponse } from '../actions/schemas';
import { usePermissions } from '../auth/permissions';

interface DenialPrivacyFieldProps {
  value: string | null | undefined;
  classificationId: string;
  /**
   * Free-text field_path the backend logs. Conventions:
   *   "claim.patient_name"
   *   "claim.mrn"
   *   "denial_event:{event_id}.carc.{code}.reason_text"
   *   "denial_event:{event_id}.rarc.{code}.reason_text"
   */
  fieldPath: string;
  purpose?: RevealPhiPurpose;
  className?: string;
}

const maskFn = (_value: string) => '•••••••••';

export function PrivacyField({
  value,
  classificationId,
  fieldPath,
  purpose = 'worklist_review',
  className,
}: DenialPrivacyFieldProps) {
  const { has } = usePermissions();
  const canReveal = has('denial.read');

  const [fire] = useActionMutation<
    {
      classification_id: string;
      field_path: string;
      purpose: string;
    },
    RevealPhiResponse
  >('denial.reveal-phi');

  if (!value) {
    return <span className={className}>—</span>;
  }

  const fieldKey = fieldPath.split('.').slice(-1)[0] ?? 'unknown';

  const handleReveal = () => {
    // PR-7: flat request shape — classification_id at top level for path
    // substitution, body fields alongside it. The dispatcher's URL
    // template builder pulls classification_id; the rest goes to the body.
    fire({
      classification_id: classificationId,
      field_path: fieldPath,
      purpose,
    }).catch((err: unknown) => {
      // Fire-and-forget per HIPAA: reveal happens regardless of audit
      // success. Log only.
      // eslint-disable-next-line no-console
      console.warn('reveal-phi audit dispatch failed', err);
    });
  };

  return (
    <PlatformPrivacyField
      value={value}
      maskFn={maskFn}
      fieldKey={fieldKey}
      recordType="classification"
      recordId={classificationId}
      canReveal={canReveal}
      onReveal={handleReveal}
      render={({ displayValue, isRevealed, toggleReveal }) => (
        <span className={className}>
          <span className={isRevealed ? 'font-mono' : 'tracking-wider'}>
            {displayValue}
          </span>
          {canReveal ? (
            <IconButton
              // Platform IconButton takes icon: ReactNode. Lucide
              // PascalCase names: Eye, EyeOff. Bug #16.
              icon={<Icon name={isRevealed ? 'EyeOff' : 'Eye'} size="xs" />}
              size="sm"
              variant="ghost"
              aria-label={isRevealed ? 'Hide PHI' : 'Reveal PHI'}
              onClick={toggleReveal}
              className="ml-1"
            />
          ) : null}
        </span>
      )}
    />
  );
}
