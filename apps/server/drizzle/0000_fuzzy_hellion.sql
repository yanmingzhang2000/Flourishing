CREATE TABLE `copilot_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `copilot_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `copilot_messages_session_created_idx` ON `copilot_messages` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `copilot_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `copilot_sessions_user_created_idx` ON `copilot_sessions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `project_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_instances_user_status_idx` ON `project_instances` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `training_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`week_plan_id` text NOT NULL,
	`date` text NOT NULL,
	`completed` integer NOT NULL,
	`duration_minutes` integer,
	`feedback` text,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`week_plan_id`) REFERENCES `weekly_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `training_records_user_created_idx` ON `training_records` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `training_records_user_completed_created_idx` ON `training_records` (`user_id`,`completed`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`height_cm` real,
	`weight_kg` real,
	`age` integer,
	`experience_level` text,
	`target_minutes_per_session` integer,
	`target_sessions_per_week` integer,
	`injuries` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_created_at_idx` ON `users` (`created_at`);--> statement-breakpoint
CREATE TABLE `weekly_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`start_date` text NOT NULL,
	`status` text NOT NULL,
	`days` text NOT NULL,
	`library_version` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `weekly_plans_user_start_date_idx` ON `weekly_plans` (`user_id`,`start_date`);