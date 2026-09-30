CREATE TABLE `duplicate_candidates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`artwork_a` integer NOT NULL,
	`artwork_b` integer NOT NULL,
	`reason` text NOT NULL,
	`score` real NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`decided_by` text,
	`decided_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`artwork_a`) REFERENCES `artworks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artwork_b`) REFERENCES `artworks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `duplicate_pair_unique` ON `duplicate_candidates` (`artwork_a`,`artwork_b`);--> statement-breakpoint
ALTER TABLE `artworks` ADD `wikidata_id` text;--> statement-breakpoint
ALTER TABLE `artworks` ADD `duplicate_of` integer;--> statement-breakpoint
CREATE INDEX `artworks_wikidata_idx` ON `artworks` (`wikidata_id`);--> statement-breakpoint
CREATE INDEX `artworks_duplicate_idx` ON `artworks` (`duplicate_of`);