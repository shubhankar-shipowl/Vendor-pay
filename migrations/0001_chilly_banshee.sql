CREATE TABLE `supplier_emails` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`supplier_id` varchar(36),
	`email` varchar(255) NOT NULL,
	`supplier_name` varchar(255) NOT NULL,
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplier_emails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `supplier_emails` ADD CONSTRAINT `supplier_emails_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;