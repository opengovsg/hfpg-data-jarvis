-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "PreviousSqlQueryToQuestion" (
    "id" SERIAL NOT NULL,
    "questionEmbedding" vector(512),
    "rawQuestion" TEXT NOT NULL,
    "sqlQuery" TEXT NOT NULL,

    CONSTRAINT "PreviousSqlQueryToQuestion_pkey" PRIMARY KEY ("id")
);
