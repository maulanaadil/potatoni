-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'ISSUED', 'REDEEMED');

-- AlterEnum
ALTER TYPE "ActivitySource" ADD VALUE 'PUBLIC';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "voucherClaimId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CASHIER',
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "maxDiscount" INTEGER,
    "minSpend" INTEGER NOT NULL DEFAULT 0,
    "claimStartsAt" DATE,
    "claimEndsAt" DATE,
    "validDays" INTEGER NOT NULL DEFAULT 30,
    "quota" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoucherCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherClaim" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "otpHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "otpSentCount" INTEGER NOT NULL DEFAULT 0,
    "otpLastSentAt" TIMESTAMP(3),
    "code" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_email_idx" ON "Invite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherCampaign_slug_key" ON "VoucherCampaign"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherClaim_code_key" ON "VoucherClaim"("code");

-- CreateIndex
CREATE INDEX "VoucherClaim_status_idx" ON "VoucherClaim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherClaim_campaignId_customerId_key" ON "VoucherClaim"("campaignId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherClaim_campaignId_phone_key" ON "VoucherClaim"("campaignId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Order_voucherClaimId_key" ON "Order"("voucherClaimId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_voucherClaimId_fkey" FOREIGN KEY ("voucherClaimId") REFERENCES "VoucherClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherClaim" ADD CONSTRAINT "VoucherClaim_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "VoucherCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherClaim" ADD CONSTRAINT "VoucherClaim_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

