-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "ChatHistoryUser" AS ENUM ('AGENT', 'USER');

-- CreateTable
CREATE TABLE "hdb_resale_transaction" (
    "identifier" SERIAL NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "town" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "street_name" TEXT NOT NULL,
    "storey_range_begin" INTEGER NOT NULL,
    "storey_range_end" INTEGER NOT NULL,
    "floor_area_square_feet" INTEGER NOT NULL,
    "flat_model" TEXT NOT NULL,
    "flat_type" TEXT NOT NULL,
    "lease_commence_year" INTEGER NOT NULL,
    "remaining_lease_in_months" INTEGER NOT NULL,
    "resale_price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "hdb_resale_transaction_pkey" PRIMARY KEY ("identifier")
);

-- CreateTable
CREATE TABLE "ChatHistory" (
    "id" SERIAL NOT NULL,
    "type" "ChatHistoryUser" NOT NULL,
    "messageEmbedding" vector(1536),
    "rawMessage" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreviousSqlQueryToQuestion" (
    "id" SERIAL NOT NULL,
    "questionEmbedding" vector(1536),
    "rawQuestion" TEXT NOT NULL,
    "sqlQuery" TEXT NOT NULL,

    CONSTRAINT "PreviousSqlQueryToQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatHistory_userId_idx" ON "ChatHistory"("userId");

-- CreateIndex
CREATE INDEX "ChatHistory_createdAt_idx" ON "ChatHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "ChatHistory" ADD CONSTRAINT "ChatHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
