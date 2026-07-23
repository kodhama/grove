// Upstream: spec-0004@v3 canonical-source contract for shared lifecycle operations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { describeOperation } from '../lib/lifecycle.mjs';

test('thin skill adapters can read every operation contract from the shared core', () => {
  for (const operation of ['setup', 'refresh', 'set-profile', 'remove']) {
    const contract = describeOperation(operation);
    assert.equal(contract.operation, operation);
    assert.deepEqual(contract.flow, ['plan', 'disclose', 'confirm-exact-action-ids', 'apply']);
    assert.ok(contract.required_inputs.includes('host'));
    assert.ok(contract.required_inputs.includes('surface'));
    assert.match(contract.cli.plan, new RegExp(`plan ${operation}`));
    assert.match(contract.cli.apply, / apply /);
  }
  assert.throws(() => describeOperation('unknown'), /unknown operation/);
});
