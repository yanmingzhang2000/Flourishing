import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BottomNav } from '@/components/BottomNav';
import { userApi, recordsApi, plansApi, clearToken } from '@/lib/api';

// ── 静态数据（与 IntakePage 保持一致）────────────────────────────────────────

const EXPERIENCE_OPTIONS = [
  { value: 'zero',       emoji: '🌱', label: '零基础',  desc: '从没运动过，从头开始' },
  { value: 'occasional', emoji: '🚶', label: '偶尔练',  desc: '每周 1-2 次，断断续续' },
  { value: 'regular',    emoji: '💪', label: '经常练',  desc: '每周 3 次以上，有习惯' },
];

const EQUIPMENT_TOP = [
  { value: 'none',            emoji: '🤸', label: '自重',   desc: '不需要任何器械' },
  { value: 'dumbbell',        emoji: '🏋️', label: '哑铃',   desc: '选择后指定重量' },
  { value: 'resistance_band', emoji: '🎯', label: '弹力带', desc: '便携阻力训练' },
];

const DUMBBELL_WEIGHTS = [
  { value: 'dumbbell_1kg_pair',   label: '1kg × 2' },
  { value: 'dumbbell_1.5kg_pair', label: '1.5kg × 2' },
  { value: 'dumbbell_2kg_pair',   label: '2kg × 2' },
  { value: 'dumbbell_3kg_pair',   label: '3kg × 2' },
  { value: 'dumbbell_4kg_pair',   label: '4kg × 2' },
  { value: 'dumbbell_5kg_pair',   label: '5kg × 2' },
];

const INJURY_OPTIONS = [
  { value: 'shoulder', label: '肩部' },
  { value: 'elbow',    label: '肘部' },
  { value: 'wrist',    label: '腕部' },
  { value: 'knee',     label: '膝盖' },
  { value: 'back',     label: '腰背' },
];

const WEEK_DAYS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' },
];

// ── 基础 Tab 表单状态 ─────────────────────────────────────────────────────────

interface BasicForm {
  displayName: string;
  age: string;
  height: string;
  weight: string;
}

// ── 训练设置 Tab 表单状态 ──────────────────────────────────────────────────────

interface TrainingForm {
  experience: string;
  equipment: string[];
  injuries: string[];
  trainingDays: number[];
  sessionMaxMin: number;
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'basic' | 'training'>('basic');
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<{ totalWorkouts: number; currentStreak: number } | null>(null);

