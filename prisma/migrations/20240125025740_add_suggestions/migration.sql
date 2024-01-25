-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "suggestions" TEXT[] DEFAULT ARRAY[]::TEXT[];
