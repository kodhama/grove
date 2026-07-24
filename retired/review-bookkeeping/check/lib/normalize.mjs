// Path normalization (spec-0002 Terms).
// Repo-relative, /-separated, no leading ./, no .. segments. A path that
// cannot be normalized to this form matches nothing (returns null) —
// fail-closed by non-match.

export function normalizePath(p) {
  if (p == null) return null;
  let s = String(p);
  if (s === '') return null;
  // strip leading ./ (repeatedly)
  s = s.replace(/^(\.\/)+/, '');
  // collapse duplicate separators
  s = s.replace(/\/{2,}/g, '/');
  if (s === '') return null;
  // absolute paths are not repo-relative
  if (s.startsWith('/')) return null;
  // any .. segment => matches nothing
  const segments = s.split('/');
  if (segments.some((seg) => seg === '..')) return null;
  return s;
}
