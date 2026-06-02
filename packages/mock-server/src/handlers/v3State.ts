/**
 * v3.0 mock state — deterministic fixtures per claim_id.
 *
 * Singleton store. Initialized with seed data for the demo claim 300138
 * (Henderson, J) so the FE has realistic content to render on first load.
 * Other claim_ids get derived/empty defaults.
 *
 * In-memory only — resets on page reload (intentional for a mock).
 *
 * Real BE will replace each method with a DB-backed query/mutation.
 */

let appealIdSeq = 0;
let noteIdSeq = 0;

// ---------------------------------------------------------------------------
// Seed data for claim 300138 (Henderson, J — primary demo claim)
// ---------------------------------------------------------------------------

const SEED_LINE_ITEMS_300138 = [
  {
    line_id: 'li-300138-1',
    procedure_code: '99214',
    procedure_description: 'Office visit, established patient, Level 4',
    modifiers: [],
    billed: '250.00',
    allowed: '180.00',
    contractual_adjustment: '70.00',
    coinsurance: '0.00',
    deductible: '0.00',
    insurance_paid: '0.00',
    patient_paid: '20.00',
    balance: '230.00',
    line_status: 'denied' as const,
    service_date: '2026-02-24',
  },
  {
    line_id: 'li-300138-2',
    procedure_code: '93000',
    procedure_description: 'ECG, routine 12-lead',
    modifiers: [],
    billed: '85.00',
    allowed: '85.00',
    contractual_adjustment: '0.00',
    coinsurance: '0.00',
    deductible: '0.00',
    insurance_paid: '65.00',
    patient_paid: '20.00',
    balance: '0.00',
    line_status: 'paid' as const,
    service_date: '2026-02-24',
  },
];

const SEED_TRANSACTIONS_300138 = [
  {
    transaction_id: 'tx-300138-1',
    posted_at: '2026-02-24T00:00:00Z',
    type: 'charge' as const,
    party: 'system' as const,
    mode: null,
    amount: '335.00',
    reference: null,
    procedure_code: null,
    description: 'CPT 99214 + 93000',
  },
  {
    transaction_id: 'tx-300138-2',
    posted_at: '2026-02-24T14:30:00Z',
    type: 'payment' as const,
    party: 'patient' as const,
    mode: 'card' as const,
    amount: '-40.00',
    reference: '****1234',
    procedure_code: null,
    description: 'Patient copay',
  },
  {
    transaction_id: 'tx-300138-3',
    posted_at: '2026-03-15T09:00:00Z',
    type: 'adjustment' as const,
    party: 'primary' as const,
    mode: null,
    amount: '-70.00',
    reference: null,
    procedure_code: '99214',
    description: 'Humana MA contractual',
  },
  {
    transaction_id: 'tx-300138-4',
    posted_at: '2026-03-15T09:00:00Z',
    type: 'payment' as const,
    party: 'primary' as const,
    mode: 'eft' as const,
    amount: '-65.00',
    reference: 'EFT-8821',
    procedure_code: '93000',
    description: 'Humana MA insurance payment',
  },
  {
    transaction_id: 'tx-300138-5',
    posted_at: '2026-05-18T08:01:00Z',
    type: 'denial' as const,
    party: 'primary' as const,
    mode: null,
    amount: '0.00',
    reference: 'event-1245054',
    procedure_code: '99214',
    description: 'CO-50 medical necessity',
  },
];

