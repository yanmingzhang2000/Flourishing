import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { storage } from '@/lib/storage';
import { generateWeeklyPlan } from '@/lib/planGenerator';
import { UserProfile } from '@/lib/types';

const EXPERIENCE_OPTIONS = [
  { value: 'zero', label: '零基础', desc: '从没运动过' },
  { value: 'occasional', label: '偶尔练', desc: '每周1-2次' },
  { value: 'regular', label: '经常练', desc: '每周3次以上' },
];

const EQUIPMENT_OPTIONS = [
  { value: 'none', label: '自重', desc: '不需要器械' },
  { value: 'dumbbell_1.5kg_pair', label: '1.5kg哑铃一对', desc: '轻重量' },
  { value: 'dumbbell_2kg_pair', label: '2kg哑铃一对', desc: '中等重量' },
  { value: 'resistance_band', label: '弹力带', desc: '便携阻力训练' },
];

const INJURY_OPTIONS = [
  { value: 'shoulder', label: '肩部' },
  { value: 'elbow', label: '肘部' },
  { value: 'wrist', label: '腕部' },
];

export const IntakePage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    target: 'tricep_tone',
    singleSessionMaxMin: 30,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }));
    setErrors({});
  };

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!profile.height || profile.height < 140 || profile.height > 200) {
        newErrors.height = '请输入有效的身高 (140-200cm)';
      }
      if (!profile.weight || profile.weight < 35 || profile.weight > 120) {
        newErrors.weight = '请输入有效的体重 (35-120kg)';
      }
    } else if (currentStep === 2) {
      if (!profile.experience) {
        newErrors.experience = '请选择训练经验';
      }
    } else if (currentStep === 3) {
      if (!profile.equipment || profile.equipment.length === 0) {
        newErrors.equipment = '请至少选择一种器械';
      }
    } else if (currentStep === 4) {
      if (!profile.maxTrainingDaysPerWeek) {
        newErrors.maxTrainingDaysPerWeek = '请选择训练天数';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      if (step < 4) {
        setStep(step + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handleSubmit = () => {
    const height = profile.height || 160;
    const weight = profile.weight || 50;
    const bmi = Number((weight / ((height / 100) ** 2)).toFixed(1));

    const finalProfile: UserProfile = {
      height,
      weight,
      bmi,
      experience: profile.experience || 'zero',
      injuries: profile.injuries || [],
      equipment: profile.equipment || ['none'],
      maxTrainingDaysPerWeek: profile.maxTrainingDaysPerWeek || 3,
      target: 'tricep_tone',
      singleSessionMaxMin: profile.singleSessionMaxMin || 30,
    };

    storage.setUserProfile(finalProfile);
    const plan = generateWeeklyPlan(finalProfile);
    storage.setWeeklyPlan(plan);
    navigate('/calendar');
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">基本信息</h2>
      <Input
        id="height"
        label="身高 (cm)"
        type="number"
        placeholder="160"
        value={profile.height || ''}
        onChange={(e) => updateProfile({ height: Number(e.target.value) })}
        error={errors.height}
      />
      <Input
        id="weight"
        label="体重 (kg)"
        type="number"
        placeholder="50"
        value={profile.weight || ''}
        onChange={(e) => updateProfile({ weight: Number(e.target.value) })}
        error={errors.weight}
      />
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">训练经验</h2>
      <div className="grid gap-3">
        {EXPERIENCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => updateProfile({ experience: option.value as UserProfile['experience'] })}
            className={`p-4 text-left rounded-lg border-2 transition-all ${
              profile.experience === option.value
                ? 'border-rose-500 bg-rose-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium">{option.label}</div>
            <div className="text-sm text-gray-500">{option.desc}</div>
          </button>
        ))}
      </div>
      {errors.experience && <p className="text-sm text-red-500">{errors.experience}</p>}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">可用器械</h2>
      <p className="text-sm text-gray-500">可多选</p>
      <div className="grid gap-3">
        {EQUIPMENT_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              const current = profile.equipment || [];
              const newEquipment = current.includes(option.value)
                ? current.filter(e => e !== option.value)
                : [...current, option.value];
              updateProfile({ equipment: newEquipment });
            }}
            className={`p-4 text-left rounded-lg border-2 transition-all ${
              (profile.equipment || []).includes(option.value)
                ? 'border-rose-500 bg-rose-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium">{option.label}</div>
            <div className="text-sm text-gray-500">{option.desc}</div>
          </button>
        ))}
      </div>
      {errors.equipment && <p className="text-sm text-red-500">{errors.equipment}</p>}

      <div className="mt-6">
        <h3 className="text-md font-semibold text-gray-800 mb-3">伤病情况</h3>
        <p className="text-sm text-gray-500 mb-3">可多选，我们会过滤不合适的动作</p>
        <div className="flex flex-wrap gap-2">
          {INJURY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                const current = profile.injuries || [];
                const newInjuries = current.includes(option.value)
                  ? current.filter(i => i !== option.value)
                  : [...current, option.value];
                updateProfile({ injuries: newInjuries });
              }}
              className={`px-4 py-2 rounded-full border-2 text-sm transition-all ${
                (profile.injuries || []).includes(option.value)
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">训练安排</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">每周训练天数</label>
        <div className="grid grid-cols-4 gap-2">
          {[2, 3, 4, 5].map((days) => (
            <button
              key={days}
              onClick={() => updateProfile({ maxTrainingDaysPerWeek: days })}
              className={`py-3 rounded-lg border-2 text-center transition-all ${
                profile.maxTrainingDaysPerWeek === days
                  ? 'border-rose-500 bg-rose-50 text-rose-600 font-medium'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {days}天
            </button>
          ))}
        </div>
        {errors.maxTrainingDaysPerWeek && <p className="text-sm text-red-500 mt-1">{errors.maxTrainingDaysPerWeek}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">单次最长训练时长</label>
        <div className="grid grid-cols-3 gap-2">
          {[20, 30, 45].map((min) => (
            <button
              key={min}
              onClick={() => updateProfile({ singleSessionMaxMin: min })}
              className={`py-3 rounded-lg border-2 text-center transition-all ${
                profile.singleSessionMaxMin === min
                  ? 'border-rose-500 bg-rose-50 text-rose-600 font-medium'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {min}分钟
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50 p-4">
      <div className="max-w-md mx-auto pt-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">拜拜肉塑形计划</h1>
          <p className="text-gray-500 mt-2">让我帮你制定专属训练计划</p>
        </div>

        <div className="flex justify-center mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`w-8 h-1 rounded-full mx-1 transition-colors ${
                s <= step ? 'bg-rose-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <Card>
          <CardContent className="p-6">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="flex-1"
            >
              上一步
            </Button>
          )}
          <Button onClick={handleNext} className="flex-1">
            {step === 4 ? '生成计划' : '下一步'}
          </Button>
        </div>
      </div>
    </div>
  );
};