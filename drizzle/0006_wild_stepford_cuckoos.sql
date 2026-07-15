CREATE TABLE `behavior_category` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`color` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "behavior_category_color_ck" CHECK("behavior_category"."color" in ('blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'purple', 'indigo', 'slate'))
);
--> statement-breakpoint
CREATE INDEX `behavior_category_user_sort_idx` ON `behavior_category` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `behavior_category_unique_name_per_user` ON `behavior_category` (`user_id`,`normalized_name`);--> statement-breakpoint
ALTER TABLE `behavior` ADD `category_id` text REFERENCES behavior_category(id);