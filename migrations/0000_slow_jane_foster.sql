CREATE TABLE `orders` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`awb_no` varchar(50) NOT NULL,
	`supplier_id` varchar(36),
	`product_name` varchar(255) NOT NULL,
	`courier` varchar(100),
	`qty` int NOT NULL DEFAULT 1,
	`currency` varchar(10) DEFAULT 'INR',
	`status` varchar(50) NOT NULL,
	`order_account` varchar(255),
	`channel_order_date` datetime,
	`order_date` datetime,
	`delivered_date` datetime,
	`rts_date` datetime,
	`unit_price` decimal(10,2),
	`line_amount` decimal(10,2),
	`hsn` varchar(50),
	`file_id` varchar(36),
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	`previous_status` varchar(50),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_entries` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`supplier_id` varchar(36),
	`product_name` varchar(255) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'INR',
	`price` decimal(10,2) NOT NULL,
	`price_before_gst` decimal(10,2) NOT NULL,
	`gst_rate` decimal(5,2) NOT NULL DEFAULT '18.00',
	`hsn` varchar(50) NOT NULL,
	`effective_from` datetime NOT NULL,
	`effective_to` datetime,
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `price_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`name` varchar(255) NOT NULL,
	`supplier_id` varchar(36),
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reconciliation_log` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`awb_no` varchar(50) NOT NULL,
	`order_id` varchar(36),
	`previous_status` varchar(50),
	`new_status` varchar(50) NOT NULL,
	`impact` decimal(10,2) NOT NULL,
	`note` text,
	`timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `reconciliation_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`name` varchar(255) NOT NULL,
	`order_account` varchar(255),
	`gstin` varchar(15),
	`trade_name` varchar(255),
	`address` text,
	`ship_to_address` text,
	`place_of_supply` varchar(100),
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`),
	CONSTRAINT `suppliers_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `uploaded_files` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`filename` varchar(255) NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`size` int NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
	`data` json,
	`column_mapping` json,
	`processed_data` json,
	`summary` json,
	CONSTRAINT `uploaded_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`username` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_file_id_uploaded_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `uploaded_files`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_entries` ADD CONSTRAINT `price_entries_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reconciliation_log` ADD CONSTRAINT `reconciliation_log_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;