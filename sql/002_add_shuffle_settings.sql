-- ===================================
-- Shuffle Settings Migration
-- Run this in cPanel phpMyAdmin SQL tab
-- ===================================

-- Add shuffle_questions column if it doesn't exist
ALTER TABLE exams ADD COLUMN shuffle_questions BOOLEAN DEFAULT FALSE COMMENT 'Shuffle question order for each student';

-- Add shuffle_options column if it doesn't exist  
ALTER TABLE exams ADD COLUMN shuffle_options BOOLEAN DEFAULT FALSE COMMENT 'Shuffle answer options for each question';

-- Verify the columns were added
DESC exams;
