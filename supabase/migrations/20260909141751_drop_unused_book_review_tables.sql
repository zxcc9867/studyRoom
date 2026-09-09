-- User approved permanent removal of the unused Book/Review tables and their data.
-- RESTRICT prevents unrelated dependent objects from being removed.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE IF EXISTS public."Review" RESTRICT;
DROP TABLE IF EXISTS public."Book" RESTRICT;
