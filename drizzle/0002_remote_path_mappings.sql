CREATE TABLE `download_client_path_mappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`download_client_id` integer NOT NULL,
	`remote_path` text NOT NULL,
	`local_path` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`download_client_id`) REFERENCES `download_clients`(`id`) ON UPDATE no action ON DELETE cascade
);
