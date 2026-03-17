-- AlterTable
ALTER TABLE "click_events" ADD COLUMN "is_likely_bot" BOOLEAN,
ADD COLUMN "timezone_offset" INTEGER;
