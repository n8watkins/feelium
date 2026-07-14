DROP INDEX `push_subscription_reminder_delivery_idx`;--> statement-breakpoint
ALTER TABLE `push_subscription` ADD `reminder_failure_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `push_subscription` ADD `reminder_quarantined_at` integer;--> statement-breakpoint
CREATE INDEX `push_subscription_reminder_delivery_idx` ON `push_subscription` (`user_id`,`reminder_quarantined_at`,`last_reminder_local_date`,`last_reminder_attempt_at`);