import http2 from 'http2';
import { logger } from '../../../utils/logger';
import { ApnsTokenInvalidError, ApnsDeliveryError, redactDeviceToken } from './errors';
import type { ApnsJwtProvider } from './jwtProvider';

export interface ApnsSendOptions {
  pushType?: 'alert' | 'background';
  priority?: 5 | 10;
  expiration?: number;
}

export interface ApnsHttpClientConfig {
  /** Authority to connect to - e.g. https://api.sandbox.push.apple.com, or a local http:// test server. */
  baseUrl: string;
  bundleId: string;
  jwtProvider: ApnsJwtProvider;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  /** Injectable so tests don't burn real wall-clock time on retry backoff. */
  sleep?: (ms: number) => Promise<void>;
}

// Reasons APNs returns when the device token itself is dead - never worth
// retrying, the caller should revoke the token instead.
const INVALID_TOKEN_REASONS = new Set(['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic']);

// Transient failures worth retrying with backoff; anything else (bad topic,
// bad JWT, payload too large, ...) is a bug in this client or its config,
// not something a retry fixes.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A minimal APNs provider-API client over raw HTTP/2, built specifically so
 * it can be pointed at a plaintext local http2 server in tests (protocol-
 * level verification of payload shape, retry/backoff, and token
 * invalidation) as well as Apple's real TLS endpoints in production - see
 * ADR-008 for why that's the accepted proof instead of live delivery.
 */
export class ApnsHttpClient {
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly config: ApnsHttpClientConfig) {
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? 200;
    this.sleep = config.sleep ?? defaultSleep;
  }

  async send(deviceToken: string, payload: unknown, options: ApnsSendOptions = {}): Promise<void> {
    let attempt = 0;
    for (;;) {
      try {
        await this.sendOnce(deviceToken, payload, options);
        return;
      } catch (err) {
        if (err instanceof ApnsTokenInvalidError) throw err;

        const retryable =
          !(err instanceof ApnsDeliveryError) ||
          err.status === undefined ||
          RETRYABLE_STATUSES.has(err.status);
        attempt += 1;
        if (!retryable || attempt > this.maxRetries) throw err;

        const delayMs = this.retryBaseDelayMs * 2 ** (attempt - 1);
        logger.warn(
          {
            err,
            attempt,
            maxRetries: this.maxRetries,
            deviceToken: redactDeviceToken(deviceToken),
          },
          'apns delivery attempt failed, retrying',
        );
        await this.sleep(delayMs);
      }
    }
  }

  private sendOnce(deviceToken: string, payload: unknown, options: ApnsSendOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const session = http2.connect(this.config.baseUrl);
      let settled = false;
      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        session.close();
        reject(err);
      };

      session.on('error', (err) =>
        fail(new ApnsDeliveryError(`APNs session error: ${err.message}`)),
      );

      const body = Buffer.from(JSON.stringify(payload));
      const req = session.request({
        ':method': 'POST',
        ':path': `/3/device/${deviceToken}`,
        authorization: `bearer ${this.config.jwtProvider.getToken()}`,
        'apns-topic': this.config.bundleId,
        'apns-push-type': options.pushType ?? 'alert',
        'apns-priority': String(options.priority ?? 10),
        ...(options.expiration !== undefined
          ? { 'apns-expiration': String(options.expiration) }
          : {}),
        'content-type': 'application/json',
        'content-length': String(body.length),
      });

      let responseStatus = 0;
      let responseBody = '';

      req.on('response', (headers) => {
        responseStatus = Number(headers[':status']);
      });
      req.setEncoding('utf8');
      req.on('data', (chunk: string) => {
        responseBody += chunk;
      });
      req.on('end', () => {
        if (settled) return;
        settled = true;
        session.close();

        if (responseStatus === 200) {
          resolve();
          return;
        }

        let reason = 'Unknown';
        try {
          const parsed = JSON.parse(responseBody) as { reason?: string };
          if (parsed.reason) reason = parsed.reason;
        } catch {
          // APNs error bodies are always JSON when present; an unparsable
          // body just means we fall back to the generic "Unknown" reason.
        }

        if (INVALID_TOKEN_REASONS.has(reason)) {
          reject(new ApnsTokenInvalidError(deviceToken, reason));
          return;
        }
        reject(
          new ApnsDeliveryError(
            `APNs responded ${responseStatus} (${reason})`,
            responseStatus,
            reason,
          ),
        );
      });
      req.on('error', (err) => fail(new ApnsDeliveryError(`APNs request error: ${err.message}`)));

      req.write(body);
      req.end();
    });
  }
}
