import type { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from '../auth/password';
import { signAccessToken } from '../auth/jwt';
import { conflictError, userInputError } from '../utils/errors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

  async register(input: RegisterInput) {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      throw userInputError('A valid email address is required.');
    }
    if (input.password.length < 8) {
      throw userInputError('Password must be at least 8 characters long.');
    }
    if (input.displayName.trim().length === 0) {
      throw userInputError('Display name is required.');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw conflictError('An account with this email already exists.');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, displayName: input.displayName.trim() },
    });

    return { token: this.issueToken(user), user };
  }

  async login(input: LoginInput) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw userInputError('Invalid email or password.');
    }

    return { token: this.issueToken(user), user };
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  private issueToken(user: { id: string; email: string; role: 'USER' | 'ADMIN' }) {
    return signAccessToken({ sub: user.id, email: user.email, role: user.role });
  }
}
