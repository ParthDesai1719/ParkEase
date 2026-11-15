import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import 'dotenv/config';

function isPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

function resolveMailpitPath(): string | null {
  const customPath = process.env.MAILPIT_PATH?.trim();
  if (customPath) {
    if (fs.existsSync(customPath)) {
      return customPath;
    }
    const relativeCheck = path.resolve(process.cwd(), customPath);
    if (fs.existsSync(relativeCheck)) {
      return relativeCheck;
    }
  }

  // Windows standard installation paths
  if (process.platform === 'win32') {
    const winCandidates = [
      'C:\\Mailpit\\mailpit.exe',
      'C:\\Program Files\\Mailpit\\mailpit.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Mailpit', 'mailpit.exe'),
      path.join(process.env.USERPROFILE || '', 'Mailpit', 'mailpit.exe'),
    ];

    for (const candidate of winCandidates) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } else {
    // Unix standard paths
    const unixCandidates = [
      '/usr/local/bin/mailpit',
      '/usr/bin/mailpit',
      '/opt/homebrew/bin/mailpit',
    ];

    for (const candidate of unixCandidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

async function main(): Promise<void> {
  const smtpPort = Number(process.env.SMTP_PORT) || 1025;

  // Check if an instance of Mailpit / SMTP server is already listening
  const alreadyRunning = await isPortOpen(smtpPort);
  if (alreadyRunning) {
    console.log(`[Mailpit] Port ${smtpPort} is already active. Reusing running Mailpit instance.`);
    console.log('[Mailpit] Web UI: http://localhost:8025 | SMTP: localhost:1025');

    // Keep process alive so concurrently doesn't terminate the session
    const keepAlive = setInterval(() => {}, 1000 * 60 * 60);
    const shutdown = () => {
      clearInterval(keepAlive);
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    return;
  }

  const mailpitExe = resolveMailpitPath();

  if (!mailpitExe) {
    console.warn('----------------------------------------------------------------------');
    console.warn('[Mailpit] NOTICE: Mailpit executable not found.');
    if (process.env.MAILPIT_PATH) {
      console.warn(`[Mailpit] Specified MAILPIT_PATH was not found: "${process.env.MAILPIT_PATH}"`);
    } else {
      console.warn('[Mailpit] MAILPIT_PATH is not configured in server/.env.');
    }
    console.warn('[Mailpit] To inspect real emails locally during development:');
    console.warn(
      '[Mailpit]   1. Download Mailpit from: https://github.com/axllent/mailpit/releases',
    );
    console.warn(
      '[Mailpit]   2. Set MAILPIT_PATH in server/.env (e.g., MAILPIT_PATH=C:\\Mailpit\\mailpit.exe)',
    );
    console.warn(
      '[Mailpit] Continuing development without Mailpit. Backend will use fallback if SMTP is unavailable.',
    );
    console.warn('----------------------------------------------------------------------');

    // Keep process alive so concurrently doesn't terminate the session
    const keepAlive = setInterval(() => {}, 1000 * 60 * 60);
    const shutdown = () => {
      clearInterval(keepAlive);
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    return;
  }

  console.log(`[Mailpit] Starting Mailpit from: ${mailpitExe}`);
  console.log('[Mailpit] Web UI: http://localhost:8025 | SMTP: localhost:1025');

  let child: ChildProcess | null = null;

  try {
    child = spawn(mailpitExe, [], {
      stdio: 'inherit',
      shell: false,
    });
  } catch (err: unknown) {
    console.error('[Mailpit] Failed to spawn Mailpit process:', err);
    return;
  }

  child.on('error', (err) => {
    console.error('[Mailpit] Process error:', err.message);
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.warn(`[Mailpit] Process exited with code ${code}`);
    }
    process.exit(code ?? 0);
  });

  const cleanup = () => {
    if (child && !child.killed) {
      try {
        child.kill('SIGTERM');
      } catch {
        // Ignore kill errors during shutdown
      }
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);
}

main().catch((err) => {
  console.error('[Mailpit] Unexpected error in Mailpit runner:', err);
});
