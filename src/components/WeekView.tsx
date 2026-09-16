import React from 'react';
import { useNavigate } from 'react-router-dom';
import { WeeklyPlan, TrainingRecord } from '@/lib/types';
import projectsData from '@/data/projects.json';

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

// projectId → 项目名称的映射，供训练列表显示
const PROJECT_NAME_MAP: Record<string, string> = Object.fromEntries(
  (projectsData as any[]).map(p => [p.id, p.name])
);

interface Props {
  plan: WeeklyPlan;
  records: TrainingRecord[];
}

export const WeekView: React.FC<Props> = ({ plan, records }) => {
  const navigate = useNavigate();

  const getDate = (dayIndex: number): string => {
    const d = new Date(plan.startDate);
    d.setDate(d.getDate() + dayIndex);
    return d.toISOString().split('T')[0];
  };

  const isToday = (dayIndex: number) =>
    getDate(dayIndex) === new Date().toISOString().split('T')[0];

  const getRecord = (dayIndex: number) =>
    records.find(r => r.date === getDate(dayIndex));

  const todayIndex = plan.days.findIndex((_, i) => isToday(i));
  const todayDay = todayIndex >= 0 ? plan.days[todayIndex] : null;

  return (
    <div className="space-y-5">
      {/* 今日快捷入口 */}
      {todayDay && todayDay.type !== 'rest' && !getRecord(todayIndex)?.completed && (
        <button
          onClick={() => navigate(`/workout/${getDate(todayIndex)}/${todayIndex}`)}
          className="w-full bg-brand rounded-2xl p-4 flex items-center justify-between text-white"
        >
          <div>
            <p className="text-xs text-white/70 mb-0.5">今天</p>
            <p className="font-bold text-lg">开始训练</p>
            <p className="text-sm text-white/80 mt-0.5">{todayDay.exercises.length} 个动作</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
            </svg>
          </div>
        </button>
      )}

      {/* 本周格子 */}
      <div>
        <div className="grid grid-cols-7 gap-1.5 mb-1">
          {DAY_LABELS.map(l => (
            <div key={l} className="text-center text-[11px] text-muted font-medium py-1">{l}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {plan.days.map((day, index) => {
            const done = !!getRecord(index)?.completed;
            const today = isToday(index);
            const isRest = day.type === 'rest';
            return (
              <button
                key={index}
                onClick={() => !isRest && navigate(`/workout/${getDate(index)}/${index}`)}
                disabled={isRest}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all
                  ${isRest ? 'cursor-default' : 'cursor-pointer active:scale-95'}
                  ${done ? 'bg-brand' :
                    today ? 'bg-brand-light ring-2 ring-brand' :
                    isRest ? 'bg-subtle' : 'bg-ice-light hover:bg-ice'}`}
              >
                <span className={`text-xs font-bold
                  ${done ? 'text-white' : today ? 'text-brand' : isRest ? 'text-muted' : 'text-text'}`}>
                  {getDate(index).slice(8)}
                </span>
                <span className={`text-[10px] mt-0.5
                  ${done ? 'text-white/80' : isRest ? 'text-muted/50' : 'text-muted'}`}>
                  {done ? '✓' : isRest ? '休' : '练'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 训练列表 */}
      <div>
        <h3 className="text-sm font-semibold text-muted mb-3">本周训练</h3>
        <div className="space-y-2">
          {plan.days.map((day, index) => {
            if (day.type === 'rest') return null;
            const done = !!getRecord(index)?.completed;
            const today = isToday(index);
            const dateStr = getDate(index);
            return (
              <button
                key={index}
                onClick={() => navigate(`/workout/${dateStr}/${index}`)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left
                  ${done ? 'bg-brand-light' : today ? 'bg-ice-light ring-1 ring-brand/30' : 'bg-subtle hover:bg-ice-light'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                  ${done || today ? 'bg-brand' : 'bg-white'}`}>
                  {done
                    ? <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    : <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${done ? 'text-brand' : 'text-text'}`}>
                    周{DAY_LABELS[index]} · {dateStr.slice(5)}
                    {today && <span className="ml-2 text-xs bg-brand text-white px-1.5 py-0.5 rounded-full">今天</span>}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {day.projectId ? `${PROJECT_NAME_MAP[day.projectId] ?? day.projectId} · ` : ''}{day.exercises.length} 个动作
                  </p>
                </div>
                <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
