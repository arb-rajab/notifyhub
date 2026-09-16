/**
 * Thrown when APNs reports the device token itself is dead (BadDeviceToken,
 * Unregistered, DeviceTokenNotForTopic). Never retried - the caller should
 * revoke the token instead.
 */
export class ApnsTokenInvalidError extends Error {
  constructor(
    public readonly deviceToken: string,
    public readonly reason: string,
  ) {
    super(`APNs device token invalid (${reason})`);
    this.name = 'ApnsTokenInvalidError';
  }
}

/** Any other non-2xx APNs response, or a transport-level failure. */
export class ApnsDeliveryError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly reason?: string,
  ) {
    super(message);
    this.name = 'ApnsDeliveryError';
  }
}

/** Last 6 chars only - enough to correlate log lines without logging a full device token. */
export function redactDeviceToken(token: string): string {
  return `...${token.slice(-6)}`;
}
