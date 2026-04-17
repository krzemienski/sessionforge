/**
 * Claude Agent SDK `query()` spawns the `claude` CLI as a subprocess.
 * When the parent process is itself a Claude Code session, the CLAUDECODE
 * env var is set and the spawned CLI rejects as a "nested session".
 *
 * This helper deletes CLAUDECODE once per Node process before any SDK call,
 * so every code path can call ensureCliAuth() defensively without paying for
 * repeat deletes or scattering the workaround across 15+ files.
 */
let cleared = false;

export function ensureCliAuth(): void {
  if (cleared) return;
  delete process.env.CLAUDECODE;
  cleared = true;
}
