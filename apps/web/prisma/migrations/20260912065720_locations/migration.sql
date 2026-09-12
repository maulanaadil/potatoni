-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "locationId" TEXT;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "locationId" TEXT;

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "startsOn" DATE,
    "endsOn" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");

-- CreateIndex
CREATE INDEX "Location_startsOn_idx" ON "Location"("startsOn");

-- CreateIndex
CREATE INDEX "Order_locationId_createdAt_idx" ON "Order"("locationId", "createdAt");

-- CreateIndex
CREATE INDEX "Purchase_locationId_purchasedAt_idx" ON "Purchase"("locationId", "purchasedAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
