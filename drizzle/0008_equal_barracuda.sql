CREATE TABLE `reminder_delivery_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`reminder_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`occurrence_at` integer NOT NULL,
	`local_date` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` integer,
	`delivered_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`reminder_id`) REFERENCES `reminder_setting`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`) REFERENCES `push_subscription`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reminder_delivery_attempt_pending_idx` ON `reminder_delivery_attempt` (`reminder_id`,`occurrence_at`,`delivered_at`,`last_attempt_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_delivery_attempt_occurrence_unique` ON `reminder_delivery_attempt` (`reminder_id`,`subscription_id`,`occurrence_at`);--> statement-breakpoint
DROP INDEX `reminder_setting_user_id_unique`;--> statement-breakpoint
ALTER TABLE `reminder_setting` ADD `delivery_occurrence_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_setting_unique_time_per_user` ON `reminder_setting` (`user_id`,`reminder_time`);