import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { userApi } from '@/lib/api';
import { UserProfile } from '@/lib/types';

// ── 数据定义 ──────────────────────────────────────────────────────────────────

const EXPERIENCE_OPTIONS = [
  { value: 'zero',       emoji: '🌱', label: '零基础',  desc: '从没运动过，从头开始' },
  { value: 'occasional', emoji: '🚶', label: '偶尔练',  desc: '每周 1-2 次，断断续续' },
  { value: 'regular',    emoji: '💪', label: '经常练',  desc: '每周 3 次以上，有习惯' },
];

// 顶层器械：自重、哑铃（可展开）、弹力带
const EQUIPMENT_TOP = [
  { value: 'none',            emoji: '🤸', label: '自重',   desc: '不需要任何器械' },
  { value: 'dumbbell',        emoji: '🏋️', label: '哑铃',   desc: '选择后指定重量' },
  { value: 'resistance_band', emoji: '🎯', label: '弹力带', desc: '便携阻力训练' },
];

// 哑铃重量子选项
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

type Prefs = Pick<UserProfile, 'experience' | 'injuries' | 'equipment' | 'maxTrainingDaysPerWeek' | 'singleSessionMaxMin' | 'trainingDays'>;

// 星期选择器数据（0=周日，1=周一…）
const WEEK_DAYS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' },
];

// ── 通用选项卡片 ──────────────────────────────────────────────────────────────

