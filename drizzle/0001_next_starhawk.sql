PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_behavior` (
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
	CONSTRAINT "behavior_name_length_ck" CHECK(length("__new_behavior"."name") between 1 and 100),
	CONSTRAINT "behavior_description_length_ck" CHECK("__new_behavior"."description" is null or length("__new_behavior"."description") <= 1000),
	CONSTRAINT "behavior_unit_length_ck" CHECK("__new_behavior"."unit" is null or length("__new_behavior"."unit") <= 40),
	CONSTRAINT "behavior_prompt_length_ck" CHECK("__new_behavior"."custom_prompt" is null or length("__new_behavior"."custom_prompt") <= 1000),
	CONSTRAINT "behavior_input_type_ck" CHECK("__new_behavior"."input_type" in ('boolean', 'numeric')),
	CONSTRAINT "behavior_direction_ck" CHECK("__new_behavior"."desired_direction" in ('increase', 'reduce', 'neutral'))
);
--> statement-breakpoint
INSERT INTO `__new_behavior`("id", "user_id", "name", "description", "input_type", "desired_direction", "unit", "custom_prompt", "sort_order", "is_active", "created_at", "updated_at", "archived_at") SELECT "id", "user_id", "name", "description", "input_type", "desired_direction", "unit", "custom_prompt", "sort_order", "is_active", "created_at", "updated_at", "archived_at" FROM `behavior`;--> statement-breakpoint
DROP TABLE `behavior`;--> statement-breakpoint
ALTER TABLE `__new_behavior` RENAME TO `behavior`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `behavior_user_sort_idx` ON `behavior` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `__new_check_in_value` (
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
	CONSTRAINT "check_in_value_rating_range_ck" CHECK("__new_check_in_value"."rating_value" is null or "__new_check_in_value"."rating_value" between 1 and 5),
	CONSTRAINT "check_in_value_shape_ck" CHECK(("__new_check_in_value"."rating_value" is not null) + ("__new_check_in_value"."boolean_value" is not null) + ("__new_check_in_value"."numeric_value" is not null) = 1),
	CONSTRAINT "check_in_value_numeric_ck" CHECK("__new_check_in_value"."numeric_value" is null or ("__new_check_in_value"."numeric_value" >= 0 and "__new_check_in_value"."numeric_value" <= 1000000000))
);
--> statement-breakpoint
INSERT INTO `__new_check_in_value`("id", "user_id", "check_in_id", "outcome_metric_id", "rating_value", "boolean_value", "numeric_value", "created_at", "updated_at") SELECT "id", "user_id", "check_in_id", "outcome_metric_id", "rating_value", "boolean_value", "numeric_value", "created_at", "updated_at" FROM `check_in_value`;--> statement-breakpoint
DROP TABLE `check_in_value`;--> statement-breakpoint
ALTER TABLE `__new_check_in_value` RENAME TO `check_in_value`;--> statement-breakpoint
CREATE INDEX `check_in_value_metric_idx` ON `check_in_value` (`outcome_metric_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `check_in_value_unique_per_metric` ON `check_in_value` (`check_in_id`,`outcome_metric_id`);--> statement-breakpoint
CREATE TABLE `__new_check_in` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`local_date` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_in_local_date_ck" CHECK(length("__new_check_in"."local_date") = 10 and "__new_check_in"."local_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "check_in_note_length_ck" CHECK("__new_check_in"."note" is null or length("__new_check_in"."note") <= 5000)
);
--> statement-breakpoint
INSERT INTO `__new_check_in`("id", "user_id", "occurred_at", "local_date", "note", "created_at", "updated_at") SELECT "id", "user_id", "occurred_at", "local_date", "note", "created_at", "updated_at" FROM `check_in`;--> statement-breakpoint
DROP TABLE `check_in`;--> statement-breakpoint
ALTER TABLE `__new_check_in` RENAME TO `check_in`;--> statement-breakpoint
CREATE INDEX `check_in_user_local_date_idx` ON `check_in` (`user_id`,`local_date`);--> statement-breakpoint
CREATE INDEX `check_in_user_occurred_idx` ON `check_in` (`user_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `__new_daily_behavior_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`behavior_id` text NOT NULL,
	`entry_date` text NOT NULL,
	`boolean_value` integer,
	`numeric_value` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`behavior_id`) REFERENCES `behavior`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "daily_behavior_entry_date_ck" CHECK(length("__new_daily_behavior_entry"."entry_date") = 10 and "__new_daily_behavior_entry"."entry_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "daily_behavior_entry_value_ck" CHECK(("__new_daily_behavior_entry"."boolean_value" is not null) + ("__new_daily_behavior_entry"."numeric_value" is not null) = 1),
	CONSTRAINT "daily_behavior_entry_numeric_ck" CHECK("__new_daily_behavior_entry"."numeric_value" is null or ("__new_daily_behavior_entry"."numeric_value" >= 0 and "__new_daily_behavior_entry"."numeric_value" <= 1000000000))
);
--> statement-breakpoint
INSERT INTO `__new_daily_behavior_entry`("id", "user_id", "behavior_id", "entry_date", "boolean_value", "numeric_value", "created_at", "updated_at") SELECT "id", "user_id", "behavior_id", "entry_date", "boolean_value", "numeric_value", "created_at", "updated_at" FROM `daily_behavior_entry`;--> statement-breakpoint
DROP TABLE `daily_behavior_entry`;--> statement-breakpoint
ALTER TABLE `__new_daily_behavior_entry` RENAME TO `daily_behavior_entry`;--> statement-breakpoint
CREATE INDEX `daily_behavior_entry_user_date_idx` ON `daily_behavior_entry` (`user_id`,`entry_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `daily_behavior_entry_unique_per_day` ON `daily_behavior_entry` (`user_id`,`behavior_id`,`entry_date`);--> statement-breakpoint
CREATE TABLE `__new_outcome_metric` (
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
	CONSTRAINT "outcome_metric_name_length_ck" CHECK(length("__new_outcome_metric"."name") between 1 and 100),
	CONSTRAINT "outcome_metric_description_length_ck" CHECK("__new_outcome_metric"."description" is null or length("__new_outcome_metric"."description") <= 1000),
	CONSTRAINT "outcome_metric_unit_length_ck" CHECK("__new_outcome_metric"."unit" is null or length("__new_outcome_metric"."unit") <= 40),
	CONSTRAINT "outcome_metric_input_type_ck" CHECK("__new_outcome_metric"."input_type" in ('rating', 'boolean', 'numeric')),
	CONSTRAINT "outcome_metric_direction_ck" CHECK("__new_outcome_metric"."desired_direction" is null or "__new_outcome_metric"."desired_direction" in ('higher_is_better', 'lower_is_better', 'neutral'))
);
--> statement-breakpoint
INSERT INTO `__new_outcome_metric`("id", "user_id", "name", "description", "input_type", "desired_direction", "unit", "sort_order", "is_active", "created_at", "updated_at", "archived_at") SELECT "id", "user_id", "name", "description", "input_type", "desired_direction", "unit", "sort_order", "is_active", "created_at", "updated_at", "archived_at" FROM `outcome_metric`;--> statement-breakpoint
DROP TABLE `outcome_metric`;--> statement-breakpoint
ALTER TABLE `__new_outcome_metric` RENAME TO `outcome_metric`;--> statement-breakpoint
CREATE INDEX `outcome_metric_user_sort_idx` ON `outcome_metric` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `__new_tag` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tag_name_length_ck" CHECK(length("__new_tag"."name") between 1 and 100)
);
--> statement-breakpoint
INSERT INTO `__new_tag`("id", "user_id", "name", "created_at") SELECT "id", "user_id", "name", "created_at" FROM `tag`;--> statement-breakpoint
DROP TABLE `tag`;--> statement-breakpoint
ALTER TABLE `__new_tag` RENAME TO `tag`;--> statement-breakpoint
CREATE UNIQUE INDEX `tag_unique_name_per_user` ON `tag` (`user_id`,`name`);