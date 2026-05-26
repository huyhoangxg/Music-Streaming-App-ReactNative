import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { AuthRequest } from '../middlewares/authMiddleware';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import {
  createVerificationCode,
  getVerificationExpiry,
  hashVerificationCode,
  isValidEmail,
  normalizeEmail,
  normalizeUsername,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../services/emailVerificationService';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_tam_thoi';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';
const GOOGLE_DEVICE_CLIENT_ID = process.env.GOOGLE_DEVICE_CLIENT_ID || '';
const GOOGLE_DEVICE_CLIENT_SECRET = process.env.GOOGLE_DEVICE_CLIENT_SECRET || '';
const GOOGLE_DEVICE_SCOPE = 'openid email profile';
const APP_DEEP_LINK_SCHEME = process.env.APP_DEEP_LINK_SCHEME || 'soundwave';

function getGoogleOAuth2Client() {
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}
const DEFAULT_USER_AVATAR_URL =
  'https://upload.wikimedia.org/wikipedia/commons/f/f7/Facebook_default_male_avatar.gif';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const GOOGLE_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;
const RESEND_WINDOW_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const loginAttempts = new Map<string, RateLimitBucket>();
const googleLoginAttempts = new Map<string, RateLimitBucket>();
const verifyAttempts = new Map<string, RateLimitBucket>();
const resendAttempts = new Map<string, RateLimitBucket>();
const passwordResetRequestAttempts = new Map<string, RateLimitBucket>();
const passwordResetAttempts = new Map<string, RateLimitBucket>();

type GoogleProfile = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

type GoogleDeviceLoginSession = {
  deviceCode: string;
  expiresAt: number;
  intervalSeconds: number;
  nextPollAt: number;
};

const googleDeviceLoginSessions = new Map<string, GoogleDeviceLoginSession>();

function consumeRateLimit(
  store: Map<string, RateLimitBucket>,
  key: string,
  limit: number,
  windowMs: number,
) {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function clearRateLimit(store: Map<string, RateLimitBucket>, key: string) {
  store.delete(key);
}

function createAuthToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

function toSafeUser(user: {
  id: string;
  username: string;
  email: string;
  fullName: string | null;
  avatarUrl?: string | null;
  followerCount?: number;
  followingCount?: number;
  trackCount?: number;
  emailVerified?: boolean;
  createdAt?: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl || DEFAULT_USER_AVATAR_URL,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
    trackCount: user.trackCount,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function sanitizeUsernameBase(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);

  return normalized || 'google_user';
}

async function createUniqueUsername(email: string, name?: string) {
  const emailPrefix = email.split('@')[0] || '';
  const base = sanitizeUsernameBase(name || emailPrefix);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = attempt === 0 ? '' : `_${crypto.randomInt(1000, 9999)}`;
    const candidate = `${base}${suffix}`.slice(0, 36);
    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `google_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Google rejected access token: ${response.status}`);
  }

  return (await response.json()) as GoogleProfile;
}

async function findOrCreateGoogleUserFromAccessToken(accessToken: string) {
  const profile = await fetchGoogleProfile(accessToken);
  const email = normalizeEmail(profile.email);

  if (!profile.sub || !email || !profile.email_verified || !isValidEmail(email)) {
    throw new Error('Google account email could not be verified.');
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    if (!user.emailVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          emailVerificationCodeHash: null,
          emailVerificationExpiresAt: null,
          emailVerificationLastSentAt: null,
        },
      });
    }

    await prisma.pendingRegistration.deleteMany({ where: { email } });
    return user;
  }

  const pendingRegistration = await prisma.pendingRegistration.findUnique({
    where: { email },
  });

  if (pendingRegistration) {
    const usernameTaken = await prisma.user.findUnique({
      where: { username: pendingRegistration.username },
      select: { id: true },
    });
    const username = usernameTaken
      ? await createUniqueUsername(email, profile.name || pendingRegistration.username)
      : pendingRegistration.username;

    return prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          username,
          email,
          passwordHash: pendingRegistration.passwordHash,
          fullName: pendingRegistration.fullName || profile.name?.trim() || username,
          avatarUrl: profile.picture || DEFAULT_USER_AVATAR_URL,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      await tx.pendingRegistration.delete({
        where: { id: pendingRegistration.id },
      });

      return createdUser;
    });
  }

  const username = await createUniqueUsername(email, profile.name);
  const randomPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

  return prisma.user.create({
    data: {
      username,
      email,
      passwordHash: randomPasswordHash,
      fullName: profile.name?.trim() || username,
      avatarUrl: profile.picture || DEFAULT_USER_AVATAR_URL,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
}

function createVerificationState(email: string) {
  const code = createVerificationCode();
  const codeHash = hashVerificationCode(email, code);
  const expiresAt = getVerificationExpiry();
  const sentAt = new Date();

  return { code, codeHash, expiresAt, sentAt };
}

async function deleteExpiredPendingRegistrations() {
  await prisma.pendingRegistration.deleteMany({
    where: {
      verificationExpiresAt: {
        lt: new Date(),
      },
    },
  });
}

async function issueUserVerificationCode(user: { id: string; email: string; username: string }) {
  const { code, codeHash, expiresAt, sentAt } = createVerificationState(user.email);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationCodeHash: codeHash,
      emailVerificationExpiresAt: expiresAt,
      emailVerificationLastSentAt: sentAt,
    },
  });

  return sendVerificationEmail({
    email: user.email,
    username: user.username,
    code,
  });
}

