-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLatitude" DOUBLE PRECISION,
ADD COLUMN     "lastLocationAt" TIMESTAMP(3),
ADD COLUMN     "lastLongitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "HumanHandoffRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HumanHandoffRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HumanHandoffRequest" ADD CONSTRAINT "HumanHandoffRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
