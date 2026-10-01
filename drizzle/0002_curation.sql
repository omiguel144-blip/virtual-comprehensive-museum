ALTER TABLE `artworks` ADD `object_type` text DEFAULT 'painting' NOT NULL;--> statement-breakpoint
ALTER TABLE `artworks` ADD `display_mode` text DEFAULT 'wall' NOT NULL;--> statement-breakpoint
ALTER TABLE `artworks` ADD `region` text;--> statement-breakpoint
ALTER TABLE `artworks` ADD `period` text;--> statement-breakpoint
ALTER TABLE `artworks` ADD `gallery_key` text;--> statement-breakpoint
ALTER TABLE `artworks` ADD `search_text` text;--> statement-breakpoint
CREATE INDEX `artworks_gallery_idx` ON `artworks` (`gallery_key`);