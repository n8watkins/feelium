CREATE TABLE `account` (
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `provider_account_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`session_token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`email_verified` integer,
	`image` text,
	`password_hash` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification_token` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
--> statement-breakpoint
CREATE TABLE `behavior` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`input_type` text NOT NULL,
	`desired_direction` text NOT NULL,
	`unit` text,
	`custom_prompt` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "behavior_input_type_ck" CHECK("behavior"."input_type" in ('boolean', 'numeric')),
	CONSTRAINT "behavior_direction_ck" CHECK("behavior"."desired_direction" in ('increase', 'reduce', 'neutral'))
);
--> statement-breakpoint
CREATE INDEX `behavior_user_sort_idx` ON `behavior` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `check_in_tag` (
	`check_in_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`check_in_id`, `tag_id`),
	FOREIGN KEY (`check_in_id`) REFERENCES `check_in`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `check_in_tag_tag_idx` ON `check_in_tag` (`tag_id`);--> statement-breakpoint
CREATE TABLE `check_in_value` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`check_in_id` text NOT NULL,
	`outcome_metric_id` text NOT NULL,
	`rating_value` integer,
	`boolean_value` integer,
	`numeric_value` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`check_in_id`) REFERENCES `check_in`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`outcome_metric_id`) REFERENCES `outcome_metric`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_in_value_rating_range_ck" CHECK("check_in_value"."rating_value" is null or "check_in_value"."rating_value" between 1 and 5)
);
--> statement-breakpoint
CREATE INDEX `check_in_value_metric_idx` ON `check_in_value` (`outcome_metric_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `check_in_value_unique_per_metric` ON `check_in_value` (`check_in_id`,`outcome_metric_id`);--> statement-breakpoint
CREATE TABLE `check_in` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`local_date` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `check_in_user_local_date_idx` ON `check_in` (`user_id`,`local_date`);--> statement-breakpoint
CREATE INDEX `check_in_user_occurred_idx` ON `check_in` (`user_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `daily_behavior_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`behavior_id` text NOT NULL,
	`entry_date` text NOT NULL,
	`boolean_value` integer,
	`numeric_value` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`behavior_id`) REFERENCES `behavior`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `daily_behavior_entry_user_date_idx` ON `daily_behavior_entry` (`user_id`,`entry_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `daily_behavior_entry_unique_per_day` ON `daily_behavior_entry` (`user_id`,`behavior_id`,`entry_date`);--> statement-breakpoint
CREATE TABLE `outcome_metric` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`input_type` text NOT NULL,
	`desired_direction` text,
	`unit` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "outcome_metric_input_type_ck" CHECK("outcome_metric"."input_type" in ('rating', 'boolean', 'numeric')),
	CONSTRAINT "outcome_metric_direction_ck" CHECK("outcome_metric"."desired_direction" is null or "outcome_metric"."desired_direction" in ('higher_is_better', 'lower_is_better', 'neutral'))
);
--> statement-breakpoint
CREATE INDEX `outcome_metric_user_sort_idx` ON `outcome_metric` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `profile` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`week_starts_on` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "profile_week_starts_on_ck" CHECK("profile"."week_starts_on" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE `push_subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`subscription_data` text NOT NULL,
	`device_name` text,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscription_unique_endpoint` ON `push_subscription` (`user_id`,`endpoint`);--> statement-breakpoint
CREATE TABLE `reminder_setting` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`reminder_time` text,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_setting_user_id_unique` ON `reminder_setting` (`user_id`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_unique_name_per_user` ON `tag` (`user_id`,`name`);