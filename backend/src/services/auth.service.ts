import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { AppError } from '@/middleware/error.middleware';
import { Role } from '@prisma/client';

interface RegisterInput {
  businessName: string;
  email: string;
  password: string;
  name: string;
}

interface LoginInput {
  email: string;
  password: string;
  businessId: string;
}

function signAccessToken(payload: { sub: string; businessId: string; role: Role; email: string }): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function signRefreshToken(payload: { sub: string }): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

// Store a SHA-256 hash of the refresh token rather than the raw JWT.
// A stolen DB dump cannot be used to forge valid sessions — the attacker
// would need the raw token, which is only ever sent over the wire once.
function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  // Register a new business with the first admin user
  async register(input: RegisterInput) {
    const passwordHash = await bcrypt.hash(input.password, 12);

    const business = await prisma.business.create({
      data: {
        name: input.businessName,
        settings: { create: {} }, // defaults from schema
        users: {
          create: {
            name: input.name,
            email: input.email,
            password: passwordHash,
            role: 'ADMIN',
          },
        },
      },
      include: { users: true },
    });

    const user = business.users[0];
    const accessToken = signAccessToken({
      sub: user.id,
      businessId: business.id,
      role: user.role,
      email: user.email,
    });
    const refreshToken = signRefreshToken({ sub: user.id });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: hashRefreshToken(refreshToken), // store hash, not raw token
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken, user: { id: user.id, name: user.name, role: user.role }, business };
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findFirst({
      where: { email: input.email, businessId: input.businessId, isActive: true },
    });

    if (!user || !(await bcrypt.compare(input.password, user.password))) {
      throw new AppError(401, 'Invalid credentials');
    }

    const accessToken = signAccessToken({
      sub: user.id,
      businessId: user.businessId,
      role: user.role,
      email: user.email,
    });
    const refreshToken = signRefreshToken({ sub: user.id });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: hashRefreshToken(refreshToken), // store hash, not raw token
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, role: user.role, businessId: user.businessId },
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sub: string };
    } catch {
      throw new AppError(401, 'Invalid refresh token');
    }

    // Look up by hash — raw tokens are never persisted so leaking the DB is harmless
    const stored = await prisma.refreshToken.findUnique({
      where: { token: hashRefreshToken(refreshToken) },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new AppError(401, 'Refresh token expired or revoked');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new AppError(401, 'User not found or deactivated');

    // Rotate refresh token — delete old hash, insert new hash
    await prisma.refreshToken.delete({ where: { token: hashRefreshToken(refreshToken) } });
    const newRefreshToken = signRefreshToken({ sub: user.id });
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: hashRefreshToken(newRefreshToken), // store hash of the new token
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = signAccessToken({
      sub: user.id,
      businessId: user.businessId,
      role: user.role,
      email: user.email,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { token: hashRefreshToken(refreshToken) } });
  }
}
