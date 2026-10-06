import db from './src/config/database';

const exercises = db.prepare(`
  SELECT exercise_id, name, category, difficulty 
  FROM exercises 
  WHERE target_projects LIKE ?
`).all('%trap_relax%') as any[];

console.log('trap_relax 动作总数:', exercises.length);
console.log('\n按类别统计:');

const byCategory: Record<string, any[]> = {};
exercises.forEach(e => {
  if (!byCategory[e.category]) byCategory[e.category] = [];
  byCategory[e.category].push(e);
});

Object.keys(byCategory).sort().forEach(cat => {
  console.log(`\n${cat}: ${byCategory[cat].length}个`);
  byCategory[cat].forEach(e => {
    console.log(`  - ${e.name} (D${e.difficulty})`);
  });
});

const strength = exercises.filter(e => e.category === 'strength');
console.log('\n结论: strength动作', strength.length, '个，', strength.length >= 3 ? '✅ 足够生成计划' : '❌ 不足');
