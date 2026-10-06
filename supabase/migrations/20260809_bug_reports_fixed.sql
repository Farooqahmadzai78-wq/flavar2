-- ==========================================================
-- SQL Migration pour Supabase: Table bug_reports & RLS (FIXED)
-- ==========================================================
-- SECURITY FIXES:
-- 1. bug_reports.user_id changed from TEXT to UUID
-- 2. Added foreign key constraint to auth.users
-- 3. Fixed RLS policies to enforce user ownership
-- 4. Storage bucket made private with user-scoped access
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.bug_reports (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT DEFAULT NULL,
    title TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'autre',
    description TEXT NOT NULL,
    app_version TEXT DEFAULT '1.0.0',
    technical_info JSONB,
    attachment_url TEXT,
    status TEXT NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'en_cours', 'resolu', 'non_resolu')),
    developer_response TEXT,
    developer_response_at TIMESTAMPTZ
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON public.bug_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON public.bug_reports (user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports (status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_status ON public.bug_reports (user_id, status);

-- Enable Row Level Security
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- DROP old broken policies
DROP POLICY IF EXISTS "Anyone can submit bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Users can view own bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Users can view own bug reports or admin views all" ON public.bug_reports;
DROP POLICY IF EXISTS "Admin update bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Admin delete bug reports" ON public.bug_reports;

-- FIXED POLICIES:

-- 1. INSERT: Only authenticated users can submit their own bug reports
CREATE POLICY "Users can insert own bug reports" ON public.bug_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 2. SELECT: Users see only their own reports, service_role sees all
CREATE POLICY "Users can view own bug reports" ON public.bug_reports
    FOR SELECT
    USING (
        auth.role() = 'service_role'
        OR auth.uid() = user_id
    );

-- 3. UPDATE: Users update their own, admin updates any via service_role
CREATE POLICY "Users can update own bug reports" ON public.bug_reports
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. DELETE: Users delete their own, admin deletes any via service_role
CREATE POLICY "Users can delete own bug reports" ON public.bug_reports
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Grants
GRANT SELECT, INSERT ON public.bug_reports TO authenticated;
GRANT ALL ON public.bug_reports TO service_role;

-- ==========================================================
-- Storage Bucket for bug attachments (FIXED)
-- ==========================================================

-- Create private bucket for bug attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bug_attachments', 'bug_attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop old public policies
DROP POLICY IF EXISTS "Anyone can upload bug attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view bug attachments" ON storage.objects;

-- FIXED STORAGE POLICIES:
-- Note: Storage RLS uses auth.uid() for user context

-- 1. Users can upload files to their own folder
CREATE POLICY "Users can upload own bug attachments" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'bug_attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- 2. Users can view their own attachments
CREATE POLICY "Users can view own bug attachments" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'bug_attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- 3. Users can delete their own attachments
CREATE POLICY "Users can delete own bug attachments" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'bug_attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Service role can do everything
CREATE POLICY "Service role manages all bug attachments" ON storage.objects
    FOR ALL
    TO service_role
    USING (bucket_id = 'bug_attachments');
