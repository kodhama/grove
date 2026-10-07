# smol-toml, vendored

The TOML reader `routing-table.mjs` uses, copied unchanged so the receipt
check runs from a plugin install with no `npm install`.

- **What:** smol-toml 1.8.0, its npm build: every ES module in `dist/` with
  its type declarations. The CommonJS `index.cjs` is left out.
- **From:** `https://registry.npmjs.org/smol-toml/-/smol-toml-1.8.0.tgz`,
  integrity
  `sha512-kCZr2V3ch9i00x8zXRhjUNVcjG9ijES5dDudkXvUVCT5QlJNQWElSJdZqyPemffHoLNUYwOcou0Fy+ojN0uHSQ==`.
- **Licence:** BSD-3-Clause, in `LICENSE` beside this file.
- **To update:** copy `dist/*.js`, `dist/*.d.ts` and `LICENSE` from the new
  version's tarball over these files, then update this note and the adoption
  record in `docs/decisions/`.