const SEED_NOTES_300138 = [
  {
    note_id: 'note-300138-1',
    created_at: '2026-05-26T09:14:00Z',
    author_user_id: 101,
    author_name: 'Vipin K.',
    source: 'internal' as const,
    body: 'Spoke with facility records dept. Records were faxed 04/15 but to wrong fax number. Re-sending to confirmed payer fax: 1-866-555-0142. Bhavana to follow up by Thursday.',
  },
  {
    note_id: 'note-300138-2',
    created_at: '2026-05-18T14:22:00Z',
    author_user_id: null,
    author_name: 'System',
    source: 'allofactor' as const,
    body: 'Auto-generated from EOB ingestion. Henderson, J · MRN 72834 · CPT 99214 denied: CO-50. Net pending $1,353.93. Routed to denial-analysis tool by source rule MR-04-AUTO.',
  },
  {
    note_id: 'note-300138-3',
    created_at: '2026-04-02T11:47:00Z',
    author_user_id: 104,
    author_name: 'Renita M.',
    source: 'payer_call' as const,
    body: 'Called Humana auth dept. They confirmed records received 03/30 but rep claims clinical documentation insufficient — they need specifically the operative note and pre/post imaging. Will check with facility.',
  },
  {
    note_id: 'note-300138-4',
    created_at: '2026-03-15T16:30:00Z',
    author_user_id: 103,
    author_name: 'Aniket S.',
    source: 'internal' as const,
    body: 'Sent fax #2 to facility records, no response on fax #1 from 03/08. Will escalate to facility billing supervisor if no response by 03/22.',
  },
  {
    note_id: 'note-300138-5',
    created_at: '2026-01-20T08:01:00Z',
    author_user_id: null,
    author_name: 'System',
    source: 'allofactor' as const,
    body: "Initial denial received from Humana. Henderson, J · CPT 99214 · CO-50. First entry on this claim's denial chain.",
  },
];

const SEED_FILES_300138 = [
  {
    file_id: 'file-300138-1',
    filename: 'EOB_Humana_2026-05-18.pdf',
    file_type: 'eob' as const,
    mime_type: 'application/pdf',
    size_bytes: 2_400_000,
    uploaded_at: '2026-05-18T14:22:00Z',
    uploaded_by_user_id: null,
    uploaded_by_name: 'System',
  },
  {
    file_id: 'file-300138-2',
    filename: 'Medical_record_Henderson_J_02-24.pdf',
    file_type: 'medical_record' as const,
    mime_type: 'application/pdf',
    size_bytes: 4_700_000,
    uploaded_at: '2026-05-26T10:00:00Z',
    uploaded_by_user_id: 102,
    uploaded_by_name: 'Bhavana R.',
  },
  {
    file_id: 'file-300138-3',
    filename: 'Operative_note_Henderson_J.pdf',
    file_type: 'clinical' as const,
    mime_type: 'application/pdf',
    size_bytes: 1_100_000,
    uploaded_at: '2026-05-26T10:01:00Z',
    uploaded_by_user_id: 102,
    uploaded_by_name: 'Bhavana R.',
  },
  {
    file_id: 'file-300138-4',
    filename: 'Fax_to_facility_2026-03-08.pdf',
    file_type: 'outbound_fax' as const,
    mime_type: 'application/pdf',
    size_bytes: 312_000,
    uploaded_at: '2026-03-08T15:30:00Z',
    uploaded_by_user_id: 103,
    uploaded_by_name: 'Aniket S.',
  },
  {
    file_id: 'file-300138-5',
    filename: 'Fax_to_facility_2026-03-22.pdf',
    file_type: 'outbound_fax' as const,
    mime_type: 'application/pdf',
    size_bytes: 328_000,
    uploaded_at: '2026-03-22T16:30:00Z',
    uploaded_by_user_id: 103,
    uploaded_by_name: 'Aniket S.',
  },
  {
    file_id: 'file-300138-6',
    filename: 'Appeal_letter_draft_v1.pdf',
    file_type: 'appeal_draft' as const,
    mime_type: 'application/pdf',
    size_bytes: 185_000,
    uploaded_at: '2026-04-05T13:15:00Z',
    uploaded_by_user_id: 101,
    uploaded_by_name: 'Vipin K.',
  },
  {
    file_id: 'file-300138-7',
    filename: 'ECG_results_2026-02-24.png',
    file_type: 'clinical' as const,
    mime_type: 'image/png',
    size_bytes: 720_000,
    uploaded_at: '2026-05-26T10:05:00Z',
    uploaded_by_user_id: 102,
    uploaded_by_name: 'Bhavana R.',
  },
];

