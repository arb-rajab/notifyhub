export interface ApnsEnvConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKey: string;
  baseUrl: string;
}

/**
 * Reads live APNs credentials from the environment, if present. Returns
 * null - never throws - when any are missing, which is the expected state
 * everywhere except an operator's own signing machine: live APNs
 * credentials must never sit in this repo or in a CI-readable/automated
 * environment (see ADR-008). ApnsPushChannel treats a null config as "APNs
 * delivery is disabled" and no-ops rather than failing notification
 * publishing.
 */
export function loadApnsConfigFromEnv(
  source: NodeJS.ProcessEnv = process.env,
): ApnsEnvConfig | null {
  const {
    APNS_KEY_ID,
    APNS_TEAM_ID,
    APNS_BUNDLE_ID,
    APNS_PRIVATE_KEY,
    APNS_ENVIRONMENT,
    APNS_BASE_URL,
  } = source;

  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_BUNDLE_ID || !APNS_PRIVATE_KEY) {
    return null;
  }

  const defaultBaseUrl =
    APNS_ENVIRONMENT === 'production'
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com';

  return {
    keyId: APNS_KEY_ID,
    teamId: APNS_TEAM_ID,
    bundleId: APNS_BUNDLE_ID,
    // .env files and most CI secret stores can't hold real newlines in a
    // single-line value, so a literal "\n" is the conventional escape for a
    // PEM-encoded key - unescape it back to a real multi-line PEM.
    privateKey: APNS_PRIVATE_KEY.replace(/\\n/g, '\n'),
    baseUrl: APNS_BASE_URL ?? defaultBaseUrl,
  };
}
