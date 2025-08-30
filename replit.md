# Overview

This is an Accounts Payable & Reconciliation Assistant application designed to process vendor payout data and generate reconciliation reports. The system handles CSV/Excel file uploads, column mapping, price/HSN management, and automated payout calculations. It provides a comprehensive dashboard for managing vendor relationships, order processing, and financial reconciliation workflows.

**Latest Update (Aug 26, 2025):** Permanent File Processing Error Fix - Resolved "Processing Failed" issues with comprehensive error handling and hybrid storage strategy. Implemented smart file storage (memory for large files >10MB, database for small files), enhanced error messages for file session expiry, added 5-minute upload timeout with abort handling, file size warnings for large uploads, and automatic cleanup of temporary files. Users now receive clear guidance when files expire due to server restarts instead of generic error messages.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for development
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing with dedicated pages:
  - `/` - Main Dashboard with payout calculator and quick stats
  - `/data-management` - File upload, column mapping, and data transparency
  - `/price-management` - Price & HSN management with bulk operations
  - `/reports` - Reports generation and final payout summaries
  - `/supplier-performance` - Supplier metrics and performance analytics
- **Forms**: React Hook Form with Zod validation for type-safe form handling

## Backend Architecture
- **Runtime**: Node.js with Express.js REST API server
- **Language**: TypeScript with ES modules
- **File Processing**: Multer for multipart file uploads with memory storage
- **Data Processing**: Custom CSV/Excel parsing and normalization logic
- **Storage Interface**: Abstract storage layer with PostgreSQL database implementation via Drizzle ORM (IStorage interface)

## Database Design
- **Database**: PostgreSQL with Neon serverless
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Comprehensive relational model including:
  - Users and authentication
  - File uploads with metadata
  - Suppliers and products
  - Price entries with date ranges
  - Orders with status tracking
  - Reconciliation logs
- **Migration Strategy**: Drizzle Kit for schema migrations
- **Storage Implementation**: DrizzleStorage class replaces MemStorage for persistent data

## Data Processing Pipeline
- **Upload Flow**: File upload → CSV/Excel parsing → column mapping → data normalization
- **Reconciliation Logic**: Price/HSN lookup by supplier and date range → payout calculation → report generation
- **Status Management**: Order status filtering (cancelled orders excluded from payouts)
- **Currency Support**: Multi-currency handling with INR as default
- **Payout Calculation Engine**: Real-time supplier payout calculation based on:
  - Delivered/Completed order status filtering
  - Date range selection (DeliveredDate or OrderDate basis)
  - Unit price lookup from price entries
  - Line amount calculation (Qty × Unit Price)
  - Multi-format CSV export (Summary, Lines, Cancelled, Missing Prices)

## File Upload System
- **Storage**: Memory-based file storage with size limits (10MB)
- **Formats**: CSV and Excel file support with MIME type validation
- **Processing**: Real-time data preview and column detection
- **Security**: File type restrictions and upload size limits

## External Dependencies

- **Database**: Neon Database (PostgreSQL serverless)
- **Cloud Storage**: Google Cloud Storage integration for file persistence
- **File Upload**: Uppy.js dashboard for enhanced file upload UI with AWS S3 support
- **Component Library**: Radix UI for accessible component primitives
- **Development Tools**: Replit-specific plugins for development environment integration
- **Styling**: Google Fonts integration (Architects Daughter, DM Sans, Fira Code, Geist Mono)