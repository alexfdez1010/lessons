import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('./daily-lesson.sh', import.meta.url), 'utf8');
const helper = script.slice(script.indexOf('deploy_and_verify() {'), script.indexOf('# Assert the tree is clean;'));

/** Execute the real deployment helper with all external operations replaced. */
function runDeployment({ buildFails = false, uploadFails = false, canonical = true, rebased = false } = {}) {
  return spawnSync('bash', ['-c', `
    set -euo pipefail
    VALIDATION_TIMEOUT=1 DEPLOY_TIMEOUT=1
    VALIDATED_HEAD=${rebased ? 'before-rebase' : 'current-head'}
    log() { echo "$*"; }
    fail() { echo "FAILED: $*"; exit 1; }
    assert_clean_tree() { :; }
    git() { echo current-head; }
    run_validation() { echo revalidate; }
    sleep() { :; }
    curl() { echo '${canonical ? '<link rel="canonical" href="https://finance-lessons.alejandrofernandezcamello.me/" />' : '<link rel="canonical" href="https://old.example/" />'}'; }
    run_in_group() {
      echo "operation:$2"
      if [ "$2" = deploy-build ] && ${buildFails}; then return 1; fi
      if [ "$2" = cloudflare-deploy ] && ${uploadFails}; then return 1; fi
    }
    ${helper}
    deploy_and_verify
  `], { encoding: 'utf8' });
}

describe('daily lesson Cloudflare publication', () => {
  test('rebuilds before uploading and verifies the production canonical', () => {
    const result = runDeployment();
    expect(result.status).toBe(0);
    expect(result.stdout.indexOf('operation:deploy-build')).toBeLessThan(result.stdout.indexOf('operation:cloudflare-deploy'));
    expect(result.stdout).toContain('Cloudflare production verified');
  });

  test('a failed build cannot upload', () => {
    const result = runDeployment({ buildFails: true });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('operation:cloudflare-deploy');
  });

  test('upload retries stop after three failures', () => {
    const result = runDeployment({ uploadFails: true });
    expect(result.status).toBe(1);
    expect(result.stdout.match(/operation:cloudflare-deploy/g)).toHaveLength(3);
    expect(result.stdout).not.toContain('production verified');
  });

  test('a response with the old canonical cannot pass verification', () => {
    const result = runDeployment({ canonical: false });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('did not return the expected canonical URL');
  });

  test('a rebased HEAD is revalidated before rebuilding and uploading', () => {
    const result = runDeployment({ rebased: true });
    expect(result.status).toBe(0);
    expect(result.stdout.indexOf('revalidate')).toBeLessThan(result.stdout.indexOf('operation:deploy-build'));
  });

  test('both normal and startup recovery paths deploy after pushing', () => {
    expect(script.match(/ensure_pushed_and_verified\n\s*deploy_and_verify\n\s*assert_clean_tree/g)).toHaveLength(2);
  });
});
