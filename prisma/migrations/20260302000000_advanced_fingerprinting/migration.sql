-- Migration: Add advanced fingerprinting fields
-- Created: 2026-03-02

ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "canvas_fingerprint" TEXT;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "webgl_vendor" TEXT;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "webgl_renderer" TEXT;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "webgl_fingerprint" TEXT;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "webgl2_enabled" BOOLEAN;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "webgl_extensions" TEXT;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "audio_fingerprint" TEXT;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "fonts_detected" TEXT;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "is_headless" BOOLEAN;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "is_mobile" BOOLEAN;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "session_storage_enabled" BOOLEAN;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "local_storage_enabled" BOOLEAN;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "cookie_enabled" BOOLEAN;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "permissions" TEXT;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "mouse_movements" TEXT;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "scroll_depth" INTEGER;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "clicks" INTEGER;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "keypresses" INTEGER;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "time_on_page" INTEGER;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "page_url" TEXT;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "battery_level" INTEGER;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "battery_charging" BOOLEAN;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "online" BOOLEAN;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "do_not_track" TEXT;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "plugins_length" INTEGER;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "document_width" INTEGER;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "document_height" INTEGER;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "avail_width" INTEGER;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "avail_height" INTEGER;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "screen_pixel_ratio" DOUBLE PRECISION;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "languages" TEXT;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "downlink" DOUBLE PRECISION;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "rtt" INTEGER;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "save_data" BOOLEAN;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "bot_indicators" TEXT;

-- Indexes for new fields
CREATE INDEX IF NOT EXISTS "click_events_is_likely_bot_idx" ON "click_events" ("is_likely_bot");
CREATE INDEX IF NOT EXISTS "click_events_client_bot_idx" ON "click_events" ("client_bot");
CREATE INDEX IF NOT EXISTS "click_events_is_headless_idx" ON "click_events" ("is_headless");
CREATE INDEX IF NOT EXISTS "click_events_is_mobile_idx" ON "click_events" ("is_mobile");
CREATE INDEX IF NOT EXISTS "click_events_fingerprint_hash_idx" ON "click_events" ("fingerprint_hash");
CREATE INDEX IF NOT EXISTS "click_events_time_on_page_idx" ON "click_events" ("time_on_page");
CREATE INDEX IF NOT EXISTS "click_events_scroll_depth_idx" ON "click_events" ("scroll_depth");
CREATE INDEX IF NOT EXISTS "click_events_utm_source_idx" ON "click_events" ("utm_source");
CREATE INDEX IF NOT EXISTS "click_events_utm_medium_idx" ON "click_events" ("utm_medium");
CREATE INDEX IF NOT EXISTS "click_events_utm_campaign_idx" ON "click_events" ("utm_campaign");
CREATE INDEX IF NOT EXISTS "click_events_referrer_domain_idx" ON "click_events" ("referrer_domain");
CREATE INDEX IF NOT EXISTS "click_events_webrtc_leak_detected_idx" ON "click_events" ("webrtc_leak_detected");
CREATE INDEX IF NOT EXISTS "click_events_webrtc_real_ip_idx" ON "click_events" ("webrtc_real_ip");