// ---------------------------------------------------------------------------
// Categories — canonical 33 (per BE category_taxonomy.yaml)
// ---------------------------------------------------------------------------

const SEED_CATEGORIES = [
  // Documentation
  { value: 1, label: 'Medical Record Missing', slug: 'medical_record_missing', ordinal: 4, color_hint: '#dc2626' },
  { value: 2, label: 'Medical Necessity / LCD', slug: 'medical_necessity', ordinal: 7, color_hint: '#dc2626' },
  { value: 3, label: 'Documentation Insufficient', slug: 'documentation_insufficient', ordinal: 8, color_hint: '#dc2626' },
  // Auth / referral
  { value: 4, label: 'Referral Missing', slug: 'referral_missing', ordinal: 3, color_hint: '#0d9488' },
  { value: 5, label: 'Auth Missing', slug: 'auth_missing', ordinal: 1, color_hint: '#0d9488' },
  { value: 6, label: 'Auth Expired', slug: 'auth_expired', ordinal: 2, color_hint: '#0d9488' },
  // Vague
  { value: 7, label: 'Vague Denial / Need Payer Call', slug: 'vague_denial', ordinal: 14, color_hint: '#f59e0b' },
  // Coding
  { value: 8, label: 'Coding Error', slug: 'coding_error', ordinal: 5, color_hint: '#1e40af' },
  { value: 9, label: 'Modifier Missing or Wrong', slug: 'modifier_missing', ordinal: 6, color_hint: '#1e40af' },
  { value: 10, label: 'Bundled Service', slug: 'bundled_service', ordinal: 9, color_hint: '#1e40af' },
  { value: 11, label: 'Duplicate Claim', slug: 'duplicate_claim', ordinal: 10, color_hint: '#1e40af' },
  // Coverage / eligibility
  { value: 12, label: 'Coverage Lapsed', slug: 'coverage_lapsed', ordinal: 11, color_hint: '#7c3aed' },
  { value: 13, label: 'Patient Not Eligible', slug: 'patient_not_eligible', ordinal: 12, color_hint: '#7c3aed' },
  { value: 14, label: 'Coordination of Benefits', slug: 'cob', ordinal: 13, color_hint: '#7c3aed' },
  // Timing
  { value: 15, label: 'Timely Filing', slug: 'timely_filing', ordinal: 15, color_hint: '#e11d48' },
];

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

interface Note {
  note_id: string;
  created_at: string;
  author_user_id: number | null;
  author_name: string;
  source: 'internal' | 'payer_call' | 'allofactor' | 'appeal' | 'system';
  body: string;
}

interface Appeal {
  appeal_id: string;
  template: 'medical_necessity';
  body_html: string;
  generated_at: string;
  generated_by_user_id: number;
  ai_model_used: string;
  context_used: {
    has_claim_metadata: boolean;
    has_denial_codes: boolean;
    prior_events_count: number;
    notes_count: number;
    files_count: number;
  };
  saved_at: string | null;
  sent_at: string | null;
}

const notesByClaim = new Map<string, Note[]>();
const appealsByClaim = new Map<string, Appeal>();

// Seed
notesByClaim.set('300138', [...SEED_NOTES_300138]);

