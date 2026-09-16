import jwt from 'jsonwebtoken';

// Apple allows reusing a provider auth token for up to 1 hour; refresh a
// little early so a request never races an about-to-expire token.
const TOKEN_TTL_MS = 55 * 60 * 1000;

export interface ApnsSigningConfig {
  keyId: string;
  teamId: string;
  privateKey: string;
}

/**
 * Generates and caches the ES256 JWT APNs' provider API requires as a
 * bearer token (RFC 8032 §"Establishing a Token-Based Connection to APNs").
 * One instance is meant to be shared across requests, not created per-send.
 */
export class ApnsJwtProvider {
  private cachedToken: string | null = null;
  private cachedAtMs = 0;

  constructor(
    private readonly config: ApnsSigningConfig,
    private readonly now: () => number = Date.now,
  ) {}

  getToken(): string {
    const currentTimeMs = this.now();
    if (this.cachedToken && currentTimeMs - this.cachedAtMs < TOKEN_TTL_MS) {
      return this.cachedToken;
    }
    this.cachedToken = jwt.sign(
      { iss: this.config.teamId, iat: Math.floor(currentTimeMs / 1000) },
      this.config.privateKey,
      { algorithm: 'ES256', keyid: this.config.keyId },
    );
    this.cachedAtMs = currentTimeMs;
    return this.cachedToken;
  }
}
