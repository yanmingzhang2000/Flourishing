import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BottomNav } from '@/components/BottomNav';
import { userApi, recordsApi, clearToken } from '@/lib/api';

const EXPERIENCE_LABELS: Record<string, string> = {
  zero: '零基础', occasional: '偶尔练', regular: '经常练',
};

const EQUIPMENT_LABELS: Record<string, string> = {
  none: '自重',
  dumbbell_1kg_pair: '1kg 哑铃',
  'dumbbell_1.5kg_pair': '1.5kg 哑铃',
  dumbbell_2kg_pair: '2kg 哑铃',
  dumbbell_3kg_pair: '3kg 哑铃',
  dumbbell_4kg_pair: '4kg 哑铃',
  dumbbell_5kg_pair: '5kg 哑铃',
  resistance_band: '弹力带',
};

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<{ totalWorkouts: number; currentStreak: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: '', age: '', height: '', weight: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([userApi.getProfile(), recordsApi.getStats()])
      .then(([p, s]) => {
        setProfile(p);
        setStats(s);
        if (p) setForm({
          displayName: p.display_name || '',
          age: p.age || '',
          height: p.height || '',
          weight: p.weight || '',
        });
      })
      .catch(() => navigate('/auth'));
  }, [navigate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await userApi.updateProfile({
        display_name: form.displayName || undefined,
        age: form.age ? Number(form.age) : undefined,
        height: form.height ? Number(form.height) : undefined,
        weight: form.weight ? Number(form.weight) : undefined,
      });
      const updated = await userApi.getProfile();
      setProfile(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

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
  const equipList = Array.isArray(profile.equipment) ? profile.equipment : [];

  return (
    <div className="min-h-screen bg-white pb-24">

      {/* 顶部用户信息 */}
      <div className="px-5 pt-10 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {(profile.display_name || '我')[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-text truncate">
              {profile.display_name || '未设置昵称'}
            </h1>
            <p className="text-sm text-muted mt-0.5">
              {EXPERIENCE_LABELS[profile.experience] || '训练中'} · 每周 {profile.max_days_per_week || '--'} 天
            </p>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="text-sm text-brand font-medium px-3 py-1.5 rounded-lg bg-brand-light"
          >
            {editing ? '取消' : '编辑'}
          </button>
        </div>
      </div>

      <div className="px-5 space-y-5">

        {/* 编辑表单 */}
        {editing && (
          <div className="bg-subtle rounded-2xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-text">身体信息</h2>
            <p className="text-xs text-muted -mt-1">仅用于未来 AI 分析，完全可选</p>
            <Input id="displayName" label="昵称" placeholder="你的名字"
              value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
            <Input id="age" label="年龄" type="number" placeholder="25"
              value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input id="height" label="身高 cm" type="number" placeholder="160"
                value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} />
              <Input id="weight" label="体重 kg" type="number" placeholder="50"
                value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </div>
        )}

        {/* 训练成果 */}
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">训练成果</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4 bg-ice-light">
              <div className="text-3xl font-bold text-brand">{stats?.totalWorkouts ?? 0}</div>
              <div className="text-sm text-muted mt-1">累计训练次</div>
            </div>
            <div className="rounded-2xl p-4 bg-ice-light">
              <div className="text-3xl font-bold text-brand">{stats?.currentStreak ?? 0}</div>
              <div className="text-sm text-muted mt-1">连续打卡天</div>
            </div>
          </div>
          <div className="mt-3 rounded-2xl p-4 border border-dashed border-gray-200 text-center">
            <p className="text-sm text-muted">AI 训练成果分析 · 即将上线</p>
          </div>
        </div>

        {/* 身体数据（有填才显示） */}
        {(profile.height || profile.weight || profile.age) && (
          <div>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">身体数据</h2>
            <div className="grid grid-cols-4 gap-2">
              {profile.age && (
                <div className="rounded-xl p-3 bg-subtle text-center">
                  <div className="font-bold text-text">{profile.age}</div>
                  <div className="text-xs text-muted mt-0.5">岁</div>
                </div>
              )}
              {profile.height && (
                <div className="rounded-xl p-3 bg-subtle text-center">
                  <div className="font-bold text-text">{profile.height}</div>
                  <div className="text-xs text-muted mt-0.5">cm</div>
                </div>
              )}
              {profile.weight && (
                <div className="rounded-xl p-3 bg-subtle text-center">
                  <div className="font-bold text-text">{profile.weight}</div>
                  <div className="text-xs text-muted mt-0.5">kg</div>
                </div>
              )}
              {bmi && (
                <div className="rounded-xl p-3 bg-brand-light text-center">
                  <div className="font-bold text-brand">{bmi}</div>
                  <div className="text-xs text-brand/70 mt-0.5">{bmiLabel}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 训练偏好 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">训练偏好</h2>
            <button onClick={() => navigate('/intake')} className="text-xs text-brand font-medium">
              修改
            </button>
          </div>
          <div className="rounded-2xl bg-subtle p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted">运动经验</span>
              <span className="font-medium text-text">{EXPERIENCE_LABELS[profile.experience] || '--'}</span>
            </div>
            <div className="w-full h-px bg-gray-100" />
            <div className="flex justify-between text-sm">
              <span className="text-muted">每周训练</span>
              <span className="font-medium text-text">{profile.max_days_per_week ? `${profile.max_days_per_week} 天` : '--'}</span>
            </div>
            <div className="w-full h-px bg-gray-100" />
            <div className="flex justify-between text-sm">
              <span className="text-muted">单次时长</span>
              <span className="font-medium text-text">{profile.session_max_min ? `${profile.session_max_min} 分钟` : '--'}</span>
            </div>
            {equipList.length > 0 && (
              <>
                <div className="w-full h-px bg-gray-100" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted">可用器械</span>
                  <span className="font-medium text-text text-right max-w-[60%]">
                    {equipList.map((e: string) => EQUIPMENT_LABELS[e] || e).join('、')}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 退出 */}
        <Button variant="outline" onClick={() => { clearToken(); navigate('/auth'); }} className="w-full text-muted">
          退出登录
        </Button>

        <div className="h-2" />
      </div>

      <BottomNav />
    </div>
  );
};
