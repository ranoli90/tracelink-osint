-- CreateIndex
CREATE INDEX "click_events_fingerprint_hash_idx" ON "click_events"("fingerprint_hash");

-- CreateIndex
CREATE INDEX "click_events_is_proxy_idx" ON "click_events"("is_proxy");
