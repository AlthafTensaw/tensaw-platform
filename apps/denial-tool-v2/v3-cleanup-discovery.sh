#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# v3-cleanup-discovery.sh
#
# Run from the FE repo root:
#   bash v3-cleanup-discovery.sh
#
# Inventories v3 files/symbols still present after the v4 build. Does NOT
# delete anything. Output guides the staged deletion plan in the P1.14 readme.
#
# Exits non-zero only if no src/ directory is found. Otherwise always exits 0
# even when nothing v3-flavored remains (which is what we want at the end).
# ─────────────────────────────────────────────────────────────────────────────

set -u

if [ ! -d "src" ]; then
  echo "FAIL: no src/ directory found. Run from FE repo root."
  exit 1
fi

# Colors for terminals that support them
if [ -t 1 ]; then
  BOLD=$(tput bold 2>/dev/null || echo "")
  DIM=$(tput dim 2>/dev/null || echo "")
  RESET=$(tput sgr0 2>/dev/null || echo "")
else
  BOLD=""
  DIM=""
  RESET=""
fi

count_files_with_pattern() {
  local pattern="$1"
  grep -rln "$pattern" src/ 2>/dev/null | wc -l | tr -d ' '
}

sample_pattern() {
  local pattern="$1"
  local n="${2:-5}"
  grep -rln "$pattern" src/ 2>/dev/null | head -"$n"
}

section() {
  echo ""
  echo "${BOLD}=== $1 ===${RESET}"
}

subsection() {
  echo "${DIM}--- $1 ---${RESET}"
}

# ─────────────────────────────────────────────────────────────────────────────
# Stage A — Action registry
# ─────────────────────────────────────────────────────────────────────────────
section "Stage A · v3 action registry"

for sym in \
  registerDenialActions \
  registerDenialAction \
  denial.worklist \
  denial.detail \
  denial.notes \
  denial.files \
  denial.transactions; do
  N=$(count_files_with_pattern "$sym")
  if [ "$N" -gt 0 ]; then
    echo "  ${BOLD}$sym${RESET}: $N files"
    sample_pattern "$sym" 3 | sed 's/^/      /'
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# Stage B — v3 components
# ─────────────────────────────────────────────────────────────────────────────
section "Stage B · v3 components (replaced by v4 equivalents)"

# Map of v3 → v4 names for the human
declare -A REPLACEMENTS=(
  [DenialCard]="→ CaseCard (P1.5)"
  [DenialList]="→ WorklistPane (P1.6)"
  [DenialWorkPane]="→ WorkPane (P1.7)"
  [DenialReferencePanel]="→ ReferencePanel (P1.11)"
  [WorkflowStepsList]="→ WorkflowProgressStrip (P1.7)"
  [WorkflowStepsBlock]="→ WorkflowProgressStrip (P1.7)"
  [ThreePaneShell]="(may persist — verify still in use)"
  [DenialFiltersBar]="→ WorklistFiltersBar (P1.6)"
  [DenialFilter]="→ WorklistFilters (P1.6)"
  [DenialActionBar]="→ OutcomeActionBar (P1.8)"
  [DenialTabs]="→ TabStrip (P1.11)"
  [DenialDetailPage]="→ WorkPane + ReferencePanel (P1.7 + P1.11)"
)

for comp in "${!REPLACEMENTS[@]}"; do
  N=$(count_files_with_pattern "$comp")
  if [ "$N" -gt 0 ]; then
    echo "  ${BOLD}$comp${RESET}: $N files  ${DIM}${REPLACEMENTS[$comp]}${RESET}"
    sample_pattern "$comp" 3 | sed 's/^/      /'
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# Stage C — v3 hooks
# ─────────────────────────────────────────────────────────────────────────────
section "Stage C · v3 hooks"

for hook in \
  useDenialQuery \
  useDenialList \
  useDenialDetail \
  useDenialFilters \
  useDenialActions \
  useDenialUrlState \
  useDenialNotes; do
  N=$(count_files_with_pattern "$hook")
  if [ "$N" -gt 0 ]; then
    echo "  ${BOLD}$hook${RESET}: $N files"
    sample_pattern "$hook" 3 | sed 's/^/      /'
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# Stage D — v3 schemas / types
# ─────────────────────────────────────────────────────────────────────────────
section "Stage D · v3 schemas / type aliases"

for sym in \
  DenialSchema \
  DenialCard \
  DenialListResponse \
  DenialDetailResponse \
  DenialClassification \
  DenialStatus \
  WorkflowStep \
  WorkflowStepLabel; do
  N=$(count_files_with_pattern "$sym")
  if [ "$N" -gt 0 ]; then
    echo "  ${BOLD}$sym${RESET}: $N files"
  fi
done

