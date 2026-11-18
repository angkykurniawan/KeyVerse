import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';

console.log('[KeyVerse] Menjalankan PHP API (http://127.0.0.1:8000) & React Vite (http://localhost:5173)...');

const phpProc = spawn('php', ['-S', '127.0.0.1:8000', '-t', 'api', 'api/router.php'], {
  stdio: 'inherit',
  shell: isWin,
});

const viteProc = spawn(isWin ? 'npx.cmd' : 'npx', ['vite'], {
  stdio: 'inherit',
  shell: isWin,
});

function shutdown() {
  try { phpProc.kill(); } catch {}
  try { viteProc.kill(); } catch {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

phpProc.on('exit', (code) => {
  if (code && code !== 0) {
    console.error(`[KeyVerse] PHP API berhenti dengan kode ${code}`);
  }
});

viteProc.on('exit', (code) => {
  try { phpProc.kill(); } catch {}
  process.exit(code ?? 0);
});
