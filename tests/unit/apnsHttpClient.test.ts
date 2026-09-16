import http2, { type Http2Server, type ServerHttp2Stream, type IncomingHttpHeaders } from 'http2';
import type { AddressInfo } from 'net';
import { generateKeyPairSync } from 'crypto';
import { ApnsHttpClient, type ApnsHttpClientConfig } from '../../src/services/push/apns/httpClient';
import { ApnsJwtProvider } from '../../src/services/push/apns/jwtProvider';
import { ApnsTokenInvalidError, ApnsDeliveryError } from '../../src/services/push/apns/errors';

/**
 * Real APNs delivery can never be verified from this sandbox (no live
 * credentials, no physical path to Apple's push infrastructure - see
 * ADR-008). What these tests verify instead is that ApnsHttpClient speaks
 * the actual APNs HTTP/2 provider-API protocol correctly: request shape,
 * retry/backoff on transient failures, and token-invalidation handling on
 * the specific error reasons Apple documents - against a real local HTTP/2
 * server, not a mocked transport.
 */

interface RecordedRequest {
  path: string;
  headers: IncomingHttpHeaders;
  body: unknown;
}

function startFakeApnsServer(
  handler: (req: RecordedRequest, stream: ServerHttp2Stream) => void,
): Promise<{ server: Http2Server; baseUrl: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http2.createServer();
    server.on('stream', (stream, headers) => {
      let rawBody = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk: string) => {
        rawBody += chunk;
      });
      stream.on('end', () => {
        handler(
          {
            path: String(headers[':path']),
            headers,
            body: rawBody.length > 0 ? JSON.parse(rawBody) : undefined,
          },
          stream,
        );
      });
    });
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        server,
        baseUrl: `http://localhost:${port}`,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}

const FAKE_ES256_KEY = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({
  type: 'sec1',
  format: 'pem',
}) as string;

function makeClient(baseUrl: string, overrides: Partial<ApnsHttpClientConfig> = {}) {
  return new ApnsHttpClient({
    baseUrl,
    bundleId: 'com.example.notifyhub-ios',
    jwtProvider: new ApnsJwtProvider(
      { keyId: 'KEY1', teamId: 'TEAM1', privateKey: FAKE_ES256_KEY },
      () => Date.now(),
    ),
    maxRetries: 2,
    retryBaseDelayMs: 1,
    sleep: () => Promise.resolve(),
    ...overrides,
  });
}

describe('ApnsHttpClient', () => {
  let close: () => Promise<void>;

  afterEach(async () => {
    if (close) await close();
  });

  it('sends the expected request shape and resolves on 200', async () => {
    let recorded: RecordedRequest | undefined;
    const server = await startFakeApnsServer((req, stream) => {
      recorded = req;
      stream.respond({ ':status': 200 });
      stream.end();
    });
    close = server.close;

    const client = makeClient(server.baseUrl);
    await client.send('device-token-abc', { aps: { alert: { title: 'Hi', body: 'Hello' } } });

    expect(recorded!.path).toBe('/3/device/device-token-abc');
    expect(recorded!.headers['apns-topic']).toBe('com.example.notifyhub-ios');
    expect(recorded!.headers.authorization).toMatch(/^bearer /);
    expect(recorded!.headers['apns-push-type']).toBe('alert');
    expect(recorded!.body).toEqual({ aps: { alert: { title: 'Hi', body: 'Hello' } } });
  });

  it('throws ApnsTokenInvalidError on a 410 Unregistered response, without retrying', async () => {
    let attempts = 0;
    const server = await startFakeApnsServer((_req, stream) => {
      attempts += 1;
      stream.respond({ ':status': 410, 'content-type': 'application/json' });
      stream.end(JSON.stringify({ reason: 'Unregistered' }));
    });
    close = server.close;

    const client = makeClient(server.baseUrl);
    await expect(client.send('dead-token', {})).rejects.toBeInstanceOf(ApnsTokenInvalidError);
    expect(attempts).toBe(1);
  });

  it('throws ApnsTokenInvalidError on a 400 BadDeviceToken response', async () => {
    const server = await startFakeApnsServer((_req, stream) => {
      stream.respond({ ':status': 400, 'content-type': 'application/json' });
      stream.end(JSON.stringify({ reason: 'BadDeviceToken' }));
    });
    close = server.close;

    const client = makeClient(server.baseUrl);
    const err = await client.send('malformed-token', {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApnsTokenInvalidError);
    expect((err as ApnsTokenInvalidError).reason).toBe('BadDeviceToken');
  });

  it('retries a 503 with backoff and succeeds once the server recovers', async () => {
    let attempts = 0;
    const server = await startFakeApnsServer((_req, stream) => {
      attempts += 1;
      if (attempts < 3) {
        stream.respond({ ':status': 503, 'content-type': 'application/json' });
        stream.end(JSON.stringify({ reason: 'ServiceUnavailable' }));
        return;
      }
      stream.respond({ ':status': 200 });
      stream.end();
    });
    close = server.close;

    const sleepCalls: number[] = [];
    const client = makeClient(server.baseUrl, {
      sleep: (ms: number) => {
        sleepCalls.push(ms);
        return Promise.resolve();
      },
    });

    await client.send('flaky-token', {});
    expect(attempts).toBe(3);
    expect(sleepCalls).toEqual([1, 2]); // exponential backoff: base * 2^0, base * 2^1
  });

  it('gives up after maxRetries and surfaces ApnsDeliveryError for a persistent 500', async () => {
    let attempts = 0;
    const server = await startFakeApnsServer((_req, stream) => {
      attempts += 1;
      stream.respond({ ':status': 500, 'content-type': 'application/json' });
      stream.end(JSON.stringify({ reason: 'InternalServerError' }));
    });
    close = server.close;

    const client = makeClient(server.baseUrl, { maxRetries: 2 });
    const err = await client.send('token', {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApnsDeliveryError);
    expect((err as ApnsDeliveryError).status).toBe(500);
    expect(attempts).toBe(3); // initial attempt + 2 retries
  });

  it('does not retry a non-retryable 4xx that is not a token-invalid reason', async () => {
    let attempts = 0;
    const server = await startFakeApnsServer((_req, stream) => {
      attempts += 1;
      stream.respond({ ':status': 400, 'content-type': 'application/json' });
      stream.end(JSON.stringify({ reason: 'BadTopic' }));
    });
    close = server.close;

    const client = makeClient(server.baseUrl);
    const err = await client.send('token', {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApnsDeliveryError);
    expect(attempts).toBe(1);
  });
});
