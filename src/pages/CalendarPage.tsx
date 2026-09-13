import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { storage } from '@/lib/storage';
import { WeeklyPlan, TrainingRecord, UserProfile } from '@/lib/types';

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const savedPlan = storage.getWeeklyPlan();
    const savedRecords = storage.getTrainingRecords();
    const savedProfile = storage.getUserProfile();

    if (!savedPlan || !savedProfile) {
      navigate('/');
      return;
    }

    setPlan(savedPlan);
    setRecords(savedRecords);
    setProfile(savedProfile);
  }, [navigate]);

  const isToday = (dayIndex: number): boolean => {
    if (!plan) return false;
    const startDate = new Date(plan.startDate);
    const today = new Date();
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + dayIndex);
    return (
      targetDate.getFullYear() === today.getFullYear() &&
      targetDate.getMonth() === today.getMonth() &&
      targetDate.getDate() === today.getDate()
    );
  };

  const getRecord = (dayIndex: number): TrainingRecord | undefined => {
    if (!plan) return undefined;
    const startDate = new Date(plan.startDate);
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + dayIndex);
    const dateStr = targetDate.toISOString().split('T')[0];
    return records.find(r => r.date === dateStr);
  };

  const getDayTypeStyle = (type: string) => {
    switch (type) {
      case 'strength':
        return 'bg-rose-100 border-rose-300 text-rose-700';
      case 'cardio':
        return 'bg-blue-100 border-blue-300 text-blue-700';
      case 'rest':
        return 'bg-gray-50 border-gray-200 text-gray-500';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-500';
    }
  };

  const getDayTypeLabel = (type: string) => {
    switch (type) {
      case 'strength':
        return '力量';
      case 'cardio':
        return '有氧';
      case 'rest':
        return '休息';
      default:
        return '';
    }
  };

  const getWorkoutDate = (dayIndex: number): string => {
    if (!plan) return '';
    const startDate = new Date(plan.startDate);
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + dayIndex);
    return targetDate.toISOString().split('T')[0];
  };

  const handleDayClick = (dayIndex: number) => {
    if (!plan) return;
    const day = plan.days[dayIndex];
    if (day.type === 'rest') return;

    const date = getWorkoutDate(dayIndex);
    navigate(`/workout/${date}/${dayIndex}`);
  };

  if (!plan || !profile) {
    return null;
  }

  const completedCount = records.filter(r => r.completed).length;
  const streak = calculateStreak(records);

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">本周训练</h1>
            <p className="text-sm text-gray-500">第{plan.weekNumber}周</p>
          </div>
          <Button variant="ghost" onClick={() => { storage.clearAll(); navigate('/'); }}>
            重新设置
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-rose-500">{completedCount}</div>
              <div className="text-xs text-gray-500">已完成</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-rose-500">{streak}</div>
              <div className="text-xs text-gray-500">连续打卡</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-rose-500">{profile.bmi}</div>
              <div className="text-xs text-gray-500">BMI</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {DAY_LABELS.map((label, index) => (
                <div key={label} className="text-center text-xs font-medium text-gray-500 pb-2">
                  {label}
                </div>
              ))}
              {plan.days.map((day, index) => {
                const record = getRecord(index);
                return (
                  <button
                    key={index}
                    onClick={() => handleDayClick(index)}
                    disabled={day.type === 'rest'}
                    className={`relative p-2 rounded-lg border-2 text-center transition-all ${
                      isToday(index) ? 'ring-2 ring-rose-400 ring-offset-2' : ''
                    } ${getDayTypeStyle(day.type)} ${
                      day.type !== 'rest' ? 'cursor-pointer hover:scale-105' : 'cursor-default'
                    }`}
                  >
                    <div className="text-xs font-bold mb-1">
                      {getWorkoutDate(index).slice(8)}
                    </div>
                    <div className="text-xs">
                      {getDayTypeLabel(day.type)}
                    </div>
                    {record?.completed && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="p-4">
            <h3 className="font-medium text-gray-800 mb-2">训练目标</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-3 h-3 rounded-full bg-rose-500"></span>
              <span>收紧拜拜肉，让手臂线条更好看</span>
            </div>
            <div className="mt-3 p-3 bg-rose-50 rounded-lg text-sm text-rose-700">
              预期效果：3-4周初步改善，6-8周明显收紧，12周稳定定型
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-3 h-3 rounded bg-rose-100 border border-rose-300"></span>
            <span>力量训练日</span>
            <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 ml-2"></span>
            <span>有氧日</span>
            <span className="w-3 h-3 rounded bg-gray-50 border border-gray-200 ml-2"></span>
            <span>休息日</span>
          </div>
        </div>
      </div>
    </div>
  );
};

function calculateStreak(records: TrainingRecord[]): number {
  const completedDates = records
    .filter(r => r.completed)
    .map(r => new Date(r.date))
    .sort((a, b) => b.getTime() - a.getTime());

  if (completedDates.length === 0) return 0;

  let streak = 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastCompleted = new Date(completedDates[0]);
  lastCompleted.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 1) return 0;

  for (let i = 0; i < completedDates.length - 1; i++) {
    const current = new Date(completedDates[i]);
    const next = new Date(completedDates[i + 1]);
    current.setHours(0, 0, 0, 0);
    next.setHours(0, 0, 0, 0);

    const diff = Math.floor((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}