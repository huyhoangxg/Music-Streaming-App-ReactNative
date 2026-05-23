CREATE TABLE "PendingRegistration" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "verificationCodeHash" TEXT NOT NULL,
    "verificationExpiresAt" TIMESTAMP(3) NOT NULL,
    "verificationLastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingRegistration_username_key" ON "PendingRegistration"("username");
CREATE UNIQUE INDEX "PendingRegistration_email_key" ON "PendingRegistration"("email");
CREATE INDEX "PendingRegistration_verificationExpiresAt_idx" ON "PendingRegistration"("verificationExpiresAt");
