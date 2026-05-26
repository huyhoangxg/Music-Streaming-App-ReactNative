import crypto from 'crypto';
import nodemailer from 'nodemailer';

const VERIFICATION_CODE_TTL_MINUTES = 15;

export function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normalizeUsername(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function createVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

export function getVerificationExpiry() {
  return new Date(Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60 * 1000);
}

export function hashVerificationCode(email: string, code: string) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'secret_key_tam_thoi')
    .update(`${normalizeEmail(email)}:${code.trim()}`)
    .digest('hex');
}

function getEmailText(username: string, code: string) {
  return `Hi ${username || 'there'},\n\nYour SoundWave verification code is ${code}.\nThis code expires in ${VERIFICATION_CODE_TTL_MINUTES} minutes.\n\nIf you did not create this account, ignore this email.`;
}

function getPasswordResetEmailText(username: string, code: string) {
  return `Hi ${username || 'there'},\n\nWe received a request to reset your SoundWave password.\nYour reset code is: ${code}\nThis code expires in ${VERIFICATION_CODE_TTL_MINUTES} minutes.\n\nIf you did not request a password reset, you can ignore this email.`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmailHtml(username: string, code: string) {
  const displayName = escapeHtml(username || 'there');

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <h2>Verify your SoundWave email</h2>
      <p>Hi ${displayName},</p>
      <p>Your verification code is:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0;">${code}</p>
      <p>This code expires in ${VERIFICATION_CODE_TTL_MINUTES} minutes.</p>
      <p>If you did not create this account, you can ignore this email.</p>
    </div>
  `;
}

function getPasswordResetEmailHtml(username: string, code: string) {
  const displayName = escapeHtml(username || 'there');

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <h2>Reset your SoundWave password</h2>
      <p>Hi ${displayName},</p>
      <p>We received a request to reset your password. Enter the code below:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0; color: #ff6a00;">${code}</p>
      <p>This code expires in ${VERIFICATION_CODE_TTL_MINUTES} minutes.</p>
      <p>If you did not request a password reset, you can safely ignore this email.</p>
    </div>
  `;
}

async function sendWithSmtp({
  email,
  username,
  code,
}: {
  email: string;
  username: string;
  code: string;
}) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '');
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const from = process.env.EMAIL_FROM || user;

  if (!host || !user || !pass || !from) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Verify your SoundWave email',
    text: getEmailText(username, code),
    html: getEmailHtml(username, code),
  });

  return true;
}

async function sendWithResend({
  email,
  username,
  code,
}: {
  email: string;
  username: string;
  code: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  if (!resendApiKey || !emailFrom) {
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: email,
      subject: 'Verify your SoundWave email',
      text: getEmailText(username, code),
      html: getEmailHtml(username, code),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Email provider rejected verification email: ${response.status} ${body}`);
  }

  return true;
}

export async function sendVerificationEmail({
  email,
  username,
  code,
}: {
  email: string;
  username: string;
  code: string;
}) {
  if (await sendWithResend({ email, username, code })) {
    return { deliveryMode: 'email' as const };
  }

  if (await sendWithSmtp({ email, username, code })) {
    return { deliveryMode: 'email' as const };
  }

  throw new Error(
    'Email provider is not configured. Set RESEND_API_KEY/EMAIL_FROM or SMTP_HOST/SMTP_USER/SMTP_PASS.',
  );
}

export async function sendPasswordResetEmail({
  email,
  username,
  code,
}: {
  email: string;
  username: string;
  code: string;
}) {
  const text = getPasswordResetEmailText(username, code);
  const html = getPasswordResetEmailHtml(username, code);
  const subject = 'Reset your SoundWave password';

  // Try Resend
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  if (resendApiKey && emailFrom) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: emailFrom, to: email, subject, text, html }),
    });
    if (response.ok) return { deliveryMode: 'email' as const };
    const body = await response.text().catch(() => '');
    throw new Error(`Email provider rejected reset email: ${response.status} ${body}`);
  }

  // Try SMTP
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '');
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const from = process.env.EMAIL_FROM || user;
  if (host && user && pass && from) {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({ host, port, secure, auth: { user, pass } });
    await transporter.sendMail({ from, to: email, subject, text, html });
    return { deliveryMode: 'email' as const };
  }

  throw new Error(
    'Email provider is not configured. Set RESEND_API_KEY/EMAIL_FROM or SMTP_HOST/SMTP_USER/SMTP_PASS.',
  );
}
