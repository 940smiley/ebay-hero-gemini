export const POSTGRESQL_SCHEMA_SQL = `-- ==============================================================================
-- eBay Hero Gemini Edition - Enterprise PostgreSQL Relational Database Schema
-- Built for 1,000,000+ images, batch checkpoints, and eBay inventory automation
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. USERS & ACCOUNTS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'seller' CHECK (role IN ('admin', 'seller', 'curator', 'viewer')),
    google_drive_root_path VARCHAR(1024),
    drive_mode VARCHAR(20) DEFAULT 'stream' CHECK (drive_mode IN ('stream', 'mirror', 'custom')),
    gemini_model_preference VARCHAR(100) DEFAULT 'gemini-3.8-flash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. PROJECTS / LIBRARIES
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_storage_path VARCHAR(1024) NOT NULL,
    naming_convention VARCHAR(255) DEFAULT '[YEAR]_[BRAND]_[SUBJECT]_[VARIANT]_[NUM]',
    total_images_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. IMAGES
CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    original_filename VARCHAR(512) NOT NULL,
    original_path VARCHAR(1024) NOT NULL,
    current_path VARCHAR(1024) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    checksum_sha256 VARCHAR(64),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'approved', 'rejected', 'renamed', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_images_project_status ON images(project_id, status);
CREATE INDEX IF NOT EXISTS idx_images_checksum ON images(checksum_sha256);

-- 5. IMAGE ANALYSES (GEMINI VISION & OCR)
CREATE TABLE IF NOT EXISTS image_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE UNIQUE,
    object_type VARCHAR(100),
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    brand_or_manufacturer VARCHAR(150),
    product_name VARCHAR(255),
    model_or_card_number VARCHAR(100),
    year_or_era VARCHAR(50),
    condition_rating VARCHAR(100),
    grader VARCHAR(50),
    grade_number VARCHAR(50),
    cert_number VARCHAR(100),
    is_autographed BOOLEAN DEFAULT FALSE,
    is_holo_or_foil BOOLEAN DEFAULT FALSE,
    confidence_score NUMERIC(5, 2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
    reasoning TEXT,
    ocr_raw_text TEXT,
    visible_features JSONB DEFAULT '[]'::jsonb,
    estimated_val_low NUMERIC(10, 2),
    estimated_val_median NUMERIC(10, 2),
    estimated_val_high NUMERIC(10, 2),
    ai_model_used VARCHAR(100) NOT NULL,
    raw_ai_payload JSONB,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_analyses_category ON image_analyses(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_analyses_cert ON image_analyses(cert_number);

-- 6. INVENTORY ITEMS (COLLECTIBLES CATALOG)
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    primary_image_id UUID REFERENCES images(id) ON DELETE SET NULL,
    sku VARCHAR(100) UNIQUE,
    item_title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),
    cost_basis_usd NUMERIC(10, 2) DEFAULT 0.00,
    list_price_usd NUMERIC(10, 2),
    floor_price_usd NUMERIC(10, 2),
    location_bin VARCHAR(100),
    status VARCHAR(50) DEFAULT 'unlisted' CHECK (status IN ('unlisted', 'listed', 'sold', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inventory_user_sku ON inventory_items(user_id, sku);

-- 7. EBAY LISTINGS
CREATE TABLE IF NOT EXISTS ebay_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    ebay_title VARCHAR(80) NOT NULL, -- strict eBay 80 char limit
    ebay_subtitle VARCHAR(255),
    primary_category_id VARCHAR(50) NOT NULL,
    primary_category_name VARCHAR(150),
    condition_id VARCHAR(20) NOT NULL,
    condition_descriptor TEXT,
    item_specifics JSONB NOT NULL DEFAULT '{}'::jsonb,
    search_keywords TEXT[],
    suggested_bin_price NUMERIC(10, 2),
    suggested_starting_bid NUMERIC(10, 2),
    listing_format VARCHAR(20) DEFAULT 'FixedPrice' CHECK (listing_format IN ('FixedPrice', 'Auction')),
    shipping_preset VARCHAR(150),
    description_html TEXT,
    ebay_draft_status VARCHAR(50) DEFAULT 'draft' CHECK (ebay_draft_status IN ('draft', 'ready', 'published', 'ended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. FOLDER PLANS & DIRECTORY RULES
CREATE TABLE IF NOT EXISTS folder_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    folder_template VARCHAR(512) NOT NULL, -- e.g. "Inventory/{Category}/{Subcategory}/{Year}"
    case_convention VARCHAR(50) DEFAULT 'UPPER_SNAKE',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. RENAME HISTORY & ROLLBACK
CREATE TABLE IF NOT EXISTS rename_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    previous_path VARCHAR(1024) NOT NULL,
    previous_filename VARCHAR(512) NOT NULL,
    new_path VARCHAR(1024) NOT NULL,
    new_filename VARCHAR(512) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reverted_at TIMESTAMP WITH TIME ZONE,
    execution_status VARCHAR(50) DEFAULT 'completed' CHECK (execution_status IN ('completed', 'reverted', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_rename_image ON rename_history(image_id);

-- 10. PROCESSING JOBS & CHECKPOINTS (10k+ scale recovery)
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    job_name VARCHAR(255) NOT NULL,
    total_items INTEGER NOT NULL,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'paused', 'completed', 'failed')),
    checkpoint_cursor INTEGER DEFAULT 0,
    last_processed_image_id UUID REFERENCES images(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. AUDIT LOGS (IMMUTABLE FORENSIC AUDITING)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL, -- 'ANALYSIS_COMPLETED', 'SCRIPT_GENERATED', 'BATCH_RENAME_EXECUTED', 'ROLLBACK_TRIGGERED'
    affected_table VARCHAR(100),
    record_id UUID,
    payload JSONB,
    client_ip VARCHAR(50),
    user_agent VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_event_time ON audit_logs(event_type, created_at);
`;
