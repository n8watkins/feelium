ALTER TABLE `reminder_setting` ADD `next_reminder_at` integer;--> statement-breakpoint
CREATE INDEX `reminder_setting_due_idx` ON `reminder_setting` (`is_enabled`,`next_reminder_at`);