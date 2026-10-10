CREATE TABLE `workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`week_plan_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`exercises` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`week_plan_id`) REFERENCES `weekly_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workout_sessions_user_date_idx` ON `workout_sessions` (`user_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `workout_sessions_user_plan_date_unique` ON `workout_sessions` (`user_id`,`week_plan_id`,`date`);