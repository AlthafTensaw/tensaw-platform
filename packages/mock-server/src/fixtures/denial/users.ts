/**
 * User directory fixture (v1.7.2).
 *
 * Twelve users covering the SOP's named roles + the AR analysts referenced
 * in WORKLIST_FIXTURE_META.recommended_owners. Each user_id is stable so
 * any FE avatar-color hashing is deterministic across renders and across
 * test runs.
 *
 * No emails / usernames / middle names per backend's PHI-light decision.
 *
 * Role IDs roughly:
 *   - 110: AR analyst (work_recommendations)
 *   - 120: Facility EMR checker (Bhavana role)
 *   - 130: Iris Liaison
 *   - 140: MAI auto-routing user
 *   - 200: Manager (view_cost + classify_claim)
 */

import type { UserDirectoryEntry } from '../../schemas/denial';

export const USER_DIRECTORY: UserDirectoryEntry[] = [
  // AR analysts
  { user_id: 1, clinic_id: 0, role_id: 110, first_name: 'Vipin', last_name: 'Kumar', initials: 'VK', active: true },
  { user_id: 2, clinic_id: 0, role_id: 110, first_name: 'Aniket', last_name: 'Sharma', initials: 'AS', active: true },
  { user_id: 3, clinic_id: 0, role_id: 110, first_name: 'Priya', last_name: 'Iyer', initials: 'PI', active: true },
  { user_id: 4, clinic_id: 0, role_id: 110, first_name: 'Rahul', last_name: 'Mehta', initials: 'RM', active: true },
  { user_id: 5, clinic_id: 0, role_id: 110, first_name: 'Anita', last_name: 'Desai', initials: 'AD', active: true },
  { user_id: 6, clinic_id: 0, role_id: 110, first_name: 'Karthik', last_name: 'Nair', initials: 'KN', active: true },

  // Facility EMR checkers (Bhavana role)
  { user_id: 12, clinic_id: 0, role_id: 120, first_name: 'Bhavana', last_name: 'Ramesh', initials: 'BR', active: true },
  { user_id: 13, clinic_id: 0, role_id: 120, first_name: 'Deepa', last_name: 'Krishnan', initials: 'DK', active: true },

  // Iris Liaison reps
  { user_id: 20, clinic_id: 0, role_id: 130, first_name: 'Lakshmi', last_name: 'Pillai', initials: 'LP', active: true },
  { user_id: 21, clinic_id: 0, role_id: 130, first_name: 'Sandeep', last_name: 'Gupta', initials: 'SG', active: true },

  // Managers
  { user_id: 50, clinic_id: 0, role_id: 200, first_name: 'Roopa', last_name: 'Venkatesh', initials: 'RV', active: true },
  { user_id: 51, clinic_id: 0, role_id: 200, first_name: 'Meera', last_name: 'Joshi', initials: 'MJ', active: true },
];
