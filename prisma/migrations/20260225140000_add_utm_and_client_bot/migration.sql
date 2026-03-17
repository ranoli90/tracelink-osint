-- AlterTable
ALTER TABLE "click_events" ADD COLUMN "client_bot" BOOLEAN,
ADD COLUMN "utm_source" TEXT,
ADD COLUMN "utm_medium" TEXT,
ADD COLUMN "utm_campaign" TEXT,
ADD COLUMN "utm_term" TEXT,
ADD COLUMN "utm_content" TEXT;
