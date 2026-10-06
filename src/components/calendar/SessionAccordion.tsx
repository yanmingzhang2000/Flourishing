import React from 'react';

interface SessionData {
  date: string;
  dayIndex: number;
  dayLabel: string;
  projectName: string;
  duration: string;
  equipment: string;
  exerciseCount: number;
  status: 'todo' | 'completed';
  isToday: boolean;
}

interface Props {
  selectedDayIndex: number | null;
  sessions: SessionData[];
  onStartWorkout: (date: string, dayIndex: number) => void;
}

export const SessionAccordion: React.FC<Props> = ({ selectedDayIndex, sessions, onStartWorkout }) => {
  const selectedSession = sessions.find(s => s.dayIndex === selectedDayIndex);
  
  if (!selectedSession) {
    return (
      <div className="text-center py-8 text-muted">
        <p className="text-sm">本周暂无更多安排</p>
      </div>
    );
  }
  
  const { date, dayIndex, dayLabel, projectName, duration, equipment, exerciseCount, status, isToday } = selectedSession;
  
  return (
    <div className="space-y-3">
      <div className={`rounded-2xl p-4 transition-all ${
        status === 'completed' 
          ? 'bg-brand-light' 
          : isToday 
            ? 'bg-brand-light ring-2 ring-brand' 
            : 'bg-white'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`font-semibold text-sm ${status === 'completed' ? 'text-brand' : 'text-text'}`}>
                {dayLabel} · {date.slice(5)}
              </h4>
              {isToday && (
                <span className="text-xs bg-brand text-white px-1.5 py-0.5 rounded-full">
                  今天
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-text mb-1">{projectName}</p>
            <p className="text-xs text-muted">
              {duration} · {equipment} · {exerciseCount} 个动作
            </p>
          </div>
          
          {status === 'todo' ? (
            <button
              onClick={() => onStartWorkout(date, dayIndex)}
              className="px-4 py-2 bg-brand text-white rounded-xl hover:bg-brand-dark transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
              </svg>
              <span className="font-medium">开始</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 text-brand">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">已完成</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
