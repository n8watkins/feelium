ALTER TABLE `user` ADD `session_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profile` ADD `last_test_push_at` integer;--> statement-breakpoint
UPDATE `account` SET `access_token` = NULL, `refresh_token` = NULL, `id_token` = NULL, `expires_at` = NULL, `session_state` = NULL;
