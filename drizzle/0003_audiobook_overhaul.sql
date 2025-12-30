PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `books_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audible_asin` text NOT NULL,
	`audible_product_id` text,
	`title` text NOT NULL,
	`authors_json` text NOT NULL,
	`narrators_json` text DEFAULT '[]' NOT NULL,
	`publish_year` integer,
	`release_date` text,
	`description` text,
	`language` text,
	`runtime_seconds` integer,
	`sample_url` text,
	`cover_url` text,
	`cover_path` text,
	`state` text DEFAULT 'MISSING' NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `books_new` (
	`id`,
	`audible_asin`,
	`audible_product_id`,
	`title`,
	`authors_json`,
	`publish_year`,
	`description`,
	`cover_url`,
	`cover_path`,
	`state`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`openlibrary_work_id`,
	`openlibrary_edition_id`,
	`title`,
	`authors_json`,
	`publish_year`,
	`description`,
	`cover_url`,
	`cover_path`,
	`state`,
	`created_at`,
	`updated_at`
FROM `books`;
--> statement-breakpoint
DROP TABLE `books`;
--> statement-breakpoint
ALTER TABLE `books_new` RENAME TO `books`;
--> statement-breakpoint
CREATE UNIQUE INDEX `books_asin_idx` ON `books` (`audible_asin`);
--> statement-breakpoint
CREATE INDEX `books_state_idx` ON `books` (`state`);
--> statement-breakpoint
CREATE TABLE `download_clients_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`host` text NOT NULL,
	`port` integer NOT NULL,
	`api_key` text,
	`username` text,
	`password` text,
	`category` text DEFAULT 'audiobooks' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `download_clients_new` (
	`id`,
	`name`,
	`type`,
	`host`,
	`port`,
	`api_key`,
	`username`,
	`password`,
	`category`,
	`enabled`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`name`,
	`type`,
	`host`,
	`port`,
	`api_key`,
	`username`,
	`password`,
	`category`,
	`enabled`,
	`created_at`,
	`updated_at`
FROM `download_clients`;
--> statement-breakpoint
DROP TABLE `download_clients`;
--> statement-breakpoint
ALTER TABLE `download_clients_new` RENAME TO `download_clients`;
--> statement-breakpoint
UPDATE `download_clients` SET `category` = 'audiobooks' WHERE `category` = 'ebooks';
--> statement-breakpoint
PRAGMA foreign_keys=ON;
