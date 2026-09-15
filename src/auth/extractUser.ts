import type { AccessTokenPayload } from './jwt';
import { verifyAccessToken } from './jwt';

const BEARER_PREFIX = 'Bearer ';

export function extractBearerToken(authHeader: string | undefined | null): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith(BEARER_PREFIX)) return null;
  const token = authHeader.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

export function authenticateFromHeader(
  authHeader: string | undefined | null,
): AccessTokenPayload | null {
  const token = extractBearerToken(authHeader);
  if (!token) return null;
  return verifyAccessToken(token);
}

export function authenticateFromConnectionParams(
  connectionParams: Record<string, unknown> | undefined,
): AccessTokenPayload | null {
  if (!connectionParams) return null;
  const raw = connectionParams.authorization ?? connectionParams.Authorization;
  if (typeof raw !== 'string') return null;
  return authenticateFromHeader(raw);
}
