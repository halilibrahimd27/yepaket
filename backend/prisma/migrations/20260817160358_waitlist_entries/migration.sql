-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" UUID NOT NULL,
    "feature" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "city" TEXT,
    "user_id" UUID,
    "notified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "waitlist_entries_feature_created_at_idx" ON "waitlist_entries"("feature", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_feature_email_key" ON "waitlist_entries"("feature", "email");

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
