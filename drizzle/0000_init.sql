CREATE TABLE `artworks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`artist_name` text,
	`date_display` text,
	`year_start` integer,
	`year_end` integer,
	`medium` text,
	`classification` text,
	`culture` text,
	`institution` text NOT NULL,
	`source_record_id` text NOT NULL,
	`source_record_url` text NOT NULL,
	`credit_line` text,
	`height_cm` real,
	`width_cm` real,
	`dimension_source` text,
	`dimension_confidence` text DEFAULT 'unknown' NOT NULL,
	`raw_source_record` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artworks_source_unique` ON `artworks` (`institution`,`source_record_id`);--> statement-breakpoint
CREATE INDEX `artworks_year_idx` ON `artworks` (`year_start`);--> statement-breakpoint
CREATE INDEX `artworks_artist_idx` ON `artworks` (`artist_name`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`artwork_id` integer NOT NULL,
	`image_url` text NOT NULL,
	`thumbnail_url` text,
	`pixel_width` integer,
	`pixel_height` integer,
	`rights_basis` text DEFAULT 'UNKNOWN' NOT NULL,
	`license_url` text,
	`rights_statement` text,
	`attribution_text` text,
	`rights_evidence_url` text,
	`rights_checked_at` text,
	`display_status` text DEFAULT 'PENDING_REVIEW' NOT NULL,
	`manual_override` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`artwork_id`) REFERENCES `artworks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `images_artwork_idx` ON `images` (`artwork_id`);