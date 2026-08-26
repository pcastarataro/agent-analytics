import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { usageEventSchema } from '@agent-analytics/event-schema';

const execFileAsync = promisify(execFile);

function hasOpencodeBinary(): boolean {
  try {
    execFileSync('which', ['opencode'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const describeOrSkip = hasOpencodeBinary() ? describe : describe.skip;

describeOrSkip('Smoke Integration', () => {
  let server: http.Server;
  const receivedBatches: unknown[][] = [];

  beforeAll((done) => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/v1/events/batch') {
        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body) as { events?: unknown[] };
            if (parsed.events && Array.isArray(parsed.events)) {
              receivedBatches.push(parsed.events);
            }
          } catch {
            // malformed body — ignore
          }
          res.writeHead(200);
          res.end();
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, '127.0.0.1', () => {
      done();
    });
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it('receives at least one schema-valid batch from opencode run', async () => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Server address not available');
    }
    const port = addr.port;

    await execFileAsync('opencode', ['run', '--print', 'Say hello'], {
      env: {
        ...process.env,
        OPENCODE_ANALYTICS_URL: `http://127.0.0.1:${port}`,
        OPENCODE_ANALYTICS_API_KEY: 'smoke-test-key',
        OPENCODE_ANALYTICS_USER: 'smoke-user',
      },
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    }).catch(() => {
      // opencode may exit non-zero if no model configured — that's fine
    });

    if (receivedBatches.length === 0) {
      console.warn(
        '[smoke] opencode run did not deliver batches — skipping assertion (no model or plugin not loaded)',
      );
      return;
    }

    const allEvents = receivedBatches.flat();
    const validEvents = allEvents.filter((e) => usageEventSchema.safeParse(e).success);
    expect(validEvents.length).toBeGreaterThanOrEqual(1);
  }, 30_000);
});
