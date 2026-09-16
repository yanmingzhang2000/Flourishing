import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { BottomNav } from '@/components/BottomNav';
import { userApi, recordsApi, clearToken } from '@/lib/api';

const EXPERIENCE_LABELS: Record<string, string> = {
  zero: '零基础',
  occasional: '偶尔练',
  regular: '经常练',
};

const EQUIPMENT_LABELS: Record<string, string> = {
  none: '自重',
  dumbbell_1_5kg_pair: '1.5kg 哑铃',
  dumbbell_2kg_pair: '2kg 哑铃',
  resistance_band: '弹力带',
};

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<{ totalWorkouts: number; currentStreak: number } | null>(null);
  const [editing, setEditing] = useState<'body' | null>(null);
  const [bodyForm, setBodyForm] = useState({ displayName: '', age: '', height: '', weight: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([userApi.getProfile(), recordsApi.getStats()])
      .then(([p, s]) => {
        setProfile(p);
        setStats(s);
        if (p) {
          setBodyForm({
            displayName: p.display_name || '',
            age: p.age || '',
            height: p.height || '',
            weight: p.weight || '',
          });
        }
      })
      .catch(() => navigate('/auth'));
  }, [navigate]);

  const handleSaveBody = async () => {
    setSaving(true);
    try {
      await userApi.updateProfile({
        display_name: bodyForm.displayName || undefined,
        age: bodyForm.age ? Number(bodyForm.age) : undefined,
        height: bodyForm.height ? Number(bodyForm.height) : undefined,
        weight: bodyForm.weight ? Number(bodyForm.weight) : undefined,
      });
      const updated = await userApi.getProfile();
      setProfile(updated);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    navigate('/auth');
  };

  const handleResetPlan = () => {
    navigate('/intake');
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#DCF0FB] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#7DC47A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const bmi = profile.bmi ? Number(profile.bmi).toFixed(1) : null;
  const bmiLabel = bmi
    ? Number(bmi) < 18.5 ? '偏瘦' : Number(bmi) < 24 ? '正常' : Number(bmi) < 28 ? '偏重' : '偏胖'
    : null;

  return (
    <div className="min-h-screen bg-[#DCF0FB] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#7DC47A] to-[#10B981] text-white px-4 pt-10 pb-16">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{profile.display_name || '我的主页'}</h1>
            <p className="text-white/80 text-sm mt-1">
              {EXPERIENCE_LABELS[profile.experience] || '正在成长中'}
            </p>
          </div>
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
            {(profile.display_name || '我')[0]}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-8 space-y-4">

        {/* 训练统计 */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">训练成果</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-[#7DC47A]/10 rounded-xl">
                <div className="text-3xl font-bold text-[#7DC47A]">{stats?.totalWorkouts ?? 0}</div>
                <div className="text-sm text-gray-500 mt-1">累计训练次</div>
              </div>
              <div className="text-center p-3 bg-[#F59E0B]/10 rounded-xl">
                <div className="text-3xl font-bold text-[#F59E0B]">{stats?.currentStreak ?? 0}</div>
                <div className="text-sm text-gray-500 mt-1">当前连续天</div>
              </div>
            </div>
            {/* 未来 AI 分析占位 */}
            <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <p className="text-sm text-gray-400 text-center">
                AI 训练成果分析 · 即将上线
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 身体信息（可选） */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">身体信息</h2>
              {editing !== 'body' ? (
                <button
                  onClick={() => setEditing('body')}
                  className="text-sm text-[#7DC47A] font-medium"
                >
                  {profile.height ? '修改' : '填写'}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setEditing(null)} className="text-sm text-gray-400">取消</button>
                  <button
                    onClick={handleSaveBody}
                    className="text-sm text-[#7DC47A] font-medium"
                    disabled={saving}
                  >
                    {saving ? '保存中…' : '保存'}
                  </button>
                </div>
              )}
            </div>

            {editing === 'body' ? (
              <div className="space-y-3">
                <Input
                  id="displayName"
                  label="昵称"
                  placeholder="你的名字"
                  value={bodyForm.displayName}
                  onChange={e => setBodyForm(f => ({ ...f, displayName: e.target.value }))}
                />
                <Input
                  id="age"
                  label="年龄"
                  type="number"
                  placeholder="25"
                  value={bodyForm.age}
                  onChange={e => setBodyForm(f => ({ ...f, age: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    id="height"
                    label="身高 (cm)"
                    type="number"
                    placeholder="160"
                    value={bodyForm.height}
                    onChange={e => setBodyForm(f => ({ ...f, height: e.target.value }))}
                  />
                  <Input
                    id="weight"
                    label="体重 (kg)"
                    type="number"
                    placeholder="50"
                    value={bodyForm.weight}
                    onChange={e => setBodyForm(f => ({ ...f, weight: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-gray-400">身体信息仅用于未来的 AI 分析，完全可选</p>
              </div>
            ) : profile.height ? (
              <div className="grid grid-cols-3 gap-3">
                {profile.age && (
                  <div className="text-center">
                    <div className="text-xl font-bold text-gray-800">{profile.age}</div>
                    <div className="text-xs text-gray-400">岁</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-800">{profile.height}</div>
                  <div className="text-xs text-gray-400">cm</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-800">{profile.weight}</div>
                  <div className="text-xs text-gray-400">kg</div>
                </div>
                {bmi && (
                  <div className="text-center">
                    <div className="text-xl font-bold text-[#7DC47A]">{bmi}</div>
                    <div className="text-xs text-gray-400">BMI · {bmiLabel}</div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-2">
                填写身体信息，解锁 AI 体型分析
              </p>
            )}
          </CardContent>
        </Card>

        {/* 训练偏好 */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">训练偏好</h2>
              <button onClick={handleResetPlan} className="text-sm text-[#7DC47A] font-medium">
                修改
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">运动经验</span>
                <span className="font-medium text-gray-800">
                  {EXPERIENCE_LABELS[profile.experience] || '未设置'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">每周训练</span>
                <span className="font-medium text-gray-800">
                  {profile.max_days_per_week ? `${profile.max_days_per_week} 天` : '未设置'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">单次时长</span>
                <span className="font-medium text-gray-800">
                  {profile.session_max_min ? `${profile.session_max_min} 分钟` : '未设置'}
                </span>
              </div>
              {profile.equipment && profile.equipment.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">可用器械</span>
                  <span className="font-medium text-gray-800 text-right">
                    {(profile.equipment as string[])
                      .map(e => EQUIPMENT_LABELS[e] || e)
                      .join('、')}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 退出登录 */}
        <Button variant="outline" onClick={handleLogout} className="w-full text-gray-500">
          退出登录
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};