function OptionCard({
  emoji, label, desc, selected, onClick,
}: {
  emoji?: string; label: string; desc?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-4 transition-all shadow-sm
        ${selected
          ? 'bg-brand-light border-l-4 border-brand'
          : 'bg-white border-l-4 border-transparent hover:border-gray-200'
        }`}
    >
      {emoji && <span className="text-2xl flex-shrink-0 w-8 text-center">{emoji}</span>}
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm ${selected ? 'text-brand' : 'text-text'}`}>{label}</div>
        {desc && <div className="text-xs text-muted mt-0.5">{desc}</div>}
      </div>
      <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all
        ${selected ? 'bg-brand' : 'border-2 border-gray-200'}`}>
        {selected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </button>
  );
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

export const IntakePage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [prefs, setPrefs] = useState<Partial<Prefs>>({ singleSessionMaxMin: 30 });
  const [dumbbellExpanded, setDumbbellExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const update = (updates: Partial<Prefs>) => { setPrefs(prev => ({ ...prev, ...updates })); setErrors({}); };

  // 判断当前设备列表里是否包含哑铃（任意重量）
  const hasDumbbell = (prefs.equipment || []).some(e => e.startsWith('dumbbell'));
  // 当前选中的哑铃重量（只能选一个）
  const selectedDumbbell = (prefs.equipment || []).find(e => e.startsWith('dumbbell')) || null;

  const toggleTopEquip = (value: string) => {
    if (value === 'dumbbell') {
      if (hasDumbbell) {
        // 取消哑铃 → 移除所有哑铃重量，收起展开
        update({ equipment: (prefs.equipment || []).filter(e => !e.startsWith('dumbbell')) });
        setDumbbellExpanded(false);
      } else {
        // 勾选哑铃 → 展开重量选择
        setDumbbellExpanded(true);
      }
    } else {
      const cur = prefs.equipment || [];
      update({ equipment: cur.includes(value) ? cur.filter(e => e !== value) : [...cur, value] });
    }
  };

  const selectDumbbellWeight = (weight: string) => {
    const cur = (prefs.equipment || []).filter(e => !e.startsWith('dumbbell'));
    update({ equipment: [...cur, weight] });
  };

  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1 && !prefs.experience) e.experience = '请选择训练经验';
    if (s === 2 && (!prefs.equipment || !prefs.equipment.length)) e.equipment = '请至少选择一种器械';
    if (s === 2 && hasDumbbell && !selectedDumbbell) e.equipment = '请选择哑铃重量';
    if (s === 3 && (!prefs.trainingDays || prefs.trainingDays.length === 0)) e.days = '请至少选择一天';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validate(step)) return;
    if (step < 3) { setStep(step + 1); return; }
    handleSubmit();
  };

  const handleSubmit = async () => {
    setSaveError(null);
    setSubmitting(true);
    try {
      const trainingDays = prefs.trainingDays || [];
      await userApi.updateProfile({
        experience: prefs.experience!,
        injuries: prefs.injuries || [],
        equipment: prefs.equipment!,
        max_days_per_week: trainingDays.length,
        session_max_min: prefs.singleSessionMaxMin || 30,
        training_days: trainingDays,
      });
      navigate('/');
    } catch {
      setSaveError('保存失败，请检查网络后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 渲染 ───────────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-3">
      {EXPERIENCE_OPTIONS.map(opt => (
        <OptionCard
          key={opt.value}
          emoji={opt.emoji}
          label={opt.label}
          desc={opt.desc}
          selected={prefs.experience === opt.value}
          onClick={() => update({ experience: opt.value as UserProfile['experience'] })}
        />
      ))}
      {errors.experience && <p className="text-sm text-red-500 px-1">{errors.experience}</p>}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      {/* 器械列表 */}
      <div className="space-y-3">
        {EQUIPMENT_TOP.map(opt => (
          <div key={opt.value}>
            <OptionCard
              emoji={opt.emoji}
              label={opt.label}
              desc={opt.value === 'dumbbell' && hasDumbbell && selectedDumbbell
                ? `已选：${DUMBBELL_WEIGHTS.find(w => w.value === selectedDumbbell)?.label}`
                : opt.desc}
              selected={opt.value === 'dumbbell' ? hasDumbbell : (prefs.equipment || []).includes(opt.value)}
              onClick={() => toggleTopEquip(opt.value)}
            />

            {/* 哑铃重量展开面板 */}
            {opt.value === 'dumbbell' && (hasDumbbell || dumbbellExpanded) && (
              <div className="mt-2 ml-12 p-3 bg-gray-50 rounded-xl border border-gray-100">
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
        ))}
        {errors.equipment && <p className="text-sm text-red-500 px-1">{errors.equipment}</p>}
      </div>

      {/* 伤病 */}
      <div>
        <p className="text-sm font-semibold text-text mb-1">有需要注意的伤病吗？</p>
        <p className="text-xs text-muted mb-3">有选择的动作会自动过滤，可跳过</p>
        <div className="flex flex-wrap gap-2">
          {INJURY_OPTIONS.map(opt => {
            const active = (prefs.injuries || []).includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => {
                  const cur = prefs.injuries || [];
                  update({ injuries: active ? cur.filter(i => i !== opt.value) : [...cur, opt.value] });
                }}
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

  const renderStep3 = () => {
    const selectedDays = prefs.trainingDays || [];
    const toggleDay = (d: number) => {
      const cur = prefs.trainingDays || [];
      update({ trainingDays: cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d] });
    };
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold text-text mb-1">选择你的训练日</p>
          <p className="text-xs text-muted mb-4">可以随时在个人设置里修改</p>
          <div className="grid grid-cols-7 gap-2">
            {WEEK_DAYS.map(w => {
              const active = selectedDays.includes(w.value);
              return (
                <button
                  key={w.value}
                  onClick={() => toggleDay(w.value)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center font-bold text-sm transition-all border-2 ${
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
          {selectedDays.length > 0 && (
            <p className="text-xs text-brand mt-2 text-center">
              已选 {selectedDays.length} 天，系统将为你安排这几天的训练
            </p>
          )}
          {errors.days && <p className="text-sm text-red-500 mt-2">{errors.days}</p>}
        </div>

        <div>
          <p className="text-sm font-semibold text-text mb-3">每次最多练多久？</p>
          <div className="grid grid-cols-3 gap-2">
            {[20, 30, 45].map(m => (
              <button
                key={m}
                onClick={() => update({ singleSessionMaxMin: m })}
                className={`py-3.5 rounded-xl border-2 text-center font-semibold text-sm transition-all ${
                  prefs.singleSessionMaxMin === m
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
  };

  // ── 页面结构 ─────────────────────────────────────────────────────────────────

  const STEP_TITLES    = ['你的运动经验？', '器械 & 伤病情况', '每周训练安排'];
  const STEP_SUBTITLES = ['帮助我们推荐合适的训练强度', '可多选，我们会匹配合适的动作', '计划会按照你的节奏安排'];

  return (
    <div className="min-h-screen bg-surface">
      {/* Banner */}
      <div className="bg-gradient-to-r from-brand to-emerald-500 text-white py-12 px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2">
                <path d="M12 2C8 2 4 6 4 10c0 6 8 12 8 12s8-6 8-12c0-4-4-8-8-8z" strokeLinecap="round" strokeLinejoin="round"/>
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
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center justify-center rounded-full text-xs font-bold transition-all ${
                s < step   ? 'w-6 h-6 bg-brand text-white' :
                s === step ? 'w-7 h-7 bg-brand text-white ring-4 ring-brand/20' :
                             'w-6 h-6 bg-gray-200 text-gray-400'
              }`}>{s < step ? '✓' : s}</div>
              {s < 3 && <div className={`w-8 h-0.5 rounded-full ${s < step ? 'bg-brand' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* 步骤标题 */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-text">{STEP_TITLES[step - 1]}</h2>
          <p className="text-sm text-muted mt-0.5">{STEP_SUBTITLES[step - 1]}</p>
        </div>

        {/* 选项内容（无外层 Card） */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* 操作按钮 */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">上一步</Button>
          )}
          <Button onClick={handleNext} className="flex-1" disabled={submitting}>
            {step === 3 ? (submitting ? '保存中…' : '选择训练项目 →') : '下一步'}
          </Button>
        </div>

        {saveError && (
          <div className="mt-3 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            {saveError}
          </div>
        )}

        {step === 2 && (
          <p className="text-center text-sm text-muted mt-3">没有伤病可以直接跳过</p>
        )}
        <div className="h-8" />
      </div>
    </div>
  );
};