# v3 schema files by likely names
echo ""
subsection "Likely v3 schema files (heuristic — verify before delete)"
for f in \
  src/actions/schemas.ts \
  src/actions/schemas-v3.ts \
  src/actions/denial-schemas.ts \
  src/types/denial.ts \
  src/types/classification.ts; do
  if [ -f "$f" ]; then
    echo "  exists: $f  ($(wc -l <"$f") lines)"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# Stage E — v3 mocks (MSW handlers)
# ─────────────────────────────────────────────────────────────────────────────
section "Stage E · v3 mocks / MSW handlers"

for f in \
  src/mocks/handlers.ts \
  src/mocks/denial-handlers.ts \
  src/mocks/db.ts \
  src/mocks/seed.ts \
  src/mocks/index.ts; do
  if [ -f "$f" ]; then
    # Heuristic: if the file mentions 'case_id' AND 'denial.' or older patterns, it's mixed
    # If it only mentions 'denial.' it's pure v3
    HAS_V4=$(grep -c "case_id\|case\.worklist\|case\.detail" "$f" 2>/dev/null || echo 0)
    HAS_V3=$(grep -c "denial\.worklist\|denial\.detail\|DenialCard" "$f" 2>/dev/null || echo 0)
    LINES=$(wc -l <"$f")
    if [ "$HAS_V3" -gt 0 ] && [ "$HAS_V4" -eq 0 ]; then
      echo "  ${BOLD}$f${RESET}: $LINES lines — pure v3 (safe to delete)"
    elif [ "$HAS_V3" -gt 0 ] && [ "$HAS_V4" -gt 0 ]; then
      echo "  ${BOLD}$f${RESET}: $LINES lines — MIXED v3+v4 (surgical edit needed)"
    elif [ "$HAS_V4" -gt 0 ]; then
      echo "  $f: $LINES lines — v4-only (keep)"
    else
      echo "  $f: $LINES lines — neutral (leave or check usage)"
    fi
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# Stage F — v3 routes
# ─────────────────────────────────────────────────────────────────────────────
section "Stage F · v3 route definitions"

for pattern in \
  '"/denials"' \
  "'/denials'" \
  "path=\"/denials" \
  "path='/denials"; do
  N=$(count_files_with_pattern "$pattern")
  if [ "$N" -gt 0 ]; then
    echo "  ${BOLD}$pattern${RESET}: $N files"
    sample_pattern "$pattern" 3 | sed 's/^/      /'
  fi
done

echo ""
subsection "LegacyRedirect (P1.12) should catch these"
N=$(count_files_with_pattern "LegacyRedirect")
echo "  LegacyRedirect references: $N files"

# ─────────────────────────────────────────────────────────────────────────────
# Stage G — v3 tests (separate from v4 vitest suite)
# ─────────────────────────────────────────────────────────────────────────────
section "Stage G · v3 tests"

# v3 tests were likely in tests/ or src/__tests__ with denial-* names
for d in tests src/__tests__; do
  if [ -d "$d" ]; then
    N=$(find "$d" -name "denial*" -o -name "DenialCard*" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$N" -gt 0 ]; then
      echo "  $d/: $N v3-named test files"
      find "$d" -name "denial*" -o -name "DenialCard*" 2>/dev/null | head -10 | sed 's/^/      /'
    fi
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# Stage H — v3-only dependencies in package.json
# ─────────────────────────────────────────────────────────────────────────────
section "Stage H · npm dependencies"

if [ -f "package.json" ]; then
  echo "Checking for known v3-only deps (deleted/unused in v4 codebase):"
  # These are dep candidates that might have been used by v3-specific code.
  # Confirm with `grep -r '<dep>' src/` before removing.
  for dep in \
    @tanstack/react-table \
    react-dropzone \
    @radix-ui/react-dialog \
    @radix-ui/react-tabs \
    @radix-ui/react-dropdown-menu; do
    if grep -q "\"$dep\"" package.json 2>/dev/null; then
      N=$(grep -rln "from ['\"]$dep" src/ 2>/dev/null | wc -l | tr -d ' ')
      if [ "$N" -eq 0 ]; then
        echo "  ${BOLD}$dep${RESET}: 0 imports in src/ ${DIM}— candidate for removal${RESET}"
      else
        echo "  $dep: $N imports — keep"
      fi
    fi
  done
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
section "Summary"

TOTAL_V3=0
for sym in registerDenialActions DenialCard WorkflowStepsList useDenialQuery DenialSchema; do
  N=$(count_files_with_pattern "$sym")
  TOTAL_V3=$((TOTAL_V3 + N))
done

if [ "$TOTAL_V3" -eq 0 ]; then
  echo "${BOLD}No v3 references found.${RESET} Cleanup may already be complete."
else
  echo "Total v3 anchor references found across (registerDenialActions, DenialCard,"
  echo "WorkflowStepsList, useDenialQuery, DenialSchema): ${BOLD}$TOTAL_V3${RESET} files."
  echo ""
  echo "Next: follow the staged deletion plan in the P1.14 readme. After each"
  echo "stage, re-run this script — counts should monotonically decrease toward 0."
fi
