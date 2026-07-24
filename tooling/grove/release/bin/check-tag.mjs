#!/usr/bin/env node
import { decideTagAction } from '../lib/release.mjs';

const [intendedCommit, tagCommitArg = ''] = process.argv.slice(2);
const decision = decideTagAction({
  intendedCommit,
  tagCommit: tagCommitArg === '' ? null : tagCommitArg,
});
console.log(JSON.stringify(decision));
if (decision.action === 'conflict') process.exitCode = 1;
