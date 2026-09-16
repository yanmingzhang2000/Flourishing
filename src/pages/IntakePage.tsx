import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { userApi } from '@/lib/api';
import { UserProfile } from '@/lib/types';

const EXPERIENCE_OPTIONS = [
  { value: 'zero',       label: '零基础', desc: '从没运动过，从头开始' },
  { value: 'occasional', label: '偶尔练', desc: '每周 1-2 次，断断续续' },
  { value: 'regular',    label: '经常练', desc: '每周 3 次以上，有习惯' },
];

const EQUIPMENT_OPTIONS = [
  { value: 'none',                  label: '自重',          desc: '不需要任何器械' },
  { value: 'dumbbell_1.5kg_pair',   label: '1.5kg 哑铃一对', desc: '轻重量入门' },
  { value: 'dumbbell_2kg_pair',     label: '2kg 哑铃一对',   desc: '中等重量' },
  { value: 'resistance_band',       label: '弹力带',         desc: '便携阻力训练' },
];

const INJURY_OPTIONS = [
  { value: 'shoulder', label: '肩部' },
  { value: 'elbow',    label: '肘部' },
  { value: 'wrist',    label: '腕部' },
  { value: 'knee',     label: '膝盖' },
  { value: 'back',     label: '腰背' },
];

type Prefs = Pick<UserProfile, 'experience' | 'injuries' | 'equipment' | 'maxTrainingDaysPerWeek' | 'singleSessionMaxMin'>;

export const IntakePage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [prefs, setPrefs] = useState<Partial<Prefs>>({
    singleSessionMaxMin: 30,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (updates: Partial<Prefs>) => {
    setPrefs(prev => ({ ...prev, ...updates }));
    setErrors({});
  };

  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1 && !prefs.experience)                            e.experience = '请选择训练经验';
    if (s === 2 && (!prefs.equipment || !prefs.equipment.length)) e.equipment  = '请至少选择一种器械';
    if (s === 3 && !prefs.maxTrainingDaysPerWeek)                e.days       = '请选择每周训练天数';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validate(step)) return;
    if (step < 3) { setStep(step + 1); return; }
    handleSubmit();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await userApi.updateProfile({
        experience: prefs.experience!,
        injuries: prefs.injuries || [],
        equipment: prefs.equipment!,
        max_days_per_week: prefs.maxTrainingDaysPerWeek!,
        session_max_min: prefs.singleSessionMaxMin || 30,
      });
    } catch {
      // 保存失败也继续，选项目时再保存
    } finally {
      setSubmitting(false);
      navigate('/');
    }
  };

  // ── Step 1: 训练经验 ──────────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">你的运动经验？</h2>
      <p className="text-sm text-gray-500">帮助我们推荐合适的训练强度</p>
      <div className="grid gap-3">
        {EXPERIENCE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => update({ experience: opt.value as UserProfile['experience'] })}
            className={`p-4 text-left rounded-xl border-2 transition-all ${
              prefs.experience === opt.value
                ? 'border-[#7DC47A] bg-[#7DC47A]/10'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium text-gray-800">{opt.label}</div>
            <div className="text-sm text-gray-500 mt-0.5">{opt.desc}</div>
          </button>
        ))}
      </div>
      {errors.experience && <p className="text-sm text-red-500">{errors.experience}</p>}
    </div>
  );

  // ── Step 2: 器械 + 伤病 ──────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">你有哪些器械？</h2>
        <p className="text-sm text-gray-500 mt-1">可多选，我们会匹配合适的动作</p>
        <div className="grid gap-3 mt-3">
          {EQUIPMENT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                const cur = prefs.equipment || [];
                update({ equipment: cur.includes(opt.value) ? cur.filter(e => e !== opt.value) : [...cur, opt.value] });
              }}
              className={`p-4 text-left rounded-xl border-2 transition-all ${
                (prefs.equipment || []).includes(opt.value)
                  ? 'border-[#7DC47A] bg-[#7DC47A]/10'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-gray-800">{opt.label}</div>
              <div className="text-sm text-gray-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
        {errors.equipment && <p className="text-sm text-red-500 mt-1">{errors.equipment}</p>}
      </div>

      <div>
        <h3 className="text-base font-semibold text-gray-800">有需要注意的伤病吗？</h3>
        <p className="text-sm text-gray-500 mt-1">可跳过，有选择的动作会自动过滤</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {INJURY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                const cur = prefs.injuries || [];
                update({ injuries: cur.includes(opt.value) ? cur.filter(i => i !== opt.value) : [...cur, opt.value] });
              }}
              className={`px-4 py-2 rounded-full border-2 text-sm transition-all ${
                (prefs.injuries || []).includes(opt.value)
                  ? 'border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Step 3: 每周安排 ──────────────────────────────────────────────────────
  const renderStep3 = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">每周想练几天？</h2>
        <p className="text-sm text-gray-500 mt-1">计划会按照你的节奏安排</p>
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[2, 3, 4, 5].map(d => (
            <button
              key={d}
              onClick={() => update({ maxTrainingDaysPerWeek: d })}
              className={`py-3 rounded-xl border-2 text-center font-medium transition-all ${
                prefs.maxTrainingDaysPerWeek === d
                  ? 'border-[#7DC47A] bg-[#7DC47A]/10 text-[#7DC47A]'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {d} 天
            </button>
          ))}
        </div>
        {errors.days && <p className="text-sm text-red-500 mt-1">{errors.days}</p>}
      </div>

      <div>
        <h3 className="text-base font-semibold text-gray-800">每次最多练多久？</h3>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[20, 30, 45].map(m => (
            <button
              key={m}
              onClick={() => update({ singleSessionMaxMin: m })}
              className={`py-3 rounded-xl border-2 text-center font-medium transition-all ${
                prefs.singleSessionMaxMin === m
                  ? 'border-[#7DC47A] bg-[#7DC47A]/10 text-[#7DC47A]'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {m} 分钟
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#DCF0FB] p-4">
      <div className="max-w-md mx-auto pt-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-[#7DC47A] flex items-center justify-center mx-auto mb-3">
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-white" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C8 2 4 6 4 10c0 6 8 12 8 12s8-6 8-12c0-4-4-8-8-8z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Flourish AI</h1>
          <p className="text-gray-500 mt-1 text-sm">让我们了解你一点点</p>
        </div>

        {/* 步骤指示 */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s <= step ? 'bg-[#7DC47A] w-8' : 'bg-gray-200 w-5'
              }`}
            />
          ))}
        </div>

        <Card>
          <CardContent className="p-6">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-5">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
              上一步
            </Button>
          )}
          <Button onClick={handleNext} className="flex-1" disabled={submitting}>
            {step === 3 ? (submitting ? '保存中…' : '下一步，选训练项目') : '下一步'}
          </Button>
        </div>

        {step === 2 && (
          <p className="text-center text-sm text-gray-400 mt-3">
            没有伤病可以直接跳过
          </p>
        )}
      </div>
    </div>
  );
};
