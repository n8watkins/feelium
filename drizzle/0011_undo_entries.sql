CREATE TABLE `undo_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "undo_entry_kind_ck" CHECK("undo_entry"."kind" in ('check_in', 'feeling', 'tag', 'category'))
);
--> statement-breakpoint
CREATE INDEX `undo_entry_expires_idx` ON `undo_entry` (`expires_at`);