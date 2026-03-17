-- CreateTable
CREATE TABLE "links" (
    "id" TEXT NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "destination_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_events" (
    "id" TEXT NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "ip_truncated" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "device_type" TEXT,
    "browser" TEXT,
    "browser_version" TEXT,
    "os" TEXT,
    "os_version" TEXT,
    "screen_resolution" TEXT,
    "language" TEXT,
    "referrer" TEXT,
    "user_agent" TEXT,
    "fingerprint_hash" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "links_tracking_id_key" ON "links"("tracking_id");

-- CreateIndex
CREATE INDEX "click_events_tracking_id_idx" ON "click_events"("tracking_id");

-- CreateIndex
CREATE INDEX "click_events_timestamp_idx" ON "click_events"("timestamp");

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "links"("tracking_id") ON DELETE CASCADE ON UPDATE CASCADE;
