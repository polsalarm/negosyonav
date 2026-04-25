CREATE TABLE `community_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`authorName` varchar(255) NOT NULL,
	`lguTag` varchar(100) NOT NULL DEFAULT 'manila_city',
	`category` enum('tip','warning','question','experience') NOT NULL DEFAULT 'tip',
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`upvotes` int NOT NULL DEFAULT 0,
	`downvotes` int NOT NULL DEFAULT 0,
	`isFlagged` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `community_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`feedbackType` enum('outdated_info','incorrect_data','suggestion','bug_report','general') NOT NULL,
	`stepNumber` int,
	`lguId` varchar(100) DEFAULT 'manila_city',
	`message` text NOT NULL,
	`status` enum('pending','reviewed','resolved') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`userId` int NOT NULL,
	`voteType` enum('up','down') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_votes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roadmaps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`lguId` varchar(100) NOT NULL DEFAULT 'manila_city',
	`businessType` varchar(255),
	`district` varchar(255),
	`totalEstimatedCostMin` int,
	`totalEstimatedCostMax` int,
	`completedSteps` json DEFAULT ('[]'),
	`checkedDocuments` json DEFAULT ('{}'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roadmaps_id` PRIMARY KEY(`id`)
);
