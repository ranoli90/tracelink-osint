-- AlterTable
ALTER TABLE "click_events" ADD COLUMN     "address" TEXT,
ADD COLUMN     "asn" TEXT,
ADD COLUMN     "city_postal_code" TEXT,
ADD COLUMN     "country_code" TEXT,
ADD COLUMN     "device_brand" TEXT,
ADD COLUMN     "device_model" TEXT,
ADD COLUMN     "ip_full" TEXT,
ADD COLUMN     "ip_raw" TEXT,
ADD COLUMN     "ip_version" INTEGER,
ADD COLUMN     "is_hosting" BOOLEAN,
ADD COLUMN     "is_proxy" BOOLEAN,
ADD COLUMN     "is_tor" BOOLEAN,
ADD COLUMN     "is_vpn" BOOLEAN,
ADD COLUMN     "isp" TEXT,
ADD COLUMN     "org" TEXT,
ADD COLUMN     "referrer_domain" TEXT,
ADD COLUMN     "region_code" TEXT,
ADD COLUMN     "reverse_dns" TEXT,
ADD COLUMN     "timezone" TEXT;

-- CreateTable
CREATE TABLE "custom_domains" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "link_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "ssl_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_domains_domain_key" ON "custom_domains"("domain");

-- CreateIndex
CREATE INDEX "click_events_ip_full_idx" ON "click_events"("ip_full");

-- CreateIndex
CREATE INDEX "click_events_country_idx" ON "click_events"("country");

-- AddForeignKey
ALTER TABLE "custom_domains" ADD CONSTRAINT "custom_domains_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links"("tracking_id") ON DELETE RESTRICT ON UPDATE CASCADE;
