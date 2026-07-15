ALTER TABLE `push_subscription` ADD `last_reminder_local_date` text;--> statement-breakpoint
ALTER TABLE `push_subscription` ADD `last_reminder_attempt_at` integer;--> statement-breakpoint
CREATE INDEX `push_subscription_reminder_delivery_idx` ON `push_subscription` (`user_id`,`last_reminder_local_date`,`last_reminder_attempt_at`);--> statement-breakpoint
ALTER TABLE `reminder_setting` ADD `delivery_local_date` text;--> statement-breakpoint
ALTER TABLE `reminder_setting` ADD `delivery_lease_token` text;--> statement-breakpoint
ALTER TABLE `reminder_setting` ADD `delivery_lease_expires_at` integer;