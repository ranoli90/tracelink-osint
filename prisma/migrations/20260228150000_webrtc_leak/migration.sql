-- AlterTable
ALTER TABLE "click_events" ADD COLUMN "webrtc_ips" TEXT,
ADD COLUMN "webrtc_real_ip" TEXT,
ADD COLUMN "webrtc_leak_detected" BOOLEAN,
ADD COLUMN "webrtc_real_country" TEXT,
ADD COLUMN "webrtc_real_city" TEXT,
ADD COLUMN "webrtc_real_isp" TEXT;