function makeSampleLetter(claimId: string): string {
  return `
    <p><strong>Date:</strong> 05/26/26<br>
    <strong>To:</strong> Humana Medicare Advantage<br>
    Claims Appeals Department<br>
    Fax: 1-866-555-0142</p>

    <p><strong>Re:</strong> Appeal of denied claim · Henderson, J · DOS 02/24/26 · CPT 99214</p>

    <p>Dear Claims Appeals Department,</p>

    <p>We are submitting this appeal for reconsideration of <strong>claim ${claimId}</strong>, denied
    on 05/18/26 with remark code <strong>CARC CO-50</strong> (Not deemed a medical necessity).
    This is the third denial on this claim; prior denials on 01/20/26 (CO-50) and 03/12/26
    (CO-109 + M127) cited similar grounds.</p>

    <h4>Patient information</h4>
    <ul>
      <li>Patient: Henderson, J</li>
      <li>Member ID: [from policy file]</li>
      <li>Date of Service: 02/24/26</li>
      <li>Rendering Provider: Beats Cardiology PLLC (Facility #34)</li>
      <li>CPT: 99214 — Office visit, established patient, Level 4</li>
    </ul>

    <h4>Clinical justification</h4>
    <p>The Level 4 evaluation and management service performed on 02/24/26 was medically necessary
    based on the patient's complex chronic conditions and presentation. The visit involved
    detailed history, examination, and moderate-complexity medical decision-making as documented
    in the operative note dated 02/24/26 (attached).</p>

    <h4>Supporting documentation enclosed</h4>
    <ul>
      <li>Complete medical record for the date of service</li>
      <li>Operative note from rendering provider</li>
      <li>ECG results supporting cardiac evaluation</li>
    </ul>

    <h4>Requested action</h4>
    <p>We respectfully request that Humana reverse the denial of CPT 99214 on this claim and process
    payment for the outstanding balance of <strong>$230</strong>. The supporting documentation
    attached substantiates medical necessity for the service rendered.</p>

    <p>Sincerely,<br>
    <strong>Vipin K., AR Analyst</strong><br>
    Primrose RCM on behalf of Beats Cardiology PLLC</p>
  `.trim();
}

export const v3MockState = {
  getLineItems(claimId: string) {
    if (claimId === '300138') return SEED_LINE_ITEMS_300138;
    // Other claims: empty for now (BE returns empty array if no line items)
    return [];
  },

  getTransactions(claimId: string) {
    if (claimId === '300138') return SEED_TRANSACTIONS_300138;
    return [];
  },

  getNotes(claimId: string): Note[] {
    return notesByClaim.get(claimId) ?? [];
  },

  addNote(
    claimId: string,
    input: { source: string; body: string },
  ): Note {
    noteIdSeq += 1;
    const note: Note = {
      note_id: `note-new-${noteIdSeq}`,
      created_at: new Date().toISOString(),
      author_user_id: 101,
      author_name: 'Vipin K.',
      source: input.source as Note['source'],
      body: input.body,
    };
    const existing = notesByClaim.get(claimId) ?? [];
    notesByClaim.set(claimId, [note, ...existing]);
    return note;
  },

  getFiles(claimId: string) {
    if (claimId === '300138') return SEED_FILES_300138;
    return [];
  },

  getAppeal(claimId: string): Appeal | null {
    return appealsByClaim.get(claimId) ?? null;
  },

  generateAppeal(claimId: string, template: string): Appeal {
    appealIdSeq += 1;
    const draft: Appeal = {
      appeal_id: `appeal-${appealIdSeq}`,
      template: template as 'medical_necessity',
      body_html: makeSampleLetter(claimId),
      generated_at: new Date().toISOString(),
      generated_by_user_id: 101,
      ai_model_used: 'gpt-4o-mini',
      context_used: {
        has_claim_metadata: true,
        has_denial_codes: true,
        prior_events_count: 3,
        notes_count: notesByClaim.get(claimId)?.length ?? 0,
        files_count: claimId === '300138' ? SEED_FILES_300138.length : 0,
      },
      saved_at: null,
      sent_at: null,
    };
    appealsByClaim.set(claimId, draft);
    return draft;
  },

  saveAppeal(
    claimId: string,
    appealId: string,
    bodyHtml: string,
  ): Appeal | null {
    const existing = appealsByClaim.get(claimId);
    if (existing == null || existing.appeal_id !== appealId) return null;
    const updated: Appeal = {
      ...existing,
      body_html: bodyHtml,
      saved_at: new Date().toISOString(),
    };
    appealsByClaim.set(claimId, updated);
    return updated;
  },

  getCategories() {
    return SEED_CATEGORIES;
  },
};
