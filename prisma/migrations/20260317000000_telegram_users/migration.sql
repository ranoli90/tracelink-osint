-- Create TelegramUser table for per-user account isolation
CREATE TABLE "telegram_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegram_id" BIGINT NOT NULL UNIQUE,
    "first_name" TEXT,
    "last_name" TEXT,
    "username" TEXT,
    "language_code" TEXT,
    "is_premium" BOOLEAN DEFAULT false,
    "is_bot" BOOLEAN DEFAULT false,
    "referrer_id" BIGINT,
    "referral_count" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_users_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "telegram_users"("telegram_id") ON DELETE SET NULL
);

-- Create index for faster lookups
CREATE INDEX "telegram_users_telegram_id_idx" ON "telegram_users"("telegram_id");
CREATE INDEX "telegram_users_created_at_idx" ON "telegram_users"("created_at");

-- Add user_id foreign key to Link table for per-user ownership
ALTER TABLE "links" ADD COLUMN "user_id" BIGINT;
ALTER TABLE "links" ADD CONSTRAINT "links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "telegram_users"("telegram_id") ON DELETE SET NULL;
CREATE INDEX "links_user_id_idx" ON "links"("user_id");

-- Add referral_id to ClickEvent for tracking
ALTER TABLE "click_events" ADD COLUMN "user_id" BIGINT;
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "telegram_users"("telegram_id") ON DELETE SET NULL;
CREATE INDEX "click_events_user_id_idx" ON "click_events"("user_id");
