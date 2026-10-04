import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { userApi, clearToken } from '@/lib/api';

// ── 静态数据 ─────────────────────────────────────────────────────────────────

const EXPERIENCE_OPTIONS = [
  { value: 'zero',       emoji: '🌱', label: '零基础',  desc: '从没运动过，从头开始' },
  { value: 'occasional', emoji: '🚶', label: '偶尔练',  desc: '每周 1-2 次，断断续续' },
  { value: 'regular',    emoji: '💪', label: '经常练',  desc: '每周 3 次以上，有习惯' },
];

const EQUIPMENT_TOP = [
  { value: 'bodyweight',      emoji: '🤸', label: '纯自重', desc: '仅用身体重量，零门槛' },
  { value: 'dumbbell',        emoji: '🏋️', label: '哑铃',   desc: '可选择多个重量' },
  { value: 'resistance_band', emoji: '🎯', label: '弹力带', desc: '便携阻力训练' },
  { value: 'mat',             emoji: '🧘', label: '瑜伽垫', desc: '地面动作必备' },
  { value: 'foam_roller',     emoji: '💆', label: '泡沫轴', desc: '肌肉放松工具' },
  { value: 'yoga_ball_55',    emoji: '⚽', label: '瑜伽球', desc: '平衡训练辅助' },
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
  { value: 'neck',     label: '颈部' },
];

// ISO 星期约定：0=周一 … 6=周日（与服务端 plan-engine / user.ts 一致）
const WEEK_DAYS = [
  { value: 0, label: '一' },
  { value: 1, label: '二' },
  { value: 2, label: '三' },
  { value: 3, label: '四' },
  { value: 4, label: '五' },
  { value: 5, label: '六' },
  { value: 6, label: '日' },
];

type TabKey = 'body' | 'background' | 'equipment' | 'schedule';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'body',       label: '身体信息' },
  { key: 'background', label: '训练背景' },
  { key: 'equipment',  label: '可用器械' },
  { key: 'schedule',   label: '训练偏好' },
];

interface FormState {
  // 身体信息
  displayName: string;
  age: string;
  height: string;
  weight: string;
  // 训练背景
  experience: string;
  injuries: string[];
  // 器械
  equipment: string[];
  // 训练偏好
  trainingDays: number[];
  sessionMaxMin: number;
}

// ── 引导模式时使用的步骤顺序（首次设置） ────────────────────────────────────
const ONBOARDING_STEPS: TabKey[] = ['background', 'equipment', 'schedule'];

// ── 主组件 ───────────────────────────────────────────────────────────────────

interface SettingsPageProps {
  /** 传 true 时以引导步骤模式运行（首次设置），结束后跳转 /projects */
  onboarding?: boolean;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onboarding = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  // 普通设置页从 URL query ?tab=xxx 决定初始 Tab
  const queryTab = new URLSearchParams(location.search).get('tab') as TabKey | null;

