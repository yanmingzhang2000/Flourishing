DELETE FROM weekly_plans WHERE user_id = 31 AND start_date < '2026-09-28';
DELETE FROM weekly_plans WHERE user_id = 31 AND start_date > '2026-11-09';
SELECT 'Remaining plans:' as info, COUNT(*) as count FROM weekly_plans WHERE user_id = 31;
SELECT start_date, week_number FROM weekly_plans WHERE user_id = 31 ORDER BY start_date;
