// The rendered status view + reason grammar (spec-0002 §D; INV11, INV15).
//
// ONE derivation, four consumers: the check's red/green, the human-facing view,
// dispatch routing, and the reviewer's scoped work order all consume the SAME
// structure. `render()` returns the rendered text alongside that structure
// verbatim — never a divergent re-derivation.
//
// Green is NON-AUTHORIZING: the banner is verbatim and the view never carries
// "approved" / "reviewed" / "safe to merge" (AC6, S8).

// The verbatim non-authorizing banner (INV11, S8) — the plain-strict form is
// byte-identical to pre-amendment (lowercase "a human", mid-sentence after the
// em-dash). The scoped/unrecognized forms start a fresh sentence after the
// jurisdiction clause, so they capitalize ("A human", per the §D/adr-0013
// Decision 5 example).
const GREEN_BANNER =
  'Bookkeeping complete — a human still judges genuineness and merges. This is NOT approval.';
const NON_AUTHORIZING_SENTENCE = 'A human still judges genuineness and merges. This is NOT approval.';

function fmt(v) {
  if (v === null || v === undefined) return '—';
  return v ? 'yes' : 'no';
}

// §D scoped-mode jurisdiction clause (INV22, S21): "scoped mode: N of M changed
// files in jurisdiction". N/M are the §C.2 step-0 iteration set (numerator =
// its in-scope members). Rendered on green and red alike, one line.
function scopedClause(scope) {
  if (!scope || scope.mode !== 'scoped' || !scope.jurisdiction) return null;
  const { inScope, total } = scope.jurisdiction;
  return `scoped mode: ${inScope} of ${total} changed files in jurisdiction`;
}

// §D reason rendering. carrier-unresolved carries a structured payload (§D
// reason table) that the human-facing row spells out.
function renderReason(r) {
  if (r.code === 'carrier-unresolved' && r.payload) {
    const { key, path, provenance } = r.payload;
    return `carrier-unresolved (${key} → ${path}, ${provenance})`;
  }
  return r.token;
}

function renderRow(row) {
  const rev = row.review || '(file)';
  const parts = [
    `${rev} | ${row.subject}`,
    `verdict=${row.latestVerdict == null ? '—' : row.latestVerdict}`,
    `fresh=${fmt(row.fresh)}`,
    `covers=${fmt(row.covers)}`,
    `separated=${fmt(row.separated)}`,
    `reasons: ${row.reasons.map(renderReason).join(', ')}`,
  ];
  return '- ' + parts.join(' | ');
}

// §D round-3 remedy hint (presentation-only): where a red row stems from an
// unclaimed type (INV7's fail-closed full set), name the two cures in context.
function remedyHint(type) {
  const t = type === '__untyped__' ? '(untyped)' : type;
  return (
    `  hint: unclaimed type \`${t}\` — declare it in \`reviewless_types\` ` +
    `(\`charters/review-policy.md\`) if it is not review-bearing, or add a ` +
    `reviewer declaration claiming it.`
  );
}

// §D allowlist remedy hint (presentation-only, adr-0022 D1): a red
// `no-reviewable-upstream` row on allowlist-eligible orientation prose names
// the explicit-allowlist cure. INV14 is upheld — the cure is a human-owned
// per-file allowlist add, not an automatic exemption.
function allowlistHint(path) {
  return (
    `  hint: \`${path}\` is orientation prose with no reviewable upstream — ` +
    `if it is README-class orientation, add it to \`non_behavioral_allowlist\` ` +
    `(\`charters/review-policy.md\`); the allowlist stays explicit and ` +
    `human-owned per file (INV14).`
  );
}

// renderView(derivation) -> the human-facing text summary.
export function renderView(derivation) {
  const { green, rows = [], rejectedRecords = [], scope = null } = derivation;
  const out = [];
  const clause = scopedClause(scope);

  if (green) {
    // Plain strict (no scope descriptor) stays byte-identical (INV19); scoped
    // folds the jurisdiction clause into the verbatim banner (Decision 5).
    out.push(clause ? `Bookkeeping complete — ${clause}. ${NON_AUTHORIZING_SENTENCE}` : GREEN_BANNER);
  } else {
    out.push(
      clause
        ? `Bookkeeping incomplete — ${clause}. The following owed rows are not satisfied:`
        : 'Bookkeeping incomplete — the following owed rows are not satisfied:',
    );
    const hinted = new Set();
    for (const row of rows) {
      if (row.reasons.length === 0) continue;
      out.push(renderRow(row));
      if (row.remedy && !hinted.has(row.subject)) {
        out.push(remedyHint(row.remedy.type));
        hinted.add(row.subject);
      } else if (row.allowlistRemedy && !hinted.has(row.subject)) {
        out.push(allowlistHint(row.allowlistRemedy.path));
        hinted.add(row.subject);
      }
    }
  }

  // Unrecognized-scope note (INV22, W2): named on EVERY run, green or red, so a
  // misparse is visible even on a diff with no out-of-jurisdiction files.
  if (scope && scope.unrecognized) {
    out.push(`scope: '${scope.rawValue}' unrecognized — resolved to strict (fail-closed)`);
  }

  // Append-only visibility (S14): the full record sequence per pair stays
  // readable — a superseded FAIL never disappears behind the latest.
  const seqLines = [];
  for (const row of rows) {
    if (row.recordSequence && row.recordSequence.length > 1) {
      const seq = row.recordSequence.map((s) => s.verdict).join(' → ');
      seqLines.push(`- ${row.review || '(file)'} | ${row.subject}: ${seq}`);
    }
  }
  if (seqLines.length) out.push('', 'Record history (append-only):', ...seqLines);

  // Rejected records are ALWAYS surfaced (§A.4), blocking or not.
  if (rejectedRecords.length) {
    out.push('', 'Rejected records (surfaced integrity findings):');
    for (const rej of rejectedRecords) {
      out.push(`- ${rej.cause}: ${rej.review || '?'} by ${rej.author || '?'} (comment ${rej.id == null ? '?' : rej.id})`);
    }
  }

  return out.join('\n');
}

// render(derivation) -> { text, structured }. The structured output IS the
// derivation, unchanged (INV15: the view and dispatch consume one derivation).
export function render(derivation) {
  return { text: renderView(derivation), structured: derivation };
}
