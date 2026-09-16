import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string') return null;
    const { sub, email, role } = decoded as jwt.JwtPayload;
    if (
      typeof sub !== 'string' ||
      typeof email !== 'string' ||
      (role !== 'USER' && role !== 'ADMIN')
    ) {
      return null;
    }
    return { sub, email, role };
  } catch {
    return null;
  }
}