  // 基础信息表单
  const [basicForm, setBasicForm] = useState<BasicForm>({ displayName: '', age: '', height: '', weight: '' });
  const [basicSaving, setBasicSaving] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);
  const [basicSaved, setBasicSaved] = useState(false);

  // 训练设置表单
  const [trainingForm, setTrainingForm] = useState<TrainingForm>({
    experience: 'zero',
    equipment: [],
    injuries: [],
    trainingDays: [],
    sessionMaxMin: 30,
  });
  const [trainingSaving, setTrainingSaving] = useState(false);
  const [trainingSaved, setTrainingSaved] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [dumbbellExpanded, setDumbbellExpanded] = useState(false);

  useEffect(() => {
    Promise.all([userApi.getProfile(), recordsApi.getStats()])
      .then(([p, s]) => {
        setProfile(p);
        setStats(s);
        if (p) {
          setBasicForm({
            displayName: p.display_name || '',
            age: p.age ? String(p.age) : '',
            height: p.height ? String(p.height) : '',
            weight: p.weight ? String(p.weight) : '',
          });
          const equipment: string[] = Array.isArray(p.equipment) ? p.equipment : [];
          setTrainingForm({
            experience: p.experience || 'zero',
            equipment,
            injuries: Array.isArray(p.injuries) ? p.injuries : [],
            trainingDays: Array.isArray(p.training_days) ? p.training_days : [],
            sessionMaxMin: p.session_max_min || 30,
          });
          // 若 equipment 含哑铃则展开重量面板
          if (equipment.some(e => e.startsWith('dumbbell'))) setDumbbellExpanded(true);
        }
      })
      .catch(() => navigate('/auth'));
  }, [navigate]);

  // ── 基础信息保存 ─────────────────────────────────────────────────────────────

  const handleBasicSave = async () => {
    setBasicSaving(true);
    setBasicError(null);
    try {
      await userApi.updateProfile({
        display_name: basicForm.displayName || undefined,
        age: basicForm.age ? Number(basicForm.age) : undefined,
        height: basicForm.height ? Number(basicForm.height) : undefined,
        weight: basicForm.weight ? Number(basicForm.weight) : undefined,
      });
      const updated = await userApi.getProfile();
      setProfile(updated);
      setBasicSaved(true);
      setTimeout(() => setBasicSaved(false), 2000);
    } catch {
      setBasicError('保存失败，请检查网络后重试');
    } finally {
      setBasicSaving(false);
    }
  };

  // ── 训练设置保存 ─────────────────────────────────────────────────────────────

  const handleTrainingSave = async () => {
    setTrainingSaving(true);
    setTrainingError(null);
    try {
      await userApi.updateProfile({
        experience: trainingForm.experience,
        equipment: trainingForm.equipment,
        injuries: trainingForm.injuries,
        training_days: trainingForm.trainingDays,
        max_days_per_week: trainingForm.trainingDays.length,
        session_max_min: trainingForm.sessionMaxMin,
      });
      // 训练设置变了，重新生成本周计划
      await plansApi.generate();
      const updated = await userApi.getProfile();
      setProfile(updated);
      setTrainingSaved(true);
      setTimeout(() => setTrainingSaved(false), 2000);
    } catch {
      setTrainingError('保存失败，请检查网络后重试');
    } finally {
      setTrainingSaving(false);
    }
  };

  // ── 器械切换逻辑 ─────────────────────────────────────────────────────────────

  const hasDumbbell = trainingForm.equipment.some(e => e.startsWith('dumbbell'));
  const selectedDumbbell = trainingForm.equipment.find(e => e.startsWith('dumbbell')) || null;

  const toggleTopEquip = (value: string) => {
    if (value === 'dumbbell') {
      if (hasDumbbell) {
        setTrainingForm(f => ({ ...f, equipment: f.equipment.filter(e => !e.startsWith('dumbbell')) }));
        setDumbbellExpanded(false);
      } else {
        setDumbbellExpanded(true);
      }
    } else {
      setTrainingForm(f => ({
        ...f,
        equipment: f.equipment.includes(value)
          ? f.equipment.filter(e => e !== value)
          : [...f.equipment, value],
      }));
    }
  };

  const selectDumbbellWeight = (weight: string) => {
    setTrainingForm(f => ({
      ...f,
      equipment: [...f.equipment.filter(e => !e.startsWith('dumbbell')), weight],
    }));
  };

  const toggleDay = (d: number) => {
    setTrainingForm(f => ({
      ...f,
      trainingDays: f.trainingDays.includes(d)
        ? f.trainingDays.filter(x => x !== d)
        : [...f.trainingDays, d],
    }));
  };

  // ── 加载中 ───────────────────────────────────────────────────────────────────

  if (!profile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const bmi = profile.bmi ? Number(profile.bmi).toFixed(1) : null;
  const bmiLabel = bmi
    ? Number(bmi) < 18.5 ? '偏瘦' : Number(bmi) < 24 ? '正常' : Number(bmi) < 28 ? '偏重' : '偏胖'
    : null;

  // ── 渲染 ─────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white pb-24">

      {/* 顶部：头像 + 统计 */}
      <div className="px-5 pt-10 pb-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {(profile.display_name || '我')[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-text truncate">
              {profile.display_name || '未设置昵称'}
            </h1>
            <p className="text-sm text-muted mt-0.5">
              {profile.experience === 'zero' ? '零基础' : profile.experience === 'occasional' ? '偶尔练' : '经常练'}
              {' · '}每周 {profile.training_days ? (Array.isArray(profile.training_days) ? profile.training_days.length : profile.max_days_per_week) : profile.max_days_per_week || '--'} 天
            </p>
          </div>
        </div>

        {/* 统计小卡片 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl p-3 bg-ice-light text-center">
            <div className="text-2xl font-bold text-brand">{stats?.totalWorkouts ?? 0}</div>
            <div className="text-xs text-muted mt-0.5">累计完成</div>
          </div>
          <div className="rounded-2xl p-3 bg-ice-light text-center">
            <div className="text-2xl font-bold text-brand">{stats?.currentStreak ?? 0}</div>
            <div className="text-xs text-muted mt-0.5">连续天数</div>
          </div>
          <div className="rounded-2xl p-3 bg-ice-light text-center">
            <div className="text-2xl font-bold text-text">{bmi ?? '--'}</div>
            <div className="text-xs text-muted mt-0.5">{bmiLabel ?? 'BMI'}</div>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="px-5 mb-5">
        <div className="bg-subtle rounded-2xl p-1 flex gap-1">
          {(['basic', 'training'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all
                ${tab === t ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-text'}`}
            >
              {t === 'basic' ? '基础信息' : '训练设置'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 space-y-5">

        {/* ── Tab 1：基础信息 ──────────────────────────────────────────────── */}
        {tab === 'basic' && (
          <div className="space-y-4">
            <Input id="displayName" label="昵称" placeholder="你的名字"
              value={basicForm.displayName}
              onChange={e => setBasicForm(f => ({ ...f, displayName: e.target.value }))} />
            <Input id="age" label="年龄" type="number" placeholder="25"
              value={basicForm.age}
              onChange={e => setBasicForm(f => ({ ...f, age: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input id="height" label="身高 cm" type="number" placeholder="160"
                value={basicForm.height}
                onChange={e => setBasicForm(f => ({ ...f, height: e.target.value }))} />
              <Input id="weight" label="体重 kg" type="number" placeholder="50"
                value={basicForm.weight}
                onChange={e => setBasicForm(f => ({ ...f, weight: e.target.value }))} />
            </div>
            {bmi && (
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-brand-light">
                <span className="text-sm text-brand font-medium">BMI</span>
                <span className="font-bold text-brand">{bmi} · {bmiLabel}</span>
              </div>
            )}
            <Button onClick={handleBasicSave} className="w-full" disabled={basicSaving}>
              {basicSaving ? '保存中…' : basicSaved ? '已保存 ✓' : '保存基础信息'}
            </Button>
            {basicError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {basicError}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2：训练设置 ──────────────────────────────────────────────── */}
        {tab === 'training' && (
          <div className="space-y-6">

            {/* 运动经验 */}
            <div>
              <p className="text-sm font-semibold text-text mb-3">运动经验</p>
              <div className="space-y-2">
                {EXPERIENCE_OPTIONS.map(opt => {
                  const active = trainingForm.experience === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTrainingForm(f => ({ ...f, experience: opt.value }))}
                      className={`w-full text-left rounded-2xl px-4 py-3 flex items-center gap-3 transition-all border-l-4
                        ${active ? 'bg-brand-light border-brand' : 'bg-subtle border-transparent hover:border-gray-200'}`}
                    >
                      <span className="text-xl w-7 text-center">{opt.emoji}</span>
                      <div className="flex-1">
                        <div className={`font-semibold text-sm ${active ? 'text-brand' : 'text-text'}`}>{opt.label}</div>
                        <div className="text-xs text-muted">{opt.desc}</div>
                      </div>
                      {active && (
                        <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 可用器械 */}
            <div>
              <p className="text-sm font-semibold text-text mb-3">可用器械</p>
              <div className="space-y-2">
                {EQUIPMENT_TOP.map(opt => {
                  const active = opt.value === 'dumbbell' ? hasDumbbell : trainingForm.equipment.includes(opt.value);
                  return (
                    <div key={opt.value}>
                      <button
                        onClick={() => toggleTopEquip(opt.value)}
                        className={`w-full text-left rounded-2xl px-4 py-3 flex items-center gap-3 transition-all border-l-4
                          ${active ? 'bg-brand-light border-brand' : 'bg-subtle border-transparent hover:border-gray-200'}`}
                      >
                        <span className="text-xl w-7 text-center">{opt.emoji}</span>
                        <div className="flex-1">
                          <div className={`font-semibold text-sm ${active ? 'text-brand' : 'text-text'}`}>{opt.label}</div>
                          <div className="text-xs text-muted">
                            {opt.value === 'dumbbell' && hasDumbbell && selectedDumbbell
                              ? `已选：${DUMBBELL_WEIGHTS.find(w => w.value === selectedDumbbell)?.label}`
                              : opt.desc}
                          </div>
                        </div>
                        {active && (
                          <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                      {opt.value === 'dumbbell' && (hasDumbbell || dumbbellExpanded) && (
                        <div className="mt-2 ml-10 p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-xs text-muted mb-2">选择你的哑铃重量（单个）</p>
                          <div className="grid grid-cols-3 gap-2">
                            {DUMBBELL_WEIGHTS.map(w => (
                              <button
                                key={w.value}
                                onClick={() => selectDumbbellWeight(w.value)}
                                className={`py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                                  selectedDumbbell === w.value
                                    ? 'border-brand bg-brand text-white'
                                    : 'border-gray-200 bg-white text-text hover:border-brand/50'
                                }`}
                              >
                                {w.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 伤病 */}
            <div>
              <p className="text-sm font-semibold text-text mb-1">伤病情况</p>
              <p className="text-xs text-muted mb-3">有选择的动作会自动过滤</p>
              <div className="flex flex-wrap gap-2">
                {INJURY_OPTIONS.map(opt => {
                  const active = trainingForm.injuries.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTrainingForm(f => ({
                        ...f,
                        injuries: active ? f.injuries.filter(i => i !== opt.value) : [...f.injuries, opt.value],
                      }))}
                      className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${
                        active ? 'border-brand bg-brand-light text-brand' : 'border-gray-200 text-muted hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 训练日 */}
            <div>
              <p className="text-sm font-semibold text-text mb-1">训练日</p>
              <p className="text-xs text-muted mb-3">已选 {trainingForm.trainingDays.length} 天</p>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEK_DAYS.map(w => {
                  const active = trainingForm.trainingDays.includes(w.value);
                  return (
                    <button
                      key={w.value}
                      onClick={() => toggleDay(w.value)}
                      className={`aspect-square rounded-xl flex items-center justify-center font-bold text-sm transition-all border-2 ${
                        active
                          ? 'border-brand bg-brand text-white'
                          : 'border-gray-200 bg-white text-text hover:border-brand/50'
                      }`}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 单次时长 */}
            <div>
              <p className="text-sm font-semibold text-text mb-3">单次最长时长</p>
              <div className="grid grid-cols-3 gap-2">
                {[20, 30, 45].map(m => (
                  <button
                    key={m}
                    onClick={() => setTrainingForm(f => ({ ...f, sessionMaxMin: m }))}
                    className={`py-3.5 rounded-xl border-2 text-center font-semibold text-sm transition-all ${
                      trainingForm.sessionMaxMin === m
                        ? 'border-brand bg-brand text-white'
                        : 'border-gray-200 bg-white text-text hover:border-brand/50'
                    }`}
                  >
                    {m} 分钟
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleTrainingSave} className="w-full" disabled={trainingSaving}>
              {trainingSaving ? '保存并更新计划…' : trainingSaved ? '已保存 ✓' : '保存训练设置'}
            </Button>
            {trainingError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {trainingError}
              </div>
            )}
            <p className="text-xs text-muted text-center -mt-3">保存后将自动重新生成本周计划</p>
          </div>
        )}

        {/* 退出登录 */}
        <Button variant="outline" onClick={() => { clearToken(); navigate('/auth'); }} className="w-full text-muted">
          退出登录
        </Button>
        <div className="h-2" />
      </div>

      <BottomNav />
    </div>
  );
};
