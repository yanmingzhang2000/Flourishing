-- 先检查第5周的数据
SELECT id, days FROM weekly_plans WHERE user_id = 31 AND start_date = '2026-10-26';

-- 复制第5周的训练模式，生成第6周 (2026-11-02)
INSERT INTO weekly_plans (user_id, week_number, start_date, days) 
SELECT 31, 1, '2026-11-02', days 
FROM weekly_plans 
WHERE user_id = 31 AND start_date = '2026-10-26' 
LIMIT 1;

-- 验证插入结果
SELECT start_date, week_number FROM weekly_plans WHERE user_id = 31 ORDER BY start_date;
