ALTER TABLE `settings` ADD COLUMN `auth_enabled` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `auth_username` text;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `auth_password_hash` text;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `api_key` text;
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `token` text NOT NULL,
  `user_agent` text,
  `created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_idx` ON `auth_sessions` (`token`);
