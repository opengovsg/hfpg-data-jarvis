-- CreateTable
CREATE TABLE "HdbResaleTransaction" (
    "identifier" SERIAL NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "town" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "streetName" TEXT NOT NULL,
    "storeyRangeBegin" INTEGER NOT NULL,
    "storeyRangeEnd" INTEGER NOT NULL,
    "floorAreaSquareFeet" INTEGER NOT NULL,
    "flatModel" TEXT NOT NULL,
    "flatType" TEXT NOT NULL,
    "leaseCommenceYear" INTEGER NOT NULL,
    "remainingLeaseInMonths" INTEGER NOT NULL,
    "resalePrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "HdbResaleTransaction_pkey" PRIMARY KEY ("identifier")
);
