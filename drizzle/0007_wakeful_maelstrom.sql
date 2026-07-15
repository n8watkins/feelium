PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_behavior` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text,
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
	FOREIGN KEY (`category_id`) REFERENCES `behavior_category`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "behavior_input_type_ck" CHECK("__new_behavior"."input_type" in ('boolean', 'numeric')),
	CONSTRAINT "behavior_direction_ck" CHECK("__new_behavior"."desired_direction" in ('increase', 'reduce', 'neutral')),
	CONSTRAINT "behavior_category_id_ck" CHECK("__new_behavior"."category_id" is null or length("__new_behavior"."category_id") > 0)
);
--> statement-breakpoint
INSERT INTO `__new_behavior`("id", "user_id", "category_id", "name", "description", "input_type", "desired_direction", "unit", "custom_prompt", "sort_order", "is_active", "created_at", "updated_at", "archived_at") SELECT "id", "user_id", "category_id", "name", "description", "input_type", "desired_direction", "unit", "custom_prompt", "sort_order", "is_active", "created_at", "updated_at", "archived_at" FROM `behavior`;--> statement-breakpoint
DROP TABLE `behavior`;--> statement-breakpoint
ALTER TABLE `__new_behavior` RENAME TO `behavior`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `behavior_user_sort_idx` ON `behavior` (`user_id`,`sort_order`);