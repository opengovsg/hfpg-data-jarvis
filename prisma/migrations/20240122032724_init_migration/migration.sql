-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "ChatMessageUser" AS ENUM ('AGENT', 'USER');

-- CreateTable
CREATE TABLE "hdb_resale_transaction" (
    "identifier" SERIAL NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "town" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "street_name" TEXT NOT NULL,
    "storey_range_begin" INTEGER NOT NULL,
    "storey_range_end" INTEGER NOT NULL,
    "floor_area_square_feet" DOUBLE PRECISION NOT NULL,
    "flat_model" TEXT NOT NULL,
    "flat_type" TEXT NOT NULL,
    "lease_commence_year" INTEGER NOT NULL,
    "remaining_lease_in_months" INTEGER NOT NULL,
    "resale_price" DOUBLE PRECISION NOT NULL,
    "coords" geometry(Point, 4326),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "hdb_resale_transaction_pkey" PRIMARY KEY ("identifier")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "type" "ChatMessageUser" NOT NULL,
    "messageEmbedding" vector(1536),
    "rawMessage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" INTEGER NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreviousSqlQueryToQuestion" (
    "id" SERIAL NOT NULL,
    "questionEmbedding" vector(1536),
    "rawQuestion" TEXT NOT NULL,
    "sqlQuery" TEXT NOT NULL,

    CONSTRAINT "PreviousSqlQueryToQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "username" TEXT,
    "email" TEXT,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "bio" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hdb_geometry_index" ON "hdb_resale_transaction" USING GIST ("coords");

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