  const [tab, setTab] = useState<TabKey>(() => {
    if (onboarding) return ONBOARDING_STEPS[0];
    return queryTab || 'body';
  });
  const [onboardingStep, setOnboardingStep] = useState(0); // 引导模式当前步骤索引

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dumbbellExpanded, setDumbbellExpanded] = useState(false);

  const [form, setForm] = useState<FormState>({
    displayName: '',
    age: '',
    height: '',
    weight: '',
    experience: 'zero',
    injuries: [],
    equipment: [],
    trainingDays: [],
    sessionMaxMin: 30,
  });

  useEffect(() => {
    userApi.getProfile()
      .then(p => {
        setProfile(p);
        if (p) {
          const equipment: string[] = Array.isArray(p.equipment) ? p.equipment : [];
          setForm({
            displayName: p.display_name || '',
            age: p.age ? String(p.age) : '',
            height: p.height ? String(p.height) : '',
            weight: p.weight ? String(p.weight) : '',
            experience: p.experience || 'zero',
            injuries: Array.isArray(p.injuries) ? p.injuries : [],
            equipment,
            trainingDays: Array.isArray(p.training_days) ? p.training_days : [],
            sessionMaxMin: p.session_max_min || 30,
          });
          if (equipment.some(e => e.startsWith('dumbbell'))) setDumbbellExpanded(true);
        }
      })
      .catch(() => navigate('/auth'))
      .finally(() => setLoading(false));
  }, [navigate]);

  const update = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  // ── 器械逻辑 ──────────────────────────────────────────────────────────────

  const hasBodyweight = form.equipment.includes('bodyweight');
  const hasDumbbell = form.equipment.some(e => e.startsWith('dumbbell'));
  const selectedDumbbells = form.equipment.filter(e => e.startsWith('dumbbell'));

  const toggleEquip = (value: string) => {
    if (value === 'bodyweight') {
      // 选择"自重"时，清空所有其他装备
      if (hasBodyweight) {
        update({ equipment: [] });
      } else {
        update({ equipment: ['bodyweight'] });
        setDumbbellExpanded(false);
      }
    } else if (value === 'dumbbell') {
      // 选择"哑铃"时，先取消"自重"，然后展开重量选择
      if (hasDumbbell) {
        update({ equipment: form.equipment.filter(e => !e.startsWith('dumbbell')) });
        setDumbbellExpanded(false);
      } else {
        // 取消"自重"
        const newEquipment = form.equipment.filter(e => e !== 'bodyweight');
        update({ equipment: newEquipment });
        setDumbbellExpanded(true);
      }
    } else {
      // 选择"弹力带"等其他装备时，先取消"自重"
      const cur = form.equipment.filter(e => e !== 'bodyweight');
      update({ equipment: cur.includes(value) ? cur.filter(e => e !== value) : [...cur, value] });
    }
  };

  const selectDumbbellWeight = (weight: string) => {
    // 支持多选哑铃重量
    const otherDumbbells = form.equipment.filter(e => e.startsWith('dumbbell') && e !== weight);
    const otherEquipment = form.equipment.filter(e => !e.startsWith('dumbbell') && e !== 'bodyweight');
    
    if (selectedDumbbells.includes(weight)) {
      // 取消选择该重量
      update({ equipment: [...otherEquipment, ...otherDumbbells] });
    } else {
      // 添加该重量
      update({ equipment: [...otherEquipment, ...otherDumbbells, weight] });
    }
  };

  // ── 保存逻辑 ──────────────────────────────────────────────────────────────

  const buildPayload = () => ({
    display_name: form.displayName || undefined,
    age: form.age ? Number(form.age) : undefined,
    height: form.height ? Number(form.height) : undefined,
    weight: form.weight ? Number(form.weight) : undefined,
    experience: form.experience,
    injuries: form.injuries,
    equipment: form.equipment,
    training_days: form.trainingDays,
    max_days_per_week: form.trainingDays.length || undefined,
    session_max_min: form.sessionMaxMin,
  });

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await userApi.updateProfile(buildPayload());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('保存失败，请检查网络后重试');
    } finally {
      setSaving(false);
    }
  };

  // 引导模式下按步骤保存并推进
  const handleOnboardingNext = async () => {
    setSaving(true);
    setError(null);
    try {
      // 验证当前步骤
      const curTab = ONBOARDING_STEPS[onboardingStep];
      if (curTab === 'equipment' && form.equipment.length === 0) {
        setError('请至少选择一种器械');
        setSaving(false);
        return;
      }
      if (curTab === 'schedule' && form.trainingDays.length === 0) {
        setError('请至少选择一天训练日');
        setSaving(false);
        return;
      }
      await userApi.updateProfile(buildPayload());
      if (onboardingStep < ONBOARDING_STEPS.length - 1) {
        const nextStep = onboardingStep + 1;
        setOnboardingStep(nextStep);
        setTab(ONBOARDING_STEPS[nextStep]);
        setError(null);
      } else {
        // 最后一步：标记 onboarding 完成，跳转项目浏览页
        await userApi.updateProfile({ onboarding_completed: true });
        navigate('/projects');
      }
    } catch {
      setError('保存失败，请检查网络后重试');
    } finally {
      setSaving(false);
    }
  };

  // ── 加载中 ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const bmiVal = form.height && form.weight
    ? Number((Number(form.weight) / Math.pow(Number(form.height) / 100, 2)).toFixed(1))
    : profile?.bmi ? Number(profile.bmi).toFixed(1) : null;
  const bmiLabel = bmiVal
    ? Number(bmiVal) < 18.5 ? '偏瘦' : Number(bmiVal) < 24 ? '正常' : Number(bmiVal) < 28 ? '偏重' : '偏胖'
    : null;

  // ── 各 Tab 内容 ──────────────────────────────────────────────────────────

  const renderBody = () => (
    <div className="space-y-4">
      <Input id="displayName" label="昵称" placeholder="你的名字"
        value={form.displayName}
        onChange={e => update({ displayName: e.target.value })} />
      <Input id="age" label="年龄" type="number" placeholder="25"
        value={form.age}
        onChange={e => update({ age: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Input id="height" label="身高 cm" type="number" placeholder="160"
          value={form.height}
          onChange={e => update({ height: e.target.value })} />
        <Input id="weight" label="体重 kg" type="number" placeholder="50"
          value={form.weight}
          onChange={e => update({ weight: e.target.value })} />
      </div>
      {bmiVal && (
        <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-brand-light">
          <span className="text-sm text-brand font-medium">BMI</span>
          <span className="font-bold text-brand">{bmiVal} · {bmiLabel}</span>
        </div>
      )}
    </div>
  );

  const renderBackground = () => (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-text mb-3">运动经验</p>
        <div className="space-y-2">
          {EXPERIENCE_OPTIONS.map(opt => {
            const active = form.experience === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => update({ experience: opt.value })}
                className={`w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-4 transition-all shadow-sm
                  ${active ? 'bg-brand-light border-l-4 border-brand' : 'bg-white border-l-4 border-transparent hover:border-gray-200'}`}
              >
                <span className="text-2xl flex-shrink-0 w-8 text-center">{opt.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm ${active ? 'text-brand' : 'text-text'}`}>{opt.label}</div>
                  <div className="text-xs text-muted mt-0.5">{opt.desc}</div>
                </div>
                <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center
                  ${active ? 'bg-brand' : 'border-2 border-gray-200'}`}>
                  {active && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-text mb-1">伤病情况</p>
        <p className="text-xs text-muted mb-3">有选择的动作会自动过滤，可跳过</p>
        <div className="flex flex-wrap gap-2">
          {INJURY_OPTIONS.map(opt => {
            const active = form.injuries.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => update({ injuries: active ? form.injuries.filter(i => i !== opt.value) : [...form.injuries, opt.value] })}
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
    </div>
  );

  const renderEquipment = () => (
    <div className="space-y-3">
      <p className="text-xs text-muted px-1">
        💡 选择"纯自重"后，其他装备将自动取消；选择其他装备会自动取消"纯自重"
      </p>
      <div className="space-y-2">
      {EQUIPMENT_TOP.map(opt => {
        const active = opt.value === 'dumbbell' ? hasDumbbell : form.equipment.includes(opt.value);
        const disabled = hasBodyweight && opt.value !== 'bodyweight';
        return (
          <div key={opt.value}>
            <button
              onClick={() => toggleEquip(opt.value)}
              disabled={disabled}
              className={`w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-4 transition-all shadow-sm
                ${disabled ? 'bg-gray-100 border-l-4 border-transparent opacity-50 cursor-not-allowed' :
                  active ? 'bg-brand-light border-l-4 border-brand' : 'bg-white border-l-4 border-transparent hover:border-gray-200'}`}
            >
              <span className="text-2xl flex-shrink-0 w-8 text-center">{opt.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold text-sm ${active ? 'text-brand' : 'text-text'}`}>{opt.label}</div>
                <div className="text-xs text-muted mt-0.5">
                  {opt.value === 'dumbbell' && hasDumbbell && selectedDumbbells.length > 0
                    ? `已选：${selectedDumbbells.map(d => DUMBBELL_WEIGHTS.find(w => w.value === d)?.label).filter(Boolean).join(', ')}`
                    : opt.desc}
                </div>
              </div>
              {/* 哑铃：展开/收起指示器或勾选标记；其他装备：勾选标记 */}
              <div className="flex-shrink-0 flex items-center justify-center w-5 h-5">
                {opt.value === 'dumbbell' ? (
                  // 哑铃特殊处理
                  hasDumbbell && selectedDumbbells.length > 0 ? (
                    // 已选中重量：显示勾选标记
                    <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    // 未选中或已展开：显示箭头
                    <svg className="w-4 h-4 text-gray-400 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      style={{ transform: dumbbellExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  )
                ) : (
                  // 其他装备：标准勾选框
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center
                    ${active ? 'bg-brand' : 'border-2 border-gray-200'}`}>
                    {active && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
            </button>
            {opt.value === 'dumbbell' && (hasDumbbell || dumbbellExpanded) && (
              <div className="mt-2 ml-12 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs text-muted mb-2">选择你的哑铃重量（可多选）</p>
                <div className="grid grid-cols-3 gap-2">
                  {DUMBBELL_WEIGHTS.map(w => (
                    <button
                      key={w.value}
                      onClick={() => selectDumbbellWeight(w.value)}
                      className={`py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                        selectedDumbbells.includes(w.value)
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
  );

  const renderSchedule = () => (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-text mb-1">选择训练日</p>
        <p className="text-xs text-muted mb-4">可以随时修改</p>
        <div className="grid grid-cols-7 gap-2">
          {WEEK_DAYS.map(w => {
            const active = form.trainingDays.includes(w.value);
            return (
              <button
                key={w.value}
                onClick={() => update({ trainingDays: active ? form.trainingDays.filter(d => d !== w.value) : [...form.trainingDays, w.value] })}
                className={`aspect-square rounded-xl flex items-center justify-center font-bold text-sm transition-all border-2 ${
                  active ? 'border-brand bg-brand text-white' : 'border-gray-200 bg-white text-text hover:border-brand/50'
                }`}
              >
                {w.label}
              </button>
            );
          })}
        </div>
        {form.trainingDays.length > 0 && (
          <p className="text-xs text-brand mt-2 text-center">已选 {form.trainingDays.length} 天</p>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-text mb-3">单次最长时长</p>
        <div className="grid grid-cols-3 gap-2">
          {[20, 30, 45].map(m => (
            <button
              key={m}
              onClick={() => update({ sessionMaxMin: m })}
              className={`py-3.5 rounded-xl border-2 text-center font-semibold text-sm transition-all ${
                form.sessionMaxMin === m
                  ? 'border-brand bg-brand text-white'
                  : 'border-gray-200 bg-white text-text hover:border-brand/50'
              }`}
            >
              {m} 分钟
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const tabContent: Record<TabKey, React.ReactNode> = {
    body: renderBody(),
    background: renderBackground(),
    equipment: renderEquipment(),
    schedule: renderSchedule(),
  };

  // ── 引导模式 ─────────────────────────────────────────────────────────────

  if (onboarding) {
    const stepLabels = ['训练背景', '可用器械', '训练安排'];
    return (
      <div className="min-h-screen bg-surface">
        {/* Banner */}
        <div className="bg-gradient-to-r from-brand to-emerald-500 text-white py-12 px-4">
          <div className="max-w-md mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2C8 2 4 6 4 10c0 6 8 12 8 12s8-6 8-12c0-4-4-8-8-8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold">Flourish AI</h1>
            </div>
            <p className="text-white/80 text-sm">让我们先了解你一点点</p>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4">
          {/* 步骤指示 */}
          <div className="flex items-center justify-center gap-2 py-8">
            {stepLabels.map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex items-center justify-center rounded-full text-xs font-bold transition-all ${
                  i < onboardingStep   ? 'w-6 h-6 bg-brand text-white' :
                  i === onboardingStep ? 'w-7 h-7 bg-brand text-white ring-4 ring-brand/20' :
                                         'w-6 h-6 bg-gray-200 text-gray-400'
                }`}>{i < onboardingStep ? '✓' : i + 1}</div>
                {i < stepLabels.length - 1 && (
                  <div className={`w-8 h-0.5 rounded-full ${i < onboardingStep ? 'bg-brand' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-bold text-text">{stepLabels[onboardingStep]}</h2>
          </div>

          {tabContent[ONBOARDING_STEPS[onboardingStep]]}

          {error && (
            <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}

          <div className="flex gap-3 mt-8">
            {onboardingStep > 0 && (
              <Button variant="outline" onClick={() => { setOnboardingStep(s => s - 1); setTab(ONBOARDING_STEPS[onboardingStep - 1]); }} className="flex-1">
                上一步
              </Button>
            )}
            <Button onClick={handleOnboardingNext} className="flex-1" disabled={saving}>
              {saving ? '保存中…' : onboardingStep < ONBOARDING_STEPS.length - 1 ? '下一步' : '选择训练项目 →'}
            </Button>
          </div>
          <div className="h-8" />
        </div>
      </div>
    );
  }

  // ── 普通设置页 ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-subtle pb-10">
      {/* Header */}
      <div className="bg-brand px-8 pt-12 pb-5">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="返回"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">设置</h1>
        </div>
      </div>

      {/* 内容区 */}
      <div className="max-w-3xl mx-auto px-8">
        {/* Tab 切换 */}
        <div className="pt-6 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all
                  ${tab === t.key ? 'bg-brand text-white' : 'bg-white text-muted hover:text-text shadow-sm'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 space-y-5">
          {tabContent[tab]}

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} className="flex-1" disabled={saving}>
              {saving ? '保存中…' : saved ? '已保存 ✓' : '保存设置'}
            </Button>
            <Button
              variant="outline"
              onClick={() => { clearToken(); navigate('/auth'); }}
              className="text-muted"
            >
              退出登录
            </Button>
          </div>
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
};
