-- CreateTable
CREATE TABLE "searched_address" (
    "address" TEXT NOT NULL,
    "search_val" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "coords" geometry(Point, 4326),

    CONSTRAINT "searched_address_pkey" PRIMARY KEY ("search_val")
);

-- CreateIndex
CREATE INDEX "searched_address_geometry_index" ON "searched_address" USING GIST ("coords");
