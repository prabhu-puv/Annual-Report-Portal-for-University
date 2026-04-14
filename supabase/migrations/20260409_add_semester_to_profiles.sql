-- Add semester column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS semester VARCHAR(10);