async function issuePendingRegistrationCode(pending: {
  id: string;
  email: string;
  username: string;
}) {
  const { code, codeHash, expiresAt, sentAt } = createVerificationState(pending.email);

  await prisma.pendingRegistration.update({
    where: { id: pending.id },
    data: {
      verificationCodeHash: codeHash,
      verificationExpiresAt: expiresAt,
      verificationLastSentAt: sentAt,
    },
  });

  return sendVerificationEmail({
    email: pending.email,
    username: pending.username,
    code,
  });
}

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const username = normalizeUsername(req.body.username);
    const email = normalizeEmail(req.body.email);
    const fullName = typeof req.body.fullName === 'string' ? req.body.fullName.trim() : undefined;
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!username || !email || !password) {
      res.status(400).json({ message: 'Username, email, and password are required.' });
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ message: 'Please enter a valid email address.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters.' });
      return;
    }

    await deleteExpiredPendingRegistrations();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
      select: { email: true, username: true },
    });

    if (existingUser?.email === email) {
      res.status(409).json({ message: 'This email is already registered.' });
      return;
    }

    if (existingUser?.username === username) {
      res.status(409).json({ message: 'This username is already taken.' });
      return;
    }

    const pendingWithUsername = await prisma.pendingRegistration.findUnique({
      where: { username },
      select: { email: true },
    });

    if (pendingWithUsername && pendingWithUsername.email !== email) {
      res.status(409).json({
        message: 'This username is waiting for email verification. Please choose another username.',
      });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const { code, codeHash, expiresAt, sentAt } = createVerificationState(email);

    await prisma.pendingRegistration.upsert({
      where: { email },
      create: {
        username,
        email,
        passwordHash,
        fullName,
        verificationCodeHash: codeHash,
        verificationExpiresAt: expiresAt,
        verificationLastSentAt: sentAt,
      },
      update: {
        username,
        passwordHash,
        fullName,
        verificationCodeHash: codeHash,
        verificationExpiresAt: expiresAt,
        verificationLastSentAt: sentAt,
      },
    });

    try {
      const delivery = await sendVerificationEmail({
        email,
        username,
        code,
      });

      res.status(201).json({
        message: 'Registration is pending. Please verify your email.',
        requiresEmailVerification: true,
        email,
        emailDeliveryFailed: false,
        verificationDeliveryMode: delivery.deliveryMode,
      });
      return;
    } catch (emailError) {
      console.error('Verification email delivery failed:', emailError);
      await prisma.pendingRegistration.deleteMany({ where: { email } });
      res.status(503).json({
        message:
          'Could not send the verification email. Please configure the email provider and try again.',
        emailDeliveryFailed: true,
      });
      return;
    }
  } catch (error) {
    console.error('Register error:', error);
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ message: 'Email or username is already registered.' });
      return;
    }
    res.status(500).json({ message: 'Server error while registering.' });
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';

    if (!email || !code) {
      res.status(400).json({ message: 'Email and verification code are required.' });
      return;
    }

    const attemptKey = `${email}:${req.ip || 'unknown'}`;
    const rateLimit = consumeRateLimit(verifyAttempts, attemptKey, 5, VERIFY_WINDOW_MS);
    if (!rateLimit.allowed) {
      res.status(429).json({
        message: `Too many verification attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
      });
      return;
    }

    const pendingRegistration = await prisma.pendingRegistration.findUnique({
      where: { email },
    });
    const incomingHash = hashVerificationCode(email, code);

    if (pendingRegistration) {
      if (pendingRegistration.verificationExpiresAt.getTime() < Date.now()) {
        res.status(400).json({ message: 'Verification code expired. Please request a new code.' });
        return;
      }

      if (incomingHash !== pendingRegistration.verificationCodeHash) {
        res.status(400).json({ message: 'Invalid verification code.' });
        return;
      }

      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email }, { username: pendingRegistration.username }],
        },
        select: { email: true, username: true },
      });

      if (existingUser?.email === email) {
        res.status(409).json({ message: 'This email is already registered.' });
        return;
      }

      if (existingUser?.username === pendingRegistration.username) {
        res.status(409).json({ message: 'This username is already taken.' });
        return;
      }

      const verifiedUser = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            username: pendingRegistration.username,
            email: pendingRegistration.email,
            passwordHash: pendingRegistration.passwordHash,
            fullName: pendingRegistration.fullName,
            avatarUrl: DEFAULT_USER_AVATAR_URL,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            emailVerificationCodeHash: null,
            emailVerificationExpiresAt: null,
            emailVerificationLastSentAt: null,
          },
        });

        await tx.pendingRegistration.delete({
          where: { id: pendingRegistration.id },
        });

        return createdUser;
      });

      const token = createAuthToken(verifiedUser.id);
      clearRateLimit(verifyAttempts, attemptKey);
      res.status(200).json({
        message: 'Email verified successfully.',
        token,
        user: toSafeUser(verifiedUser),
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(400).json({ message: 'Invalid verification code.' });
      return;
    }

    if (user.emailVerified) {
      const token = createAuthToken(user.id);
      res.status(200).json({
        message: 'Email is already verified.',
        token,
        user: toSafeUser(user),
      });
      return;
    }

    if (
      !user.emailVerificationCodeHash ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      res.status(400).json({ message: 'Verification code expired. Please request a new code.' });
      return;
    }

    if (incomingHash !== user.emailVerificationCodeHash) {
      res.status(400).json({ message: 'Invalid verification code.' });
      return;
    }

    const verifiedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationCodeHash: null,
        emailVerificationExpiresAt: null,
        emailVerificationLastSentAt: null,
      },
    });

    const token = createAuthToken(verifiedUser.id);
    clearRateLimit(verifyAttempts, attemptKey);
    res.status(200).json({
      message: 'Email verified successfully.',
      token,
      user: toSafeUser(verifiedUser),
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ message: 'Server error while verifying email.' });
  }
};

export const resendVerificationCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      res.status(400).json({ message: 'Email is required.' });
      return;
    }

    const attemptKey = `${email}:${req.ip || 'unknown'}`;
    const rateLimit = consumeRateLimit(resendAttempts, attemptKey, 3, RESEND_WINDOW_MS);
    if (!rateLimit.allowed) {
      res.status(429).json({
        message: `Too many resend requests. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
      });
      return;
    }

    const pendingRegistration = await prisma.pendingRegistration.findUnique({
      where: { email },
    });

    if (pendingRegistration) {
      if (
        pendingRegistration.verificationLastSentAt &&
        Date.now() - pendingRegistration.verificationLastSentAt.getTime() < RESEND_COOLDOWN_MS
      ) {
        const retryAfterSeconds = Math.ceil(
          (RESEND_COOLDOWN_MS -
            (Date.now() - pendingRegistration.verificationLastSentAt.getTime())) /
            1000,
        );
        res.status(429).json({
          message: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
        });
        return;
      }

      const delivery = await issuePendingRegistrationCode(pendingRegistration);
      res.status(200).json({
        message: 'A new verification code has been sent.',
        verificationDeliveryMode: delivery.deliveryMode,
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(200).json({ message: 'If the account exists, a new code has been sent.' });
      return;
    }

    if (user.emailVerified) {
      res.status(200).json({ message: 'This email is already verified.' });
      return;
    }

    if (
      user.emailVerificationLastSentAt &&
      Date.now() - user.emailVerificationLastSentAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      const retryAfterSeconds = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - user.emailVerificationLastSentAt.getTime())) / 1000,
      );
      res.status(429).json({
        message: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
      });
      return;
    }

    const delivery = await issueUserVerificationCode(user);
    res.status(200).json({
      message: 'A new verification code has been sent.',
      verificationDeliveryMode: delivery.deliveryMode,
    });
  } catch (error) {
    console.error('Resend verification code error:', error);
    res.status(500).json({ message: 'Could not send verification code right now.' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required.' });
      return;
    }

    const attemptKey = `${email}:${req.ip || 'unknown'}`;
    const rateLimit = consumeRateLimit(loginAttempts, attemptKey, 10, LOGIN_WINDOW_MS);
    if (!rateLimit.allowed) {
      res.status(429).json({
        message: `Too many login attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const pendingRegistration = await prisma.pendingRegistration.findUnique({
        where: { email },
        select: { email: true },
      });

      if (pendingRegistration) {
        res.status(403).json({
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email before logging in.',
          email: pendingRegistration.email,
        });
        return;
      }

      res.status(401).json({ message: 'Email or password is incorrect.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Email or password is incorrect.' });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in.',
        email: user.email,
      });
      return;
    }

    const token = createAuthToken(user.id);
    clearRateLimit(loginAttempts, attemptKey);

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: toSafeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error while logging in.' });
  }
};

export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const accessToken = typeof req.body.accessToken === 'string' ? req.body.accessToken : '';
    if (!accessToken) {
      res.status(400).json({ message: 'Google access token is required.' });
      return;
    }

    const attemptKey = `google:${req.ip || 'unknown'}`;
    const rateLimit = consumeRateLimit(
      googleLoginAttempts,
      attemptKey,
      20,
      GOOGLE_LOGIN_WINDOW_MS,
    );
    if (!rateLimit.allowed) {
      res.status(429).json({
        message: `Too many Google login attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
      });
      return;
    }

    const user = await findOrCreateGoogleUserFromAccessToken(accessToken);
    const token = createAuthToken(user.id);
    clearRateLimit(googleLoginAttempts, attemptKey);

    res.status(200).json({
      message: 'Google login successful.',
      token,
      user: toSafeUser(user),
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(401).json({ message: 'Google login failed. Please try again.' });
  }
};

export const startGoogleDeviceLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!GOOGLE_DEVICE_CLIENT_ID || !GOOGLE_DEVICE_CLIENT_SECRET) {
      res.status(503).json({
        message:
          'Google device login is not configured. Set GOOGLE_DEVICE_CLIENT_ID and GOOGLE_DEVICE_CLIENT_SECRET in backend .env.',
      });
      return;
    }

    const attemptKey = `google-device:${req.ip || 'unknown'}`;
    const rateLimit = consumeRateLimit(
      googleLoginAttempts,
      attemptKey,
      20,
      GOOGLE_LOGIN_WINDOW_MS,
    );
    if (!rateLimit.allowed) {
      res.status(429).json({
        message: `Too many Google login attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
      });
      return;
    }

    const body = new URLSearchParams({
      client_id: GOOGLE_DEVICE_CLIENT_ID,
      scope: GOOGLE_DEVICE_SCOPE,
    });

    const response = await fetch('https://oauth2.googleapis.com/device/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await response.json().catch(() => ({}))) as {
      device_code?: string;
      user_code?: string;
      verification_url?: string;
      expires_in?: number;
      interval?: number;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !data.device_code || !data.user_code || !data.verification_url) {
      console.error('Google device code error:', data);
      res.status(502).json({
        message: data.error_description || data.error || 'Could not start Google device login.',
      });
      return;
    }

    const sessionId = crypto.randomUUID();
    const expiresIn = data.expires_in || 1800;
    const intervalSeconds = Math.max(3, data.interval || 5);

    googleDeviceLoginSessions.set(sessionId, {
      deviceCode: data.device_code,
      expiresAt: Date.now() + expiresIn * 1000,
      intervalSeconds,
      nextPollAt: 0,
    });

    res.status(200).json({
      sessionId,
      userCode: data.user_code,
      verificationUrl: data.verification_url,
      expiresIn,
      interval: intervalSeconds,
    });
  } catch (error) {
    console.error('Start Google device login error:', error);
    res.status(500).json({ message: 'Could not start Google login right now.' });
  }
};

export const pollGoogleDeviceLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = typeof req.body.sessionId === 'string' ? req.body.sessionId : '';
    if (!sessionId) {
      res.status(400).json({ message: 'Google login session is required.' });
      return;
    }

    const session = googleDeviceLoginSessions.get(sessionId);
    if (!session) {
      res.status(400).json({ message: 'Google login session not found or expired.' });
      return;
    }

    const now = Date.now();
    if (session.expiresAt <= now) {
      googleDeviceLoginSessions.delete(sessionId);
      res.status(400).json({ message: 'Google login code expired. Please try again.' });
      return;
    }

    if (session.nextPollAt > now) {
      res.status(202).json({
        status: 'pending',
        retryAfterSeconds: Math.ceil((session.nextPollAt - now) / 1000),
      });
      return;
    }

    session.nextPollAt = now + session.intervalSeconds * 1000;

    const body = new URLSearchParams({
      client_id: GOOGLE_DEVICE_CLIENT_ID,
      client_secret: GOOGLE_DEVICE_CLIENT_SECRET,
      device_code: session.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (response.ok && data.access_token) {
      const user = await findOrCreateGoogleUserFromAccessToken(data.access_token);
      const token = createAuthToken(user.id);
      googleDeviceLoginSessions.delete(sessionId);

      res.status(200).json({
        status: 'success',
        token,
        user: toSafeUser(user),
      });
      return;
    }

    if (data.error === 'authorization_pending') {
      res.status(202).json({
        status: 'pending',
        retryAfterSeconds: session.intervalSeconds,
      });
      return;
    }

    if (data.error === 'slow_down') {
      session.intervalSeconds += 5;
      session.nextPollAt = Date.now() + session.intervalSeconds * 1000;
      res.status(202).json({
        status: 'pending',
        retryAfterSeconds: session.intervalSeconds,
      });
      return;
    }

    if (data.error === 'access_denied') {
      googleDeviceLoginSessions.delete(sessionId);
      res.status(403).json({ message: 'Google login was denied.' });
      return;
    }

    if (data.error === 'expired_token' || data.error === 'invalid_grant') {
      googleDeviceLoginSessions.delete(sessionId);
      res.status(400).json({ message: 'Google login code expired. Please try again.' });
      return;
    }

    console.error('Google device poll error:', data);
    res.status(502).json({
      message: data.error_description || data.error || 'Could not finish Google login.',
    });
  } catch (error) {
    console.error('Poll Google device login error:', error);
    res.status(500).json({ message: 'Could not finish Google login right now.' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { oldPassword, newPassword } = req.body;

    if (!userId) {
      res.status(401).json({ message: 'Authentication is required.' });
      return;
    }

    if (!oldPassword || !newPassword) {
      res.status(400).json({ message: 'Old password and new password are required.' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: 'New password must be at least 6 characters.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ message: 'Current password is incorrect.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    res.status(200).json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error while changing password.' });
  }
};

export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email || !isValidEmail(email)) {
      res.status(400).json({ message: 'A valid email address is required.' });
      return;
    }

    const attemptKey = `${email}:${req.ip || 'unknown'}`;
    const rateLimit = consumeRateLimit(passwordResetRequestAttempts, attemptKey, 3, RESEND_WINDOW_MS);
    if (!rateLimit.allowed) {
      res.status(429).json({
        message: `Too many requests. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        passwordResetLastSentAt: true,
      },
    });

    // Always respond with success to avoid leaking whether email exists
    if (!user) {
      res.status(200).json({ message: 'If that email is registered, a reset code has been sent.' });
      return;
    }

    // Cooldown: 60s between requests
    if (
      user.passwordResetLastSentAt &&
      Date.now() - user.passwordResetLastSentAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      const retryAfterSeconds = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - user.passwordResetLastSentAt.getTime())) / 1000,
      );
      res.status(429).json({
        message: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
      });
      return;
    }

    const code = createVerificationCode();
    const codeHash = hashVerificationCode(email, code);
    const expiresAt = getVerificationExpiry();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetCodeHash: codeHash,
        passwordResetExpiresAt: expiresAt,
        passwordResetLastSentAt: new Date(),
      },
    });

    await sendPasswordResetEmail({ email: user.email, username: user.username, code });

    res.status(200).json({ message: 'If that email is registered, a reset code has been sent.' });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({ message: 'Server error while processing password reset.' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';

    if (!email || !code || !newPassword) {
      res.status(400).json({ message: 'Email, reset code, and new password are required.' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters.' });
      return;
    }

    const attemptKey = `reset:${email}:${req.ip || 'unknown'}`;
    const rateLimit = consumeRateLimit(passwordResetAttempts, attemptKey, 5, VERIFY_WINDOW_MS);
    if (!rateLimit.allowed) {
      res.status(429).json({
        message: `Too many attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordResetCodeHash || !user.passwordResetExpiresAt) {
      res.status(400).json({ message: 'Invalid or expired reset code. Please request a new one.' });
      return;
    }

    if (user.passwordResetExpiresAt.getTime() < Date.now()) {
      res.status(400).json({ message: 'Reset code has expired. Please request a new one.' });
      return;
    }

    const incomingHash = hashVerificationCode(email, code);
    if (incomingHash !== user.passwordResetCodeHash) {
      res.status(400).json({ message: 'Invalid reset code.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetCodeHash: null,
        passwordResetExpiresAt: null,
        passwordResetLastSentAt: null,
      },
    });

    clearRateLimit(passwordResetAttempts, attemptKey);
    res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error while resetting password.' });
  }
};

// ─── Server-Side Google OAuth ─────────────────────────────────────────────────

/**
 * GET /api/auth/google/url
 * Trả về Google authorization URL để frontend mở bằng WebBrowser.
 */
export const getGoogleAuthUrl = (_req: Request, res: Response): void => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    res.status(503).json({
      message: 'Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend .env.',
    });
    return;
  }

  const client = getGoogleOAuth2Client();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'profile', 'email'],
    prompt: 'select_account',
  });

  res.status(200).json({ url });
};

/**
 * GET /api/auth/google/callback
 * Google gọi endpoint này sau khi user đồng ý.
 * Backend exchange code → lấy profile → upsert user → redirect về app với JWT.
 */
export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const errorParam = typeof req.query.error === 'string' ? req.query.error : '';

  // Nếu user bấm Cancel trên trang Google
  if (errorParam || !code) {
    res.redirect(`${APP_DEEP_LINK_SCHEME}://auth?error=cancelled`);
    return;
  }

  try {
    const client = getGoogleOAuth2Client();

    // Exchange authorization code lấy tokens
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Lấy thông tin user từ Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      throw new Error(`Google userinfo failed: ${userInfoRes.status}`);
    }

    const profile = (await userInfoRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    const email = normalizeEmail(profile.email);

    if (!profile.sub || !email || !profile.email_verified || !isValidEmail(email)) {
      res.redirect(`${APP_DEEP_LINK_SCHEME}://auth?error=unverified_email`);
      return;
    }

    // Upsert user (giống logic googleLogin cũ)
    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      if (!user.emailVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            emailVerifiedAt: new Date(),
            emailVerificationCodeHash: null,
            emailVerificationExpiresAt: null,
            emailVerificationLastSentAt: null,
          },
        });
      }
      await prisma.pendingRegistration.deleteMany({ where: { email } });
    } else {
      const pendingRegistration = await prisma.pendingRegistration.findUnique({ where: { email } });

      if (pendingRegistration) {
        const usernameTaken = await prisma.user.findUnique({
          where: { username: pendingRegistration.username },
          select: { id: true },
        });
        const username = usernameTaken
          ? await createUniqueUsername(email, profile.name || pendingRegistration.username)
          : pendingRegistration.username;

        user = await prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              username,
              email,
              passwordHash: pendingRegistration.passwordHash,
              fullName: pendingRegistration.fullName || profile.name?.trim() || username,
              avatarUrl: profile.picture || DEFAULT_USER_AVATAR_URL,
              emailVerified: true,
              emailVerifiedAt: new Date(),
            },
          });
          await tx.pendingRegistration.delete({ where: { id: pendingRegistration.id } });
          return created;
        });
      } else {
        const username = await createUniqueUsername(email, profile.name);
        const randomPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

        user = await prisma.user.create({
          data: {
            username,
            email,
            passwordHash: randomPasswordHash,
            fullName: profile.name?.trim() || username,
            avatarUrl: profile.picture || DEFAULT_USER_AVATAR_URL,
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
      }
    }

    const token = createAuthToken(user.id);

    // Redirect về app qua deep link kèm JWT
    res.redirect(`${APP_DEEP_LINK_SCHEME}://auth?token=${encodeURIComponent(token)}`);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect(`${APP_DEEP_LINK_SCHEME}://auth?error=server_error`);
  }
};
