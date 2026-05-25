# Mock-server index.ts — exports to add (v2.3)

Append this block to the end of `packages/mock-server/src/index.ts`.
v2.3 adds: `BulkAssignmentEntrySchema`, `BulkAssignmentRequestSchema`, `BulkAssignmentResultEntrySchema`, `BulkAssignmentResponseSchema` + their type re-exports.

```ts
export {
  ConfidenceEnum, ClassificationSourceEnum, ClassificationStateEnum,
  OverrideReasonEnum, PriorityChipEnum, AgingBucketEnum,
  BulkAcceptRejectReasonEnum, RevealPhiPurposeEnum,
  DecimalStringSchema, WorkflowStepSchema, ClassificationSchema,
  ClaimSummarySchema, ClaimDetailSchema, DenialEventCodeSchema,
  DenialEventSchema, DenialEventListSchema, WorklistRowSchema,
  WorklistResponseSchema, WorklistRequestSchema, AcceptRequestSchema,
  OverrideRequestSchema, CompleteRequestSchema,
  StepCompletionRequestSchema, StepCompletionResponseSchema,
  RevealPhiRequestSchema, RevealPhiResponseSchema,
  StateTransitionResponseSchema, BulkAcceptRequestSchema,
  BulkAcceptRejectionSchema, BulkAcceptResponseSchema,
  DailyCostRowSchema, CostSummarySchema, CostQuerySchema,
  CATEGORY_VALUES, OVERRIDE_REASON_COPY,
  type Confidence, type ClassificationSource, type ClassificationState,
  type OverrideReason, type PriorityChip, type AgingBucket,
  type BulkAcceptRejectReason, type RevealPhiPurpose,
  type WorkflowStep, type Classification, type ClaimSummary,
  type ClaimDetail, type DenialEventCode, type DenialEvent,
  type WorklistRow, type WorklistResponse, type WorklistRequest,
  type AcceptRequest, type OverrideRequest, type CompleteRequest,
  type StepCompletionRequest, type StepCompletionResponse,
  type RevealPhiRequest, type RevealPhiResponse,
  type StateTransitionResponse, type BulkAcceptRequest,
  type BulkAcceptRejection, type BulkAcceptResponse,
  type DailyCostRow, type CostSummary, type CostQuery, type Category,
  // v1.7.2 + v1.8.0
  StepPriorityEnum, StepStatusEnum,
  UserDirectoryEntrySchema, UserDirectoryRequestSchema, UserDirectoryResponseSchema,
  StepAssignmentRequestSchema, StepAssignmentResponseSchema, StepStatusRequestSchema,
  // v1.8.1 — tasks/mine
  TaskRowSchema, TasksMineRequestSchema, TasksMineResponseSchema,
  // v1.9.0 — bulk assign
  BulkAssignmentEntrySchema, BulkAssignmentRequestSchema,
  BulkAssignmentResultEntrySchema, BulkAssignmentResponseSchema,
  type StepPriority, type StepStatus,
  type UserDirectoryEntry, type UserDirectoryRequest, type UserDirectoryResponse,
  type StepAssignmentRequest, type StepAssignmentResponse, type StepStatusRequest,
  // v1.8.1 — tasks/mine
  type TaskRow, type TasksMineRequest, type TasksMineResponse,
  // v1.9.0 — bulk assign
  type BulkAssignmentEntry, type BulkAssignmentRequest,
  type BulkAssignmentResultEntry, type BulkAssignmentResponse,
} from './schemas/denial';

export { WORKLIST_ROWS, WORKLIST_FIXTURE_META } from './fixtures/denial/recommendations';
export { buildCostSummary } from './fixtures/denial/costDaily';
export { buildDenialHandlers } from './handlers/denialHandlers';
export { resetMockDenialState, resetAndBackfill } from './handlers/denialState';
export { USER_DIRECTORY } from './fixtures/denial/users';
```
