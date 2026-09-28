import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { userApi } from '@/lib/api';

const EXPERIENCE_OPTIONS = [
  { value: 'zero', emoji: '🌱', label: '零基础', desc: '从没运动过' },
  { value: 'occasional', emoji: '🚶', label: '偶尔练', desc: '每周1-2次' },
  { value: 'regular', emoji: '💪', label: '经常练', desc: '每周3次以上' },
];

const EQUIPMENT_OPTIONS = [
  { value: 'none', emoji: '🤸', label: '自重' },
  { value: 'dumbbell', emoji: '🏋️', label: '哑铃' },
  { value: 'resistance_band', emoji: '🎯', label: '弹力带' },
];

const DUMBBELL_WEIGHTS = [
  { value: 'dumbbell_1kg_pair', label: '1kg×2' },
  { value: 'dumbbell_1.5kg_pair', label: '1.5kg×2' },
  { value: 'dumbbell_2kg_pair', label: '2kg×2' },
  { value: 'dumbbell_3kg_pair', label: '3kg×2' },
  { value: 'dumbbell_4kg_pair', label: '4kg×2' },
  { value: 'dumbbell_5kg_pair', label: '5kg×2' },
];

const INJURY_OPTIONS = [
  { value: 'shoulder', label: '肩部' },
  { value: 'elbow', label: '肘部' },
  { value: 'wrist', label: '腕部' },
  { value: 'knee', label: '膝盖' },
  { value: 'back', label: '腰背' },
];

const DAYS_OPTIONS = [2, 3, 4, 5];
const DURATION_OPTIONS = [20, 30, 45];

type Tab = 'body' | 'background' | 'equipment' | 'preferences';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('body');
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  const [form, setForm] = useState({
    height: '',
    weight: '',
    age: '',
    experience: '' as string,
    injuries: [] as string[],
    equipment: [] as string[],
    maxTrainingDaysPerWeek: 3,
    singleSessionMaxMin: 30,
  });

  useEffect(() => {
    userApi.getProfile().then(p => {
      setProfile(p);
      if (p) {
        setForm({
          height: p.height?.toString() || '',
          weight: p.weight?.toString() || '',
          age: p.age?.toString() || '',
          experience: p.experience || '',
          injuries: p.injuries || [],
          equipment: p.equipment || [],
          maxTrainingDaysPerWeek: p.max_days_per_week || 3,
          singleSessionMaxMin: p.session_max_min || 30,
        });
      }
    });
  }, []);

  const hasDumbbell = form.equipment.some(e => e.startsWith('dumbbell'));
  const selectedDumbbell = form.equipment.find(e => e.startsWith('dumbbell'));

  const toggleEquipment = (value: string) => {
    if (value === 'dumbbell') {
      if (hasDumbbell) {
        setForm(f => ({ ...f, equipment: f.equipment.filter(e => !e.startsWith('dumbbell')) }));
      }
    } else {
      setForm(f => ({
        ...f,
        equipment: f.equipment.includes(value)
          ? f.equipment.filter(e => e !== value)
          : [...f.equipment, value],
      }));
    }
  };

  const selectDumbbellWeight = (weight: string) => {
    setForm(f => ({
      ...f,
      equipment: [...f.equipment.filter(e => !e.startsWith('dumbbell')), weight],
    }));
  };

  const toggleInjury = (value: string) => {
    setForm(f => ({
      ...f,
      injuries: f.injuries.includes(value)
        ? f.injuries.filter(i => i !== value)
        : [...f.injuries, value],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await userApi.updateProfile({
        height: form.height ? Number(form.height) : undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        age: form.age ? Number(form.age) : undefined,
        experience: form.experience || undefined,
        injuries: form.injuries,
        equipment: form.equipment,
        max_days_per_week: form.maxTrainingDaysPerWeek,
        session_max_min: form.singleSessionMaxMin,
      });
      navigate(-1);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'body', label: '身体信息' },
    { key: 'background', label: '训练背景' },
    { key: 'equipment', label: '可用器械' },
    { key: 'preferences', label: '训练偏好' },
  ];

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="px-5 pt-10 pb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="text-brand text-sm font-medium">
            ← 返回
          </button>
          <h1 className="text-lg font-bold text-text">设置</h1>
          <div className="w-12" />
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-brand shadow-sm'
                  : 'text-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5">
        {/* Tab: 身体信息 */}
        {activeTab === 'body' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input id="height" label="身高 cm" type="number" placeholder="160"
                value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} />
              <Input id="weight" label="体重 kg" type="number" placeholder="50"
                value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} />
            </div>
            <Input id="age" label="年龄" type="number" placeholder="25"
              value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} />
            {form.height && form.weight && (
              <div className="bg-brand-light rounded-xl p-3 text-center">
                <span className="text-sm text-muted">BMI: </span>
                <span className="text-lg font-bold text-brand">
                  {(Number(form.weight) / Math.pow(Number(form.height) / 100, 2)).toFixed(1)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tab: 训练背景 */}
        {activeTab === 'background' && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-text mb-3">训练经验</p>
              <div className="space-y-2">
                {EXPERIENCE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setForm(f => ({ ...f, experience: opt.value }))}
                    className={`w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 transition-all ${
                      form.experience === opt.value
                        ? 'bg-brand-light border-l-4 border-brand'
                        : 'bg-gray-50 border-l-4 border-transparent'
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <div>
                      <div className={`font-medium text-sm ${form.experience === opt.value ? 'text-brand' : 'text-text'}`}>
                        {opt.label}
                      </div>
                      <div className="text-xs text-muted">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-text mb-1">伤病情况</p>
              <p className="text-xs text-muted mb-3">有选择的动作会自动过滤</p>
              <div className="flex flex-wrap gap-2">
                {INJURY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => toggleInjury(opt.value)}
                    className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${
                      form.injuries.includes(opt.value)
                        ? 'border-brand bg-brand-light text-brand'
                        : 'border-gray-200 text-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: 可用器械 */}
        {activeTab === 'equipment' && (
          <div className="space-y-4">
            {EQUIPMENT_OPTIONS.map(opt => (
              <div key={opt.value}>
                <button
                  onClick={() => toggleEquipment(opt.value)}
                  className={`w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 transition-all ${
                    (opt.value === 'dumbbell' ? hasDumbbell : form.equipment.includes(opt.value))
                      ? 'bg-brand-light border-l-4 border-brand'
                      : 'bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <span className="text-xl">{opt.emoji}</span>
                  <span className="font-medium text-sm">{opt.label}</span>
                </button>
                {opt.value === 'dumbbell' && (hasDumbbell || false) && (
                  <div className="mt-2 ml-10 p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-muted mb-2">选择重量（单个）</p>
                    <div className="grid grid-cols-3 gap-2">
                      {DUMBBELL_WEIGHTS.map(w => (
                        <button
                          key={w.value}
                          onClick={() => selectDumbbellWeight(w.value)}
                          className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                            selectedDumbbell === w.value
                              ? 'border-brand bg-brand text-white'
                              : 'border-gray-200 bg-white'
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
          </div>
        )}

        {/* Tab: 训练偏好 */}
        {activeTab === 'preferences' && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-text mb-3">每周训练天数</p>
              <div className="grid grid-cols-4 gap-2">
                {DAYS_OPTIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setForm(f => ({ ...f, maxTrainingDaysPerWeek: d }))}
                    className={`py-3 rounded-xl border-2 text-center font-semibold text-sm transition-all ${
                      form.maxTrainingDaysPerWeek === d
                        ? 'border-brand bg-brand text-white'
                        : 'border-gray-200'
                    }`}
                  >
                    {d}天
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-text mb-3">单次训练时长</p>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_OPTIONS.map(m => (
                  <button
                    key={m}
                    onClick={() => setForm(f => ({ ...f, singleSessionMaxMin: m }))}
                    className={`py-3 rounded-xl border-2 text-center font-semibold text-sm transition-all ${
                      form.singleSessionMaxMin === m
                        ? 'border-brand bg-brand text-white'
                        : 'border-gray-200'
                    }`}
                  >
                    {m}分钟
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="mt-8">
          <Button onClick={handleSave} className="w-full" disabled={saving}>
            {saving ? '保存中…' : '保存设置'}
          </Button>
        </div>
      </div>
    </div>
  );
};
