import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { storage } from '@/lib/storage';
import { plansApi, recordsApi, userApi, projectInstancesApi, isLoggedIn } from '@/lib/api';
import { WeeklyPlan, PlanSnapshot, TrainingRecord, StructuredUnavailableResult } from '@/lib/types';
import { BottomNav } from '@/components/BottomNav';
import { WeekView } from '@/components/WeekView';
import { MonthView } from '@/components/MonthView';
import { YearView } from '@/components/YearView';
import { getMonday, calculateStreak } from '@/lib/calendarUtils';
import projectsData from '@/data/projects.json';
import { useCopilotContext } from '@/hooks/useCopilotContext';
import { CopilotMobileCapsule } from '@/components/copilot/CopilotMobileCapsule';
import { CopilotPeekCapsule } from '@/components/copilot/CopilotPeekCapsule';
import { CopilotSidebarDesktop } from '@/components/copilot/CopilotSidebarDesktop';
import { InsightFacts, generateHeroMessage } from '@/lib/copilot/insightEngine';

const PROJECT_MAP = Object.fromEntries((projectsData as any[]).map(p => [p.id, p]));

type ViewType = 'week' | 'month' | 'year';

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // instanceId 存在时为 V2 项目日历；不存在时为旧版全局日历（向后兼容）
  const { instanceId } = useParams<{ instanceId?: string }>();
  const { pushInsight, isOpen, open } = useCopilotContext();

  const [view, setView] = useState<ViewType>(() => {
    const viewParam = searchParams.get('view') as ViewType | null;
    return viewParam && ['week', 'month', 'year'].includes(viewParam) ? viewParam : 'week';
  });
  const [currentPlan, setCurrentPlan] = useState<WeeklyPlan | null>(null);
  const [monthPlans, setMonthPlans] = useState<PlanSnapshot[]>([]);
  const [yearPlans, setYearPlans] = useState<PlanSnapshot[]>([]);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [profile, setProfile] = useState<any | null>(null);
  const [instance, setInstance] = useState<any | null>(null);
  const [stats, setStats] = useState<{ totalWorkouts: number; currentStreak: number }>({ totalWorkouts: 0, currentStreak: 0 });
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<StructuredUnavailableResult | null>(null);
  const [viewWeekStartDate, setViewWeekStartDate] = useState<string | null>(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

  // 触发洞察消息
  const triggerInsight = (trigger: 'page_load' | 'view_switch' | 'workout_complete') => {
    if (!currentPlan && !records.length) return; // 数据未加载时跳过
    
    const todayStr = today.toISOString().split('T')[0];
    const todayRecord = records.find(r => r.date === todayStr);
    const todayStatus: 'todo' | 'completed' | 'rest' | 'future' = 
      todayRecord?.completed ? 'completed' :
      currentPlan?.days.some(d => d.dayIndex === today.getDay() && d.exercises.length > 0) ? 'todo' : 'rest';
    
    const facts: InsightFacts = {
      view,
      current_streak: stats.currentStreak,
      today_status: todayStatus,
    };
    
    // 根据视图补充进度数据
    if (view === 'week' && currentPlan) {
      const completed = currentPlan.days.reduce((sum, day) => {
        const dayRecord = records.find(r => {
          const recordDate = new Date(r.date);
          const planStart = new Date(currentPlan.startDate);
          const daysDiff = Math.floor((recordDate.getTime() - planStart.getTime()) / (24 * 3600 * 1000));
          return daysDiff >= 0 && daysDiff < 7 && recordDate.getDay() === day.dayIndex && r.completed;
        });
        return sum + (dayRecord ? 1 : 0);
      }, 0);
      const target = currentPlan.days.filter(d => d.exercises.length > 0).length;
      facts.week_progress = { completed, target, remaining: target - completed };
    }
    
    if (view === 'month' && monthPlans.length > 0) {
      const monthStart = new Date(viewYear, viewMonth - 1, 1);
      const monthEnd = new Date(viewYear, viewMonth, 0);
      const monthRecords = records.filter(r => {
        const date = new Date(r.date);
        return date >= monthStart && date <= monthEnd && r.completed;
      });
      const target = monthPlans.reduce((sum, plan) => 
        sum + plan.days.filter(d => d.exercises.length > 0).length, 0
      );
      facts.month_progress = { completed: monthRecords.length, target, remaining: target - monthRecords.length };
    }
    
    if (view === 'year' && yearPlans.length > 0) {
      const yearStart = new Date(viewYear, 0, 1);
      const yearEnd = new Date(viewYear, 11, 31);
      const yearRecords = records.filter(r => {
        const date = new Date(r.date);
        return date >= yearStart && date <= yearEnd && r.completed;
      });
      
      // 计算活跃周数
      const activeWeeks = new Set(yearRecords.map(r => {
        const date = new Date(r.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - (date.getDay() === 0 ? 6 : date.getDay() - 1));
        return weekStart.toISOString().split('T')[0];
      })).size;
      
      facts.year_stats = { total: yearRecords.length, activeWeeks, maxStreak: stats.currentStreak };
    }
    
    pushInsight(facts, trigger);
  };

  const handleMonthChange = (y: number, m: number) => {
    setViewYear(y);
    setViewMonth(m);
  };

  // 计算规则引擎快照（单一数据源）
  const ruleEngineSnapshot = useMemo(() => {
    if (!currentPlan) return null;
    
    const completed = currentPlan.days.reduce((sum, day) => {
      const dayRecord = records.find(r => {
        const recordDate = new Date(r.date);
        const planStart = new Date(currentPlan.startDate);
        const daysDiff = Math.floor((recordDate.getTime() - planStart.getTime()) / (24 * 3600 * 1000));
        return daysDiff >= 0 && daysDiff < 7 && recordDate.getDay() === day.dayIndex && r.completed;
      });
      return sum + (dayRecord ? 1 : 0);
    }, 0);
    
    const target = currentPlan.days.filter(d => d.exercises.length > 0).length;
    
    return { completed, target, remaining: target - completed };
  }, [currentPlan, records]);

  // 从同一快照派生 weekProgress 和 heroMessage
  const weekProgress = ruleEngineSnapshot || { completed: 0, target: 0 };
  const heroMessage = useMemo(() => {
    if (!ruleEngineSnapshot) return "开始你的训练计划 ✨";
    return generateHeroMessage(ruleEngineSnapshot);
  }, [ruleEngineSnapshot]);

  const handleWeekChange = (offset: number) => {
    if (!currentPlan) return;
    
    const startDate = new Date(viewWeekStartDate || currentPlan.startDate);
    startDate.setDate(startDate.getDate() + (offset * 7));
    
    const formatLocalDate = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    setViewWeekStartDate(formatLocalDate(startDate));
  };

  // 月/年视图点击日期跳转到周视图
  const handleDayClickFromMonthOrYear = async (date: string, dayIndex: number) => {
    const monday = getMonday(date);
    
    // 加载该周的计划
    if (isLoggedIn()) {
      try {
        const plan = await plansApi.getByDate(monday);
        if (plan) {
          setCurrentPlan(plan);
          setViewWeekStartDate(monday);
          setView('week');
          // 更新 URL 参数
          setSearchParams({ view: 'week', date: monday, selected: date });
        }
      } catch (error) {
        console.error('加载周计划失败:', error);
      }
    } else {
      // 离线模式直接跳转
      setView('week');
      setViewWeekStartDate(monday);
    }
  };

  // 计算周导航边界
  const getWeekNavigationBounds = () => {
    if (!instance || !currentPlan) return { canGoPrev: true, canGoNext: true };
    
    const currentStart = new Date(currentPlan.startDate);
    const projectStart = new Date(instance.startDate);
    
    // 计算项目第一周的周一（可能早于 startDate）
    const firstWeekMonday = new Date(projectStart);
    const dayOfWeek = projectStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    firstWeekMonday.setDate(firstWeekMonday.getDate() - daysToMonday);
    
    // 计算项目结束日期
    const projectEnd = new Date(instance.startDate);
    projectEnd.setDate(projectEnd.getDate() + instance.targetWeeks * 7);
    
    // 上一周的开始日期
    const prevWeekStart = new Date(currentStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    
    // 下一周的开始日期
    const nextWeekStart = new Date(currentStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    
    return {
      canGoPrev: prevWeekStart >= firstWeekMonday,
      canGoNext: nextWeekStart < projectEnd,
    };
  };

  // 获取项目跨越的所有月份
  const getProjectMonths = (startDate: string, targetWeeks: number): { year: number; month: number }[] => {
    const start = new Date(startDate);
    const end = new Date(startDate);
    end.setDate(end.getDate() + targetWeeks * 7);
    
    const months: { year: number; month: number }[] = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    
    while (current < end) {
      months.push({ year: current.getFullYear(), month: current.getMonth() + 1 });
      current.setMonth(current.getMonth() + 1);
    }
    
    return months;
  };

  // 确保单个月份有计划（辅助函数）
  const ensureMonthPlan = async (year: number, month: number, projectId: string) => {
    try {
      const plans = await plansApi.getMonth(year, month);
      console.log(`[自动生成] ${year}-${month} 已有 ${plans.length} 周计划`);
      
      if (plans.length === 0) {
        console.log(`[自动生成] 开始生成 ${year}-${month} 的计划...`);
        const result = await plansApi.generateMonth(year, month, [projectId]);
        console.log(`[自动生成] 生成 ${year}-${month} 完成:`, result);
      }
    } catch (error) {
      console.error(`[自动生成] 生成 ${year}-${month} 计划失败:`, error);
    }
  };

  // 渐进式加载：优先当前月，后台预加载下月
  const ensureCompleteProjectPlans = async (projectInstance: any) => {
    if (!projectInstance) return;
    
    console.log('[渐进式加载] 开始检查项目计划...', {
      startDate: projectInstance.startDate,
      targetWeeks: projectInstance.targetWeeks,
    });
    
    const now = new Date();
    const currentMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
    
    // 🟢 首屏：立即生成当前月计划（阻塞）
    console.log('[渐进式加载] 首屏加载当前月:', currentMonth);
    await ensureMonthPlan(currentMonth.year, currentMonth.month, projectInstance.projectId);
    
    // 🟡 后台：2秒后异步预加载下个月和后续月份（不阻塞UI）
    setTimeout(async () => {
      console.log('[渐进式加载] 后台预加载开始...');
      const months = getProjectMonths(projectInstance.startDate, projectInstance.targetWeeks);
      
      for (const { year, month } of months) {
        // 跳过已加载的当前月
        if (year === currentMonth.year && month === currentMonth.month) continue;
        
        await ensureMonthPlan(year, month, projectInstance.projectId);
      }
      
      console.log('[渐进式加载] 后台预加载完成');
    }, 2000);
    
    console.log('[渐进式加载] 首屏加载完成');
  };

  useEffect(() => {
    if (isLoggedIn()) {
      const loadData = async () => {
        try {
          const [planRes, recordsRes, profileRes, statsRes] = await Promise.all([
            plansApi.getCurrent(),
            recordsApi.getAll(),
            userApi.getProfile(),
            recordsApi.getStats(),
          ]);

          // onboarding 未完成时跳引导
          if (!profileRes || !profileRes.experience) {
            navigate('/onboarding');
            return;
          }

          setProfile(profileRes);
          setRecords(recordsRes || []);
          setStats(statsRes);

          // ── V2：有 instanceId 时独立加载该项目的计划 ──────────────────────
          if (instanceId) {
            const instances = await projectInstancesApi.getAll();
            const inst = instances.find((i: any) => String(i.id) === instanceId);
            if (!inst) { navigate('/'); return; }

            // 自动推进 currentWeek（不破坏其他实例）
            const startMs = new Date(inst.startDate).getTime();
            const nowMs = new Date().setHours(0, 0, 0, 0);
            const elapsed = Math.floor((nowMs - startMs) / (7 * 24 * 3600 * 1000));
            const computedWeek = Math.min(Math.max(elapsed + 1, 1), inst.targetWeeks);
            const updatedInst = { ...inst, currentWeek: computedWeek };
            setInstance(updatedInst);
            if (computedWeek !== inst.currentWeek) {
              projectInstancesApi.update(inst.id, { currentWeek: computedWeek }).catch(() => {});
            }

            // 确保项目的所有月份都有完整的计划
            await ensureCompleteProjectPlans(updatedInst);

            // 按 projectId 生成计划（不写入 profile.selected_projects）
            if (!planRes) {
              setPlanLoading(true);
              try {
                const genResult = await plansApi.generateForProject([inst.projectId]);
                if (genResult.outcome === 'temporarily_unavailable') {
                  setUnavailable(genResult);
                  return;
                }
                const fresh = await plansApi.getCurrent();
                setCurrentPlan(fresh);
              } finally {
                setPlanLoading(false);
              }
            } else {
              setCurrentPlan(planRes);
            }
            return; // instanceId 分支处理完毕，finally 会 setLoading(false)
          }

          // ── 旧版全局日历 ───────────────────────────────────────────────────
          setCurrentPlan(planRes);
          if (!planRes) {
            setPlanLoading(true);
            try {
              const genResult = await plansApi.generate();
              if (genResult.outcome === 'temporarily_unavailable') {
                setUnavailable(genResult);
                return;
              }
              const fresh = await plansApi.getCurrent();
              setCurrentPlan(fresh);
            } finally {
              setPlanLoading(false);
            }
          }
        } catch {
          navigate('/');
        } finally {
          setLoading(false);
          
          // 🎯 触发洞察：页面加载完成
          triggerInsight('page_load');
        }
      };
      loadData();
    } else {
      const savedPlan = storage.getWeeklyPlan();
      const savedRecords = storage.getTrainingRecords();
      const savedProfile = storage.getUserProfile();
      if (!savedPlan || !savedProfile) { navigate('/'); return; }
      setCurrentPlan(savedPlan);
      setRecords(savedRecords);
      setProfile(savedProfile);
      setStats({ totalWorkouts: savedRecords.filter(r => r.completed).length, currentStreak: calculateStreak(savedRecords) });
      setLoading(false);
      
      // 🎯 触发洞察：页面加载完成（离线模式）
      triggerInsight('page_load');
    }
  }, [navigate, instanceId]);

  // 月视图：加载该月所有计划，缺失时批量生成（实例日历按项目生成）
  useEffect(() => {
    if (view === 'month' && isLoggedIn()) {
      plansApi.getMonth(viewYear, viewMonth).then(plans => {
        setMonthPlans(plans);
        if (plans.length === 0) {
          // 检查该月是否在项目范围内
          if (instance) {
            const viewMonthStart = new Date(viewYear, viewMonth - 1, 1);
            const instanceStart = new Date(instance.startDate);
            const instanceEnd = new Date(instance.startDate);
            instanceEnd.setDate(instanceEnd.getDate() + instance.targetWeeks * 7);
            
            // 只在项目范围内生成
            if (viewMonthStart < instanceEnd && new Date(viewYear, viewMonth, 0) >= instanceStart) {
              plansApi.generateMonth(viewYear, viewMonth, [instance.projectId]).then(result => {
                if (result.outcome === 'temporarily_unavailable') {
                  setUnavailable(result);
                  return;
                }
                plansApi.getMonth(viewYear, viewMonth).then(setMonthPlans);
              });
            }
          } else {
            // 无实例限制，正常生成
            plansApi.generateMonth(viewYear, viewMonth, undefined).then(result => {
              if (result.outcome === 'temporarily_unavailable') {
                setUnavailable(result);
                return;
              }
              plansApi.getMonth(viewYear, viewMonth).then(setMonthPlans);
            });
          }
        }
      });
    }
  }, [view, viewYear, viewMonth, instance?.projectId, instance?.startDate, instance?.targetWeeks]);

  // 年视图：加载该年所有计划
  useEffect(() => {
    if (view === 'year' && isLoggedIn()) {
      plansApi.getYear(viewYear).then(plans => {
        setYearPlans(plans);
      });
    }
  }, [view, viewYear]);

  // 周视图：按日期加载指定周的计划
  useEffect(() => {
    if (view === 'week' && viewWeekStartDate && isLoggedIn()) {
      plansApi.getByDate(viewWeekStartDate).then(plan => {
        if (plan) setCurrentPlan(plan);
      });
    }
  }, [view, viewWeekStartDate]);

  // 切换视图时重置周视图状态并触发洞察
  useEffect(() => {
    if (view !== 'week') {
      setViewWeekStartDate(null);
    }
    
    // 🎯 触发洞察：切换视图
    if (!loading) {
      triggerInsight('view_switch');
    }
  }, [view]);

  // 监听训练记录变化，训练完成后触发洞察
  useEffect(() => {
    if (!loading && records.length > 0) {
      // 检查最新记录是否刚完成（避免初始加载触发）
      const latestCompleted = records.filter(r => r.completed).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      
      if (latestCompleted) {
        const recentTime = new Date(latestCompleted.date).getTime();
        const now = Date.now();
        // 如果最新完成记录在24小时内，触发洞察
        if (now - recentTime < 24 * 3600 * 1000) {
          triggerInsight('workout_complete');
        }
      }
    }
  }, [records.length, loading]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const projectColor = instance ? (PROJECT_MAP[instance.projectId]?.color ?? '#7DC47A') : '#7DC47A';
  const projectName = instance ? (PROJECT_MAP[instance.projectId]?.name ?? '训练日历') : null;

  const workoutPath = (date: string, dayIndex: number) =>
    instanceId
      ? `/workout/${instanceId}/${date}/${dayIndex}`
      : `/workout/${date}/${dayIndex}`;

  return (
    <div className="min-h-screen bg-subtle pb-24">
      {/* Header */}
      <div className="bg-brand px-8 pt-8 pb-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            {instanceId && (
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
                aria-label="返回"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/70 mb-0.5">
                {today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
              </p>
              <h1 className="text-2xl font-bold text-white truncate">
                {projectName
                  ? projectName
                  : profile.display_name ? `你好，${profile.display_name} 👋` : '训练日历'}
              </h1>
              {instance && (
                <p className="text-sm text-white/80 mt-0.5">
                  第 {instance.currentWeek} 周 / 共 {instance.targetWeeks} 周
                </p>
              )}
            </div>
            {!instanceId && (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {(profile.display_name || '我')[0]}
              </div>
            )}
          </div>

          {/* Stats 卡片行 */}
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl p-4 bg-white/90 text-center">
              <div className="text-2xl font-bold text-brand">{stats.totalWorkouts}</div>
              <div className="text-xs text-gray-500 mt-0.5">累计完成</div>
            </div>
            <div className="rounded-2xl p-4 bg-white/90 text-center">
              <div className="text-2xl font-bold text-brand">{stats.currentStreak}</div>
              <div className="text-xs text-gray-500 mt-0.5">已连续天数</div>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 - 1080px 容器 + 两列布局 */}
      <div className="max-w-[1080px] mx-auto px-8 pt-6">
        <div className="flex gap-6">
          {/* 左侧主区 - 收起时居中 */}
          <main className={`flex-1 min-w-0 transition-all ${
            !isOpen ? 'max-w-[840px] mx-auto' : ''
          }`}>
            {/* Copilot 移动端顶部胶囊 */}
            <CopilotMobileCapsule />
            
            {unavailable && (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                <p className="font-semibold text-amber-800">{unavailable.display_message}</p>
                <p className="mt-1 text-xs text-amber-700">当前条件下没有安全、合格的动作，请调整训练偏好后重试。</p>
              </div>
            )}

            {/* Tab 切换 */}
            <div className="mb-5 border-b border-subtle">
              <div className="flex gap-6">
                <button
                  onClick={() => setView('week')}
                  className={`py-2 px-1 text-sm font-medium transition-colors relative ${
                    view === 'week'
                      ? 'text-brand'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  周
                  {view === 'week' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
                  )}
                </button>
                <button
                  onClick={() => setView('month')}
                  className={`py-2 px-1 text-sm font-medium transition-colors relative ${
                    view === 'month'
                      ? 'text-brand'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  月
                  {view === 'month' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
                  )}
                </button>
                {!instanceId && (
                  <button
                    onClick={() => setView('year')}
                    className={`py-2 px-1 text-sm font-medium transition-colors relative ${
                      view === 'year'
                        ? 'text-brand'
                        : 'text-muted hover:text-text'
                    }`}
                  >
                    年
                    {view === 'year' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* 视图内容 */}
            <div>
              {view === 'week' && (
                currentPlan
                  ? <>
                      {/* 周导航栏 */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between">
                        {(() => {
                          const { canGoPrev, canGoNext } = getWeekNavigationBounds();
                          return (
                            <>
                              <button
                                onClick={() => handleWeekChange(-1)}
                                disabled={!canGoPrev}
                                className={`flex items-center gap-2 transition-colors ${
                                  canGoPrev 
                                    ? 'text-brand hover:text-brand-dark cursor-pointer' 
                                    : 'text-muted/30 cursor-not-allowed'
                                }`}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                                <span className="text-base font-medium">上一周</span>
                              </button>
                              
                              <span className="text-base font-bold text-text">
                                {(() => {
                                  const start = new Date(viewWeekStartDate || currentPlan.startDate);
                                  const end = new Date(start);
                                  end.setDate(end.getDate() + 6);
                                  const formatDateRange = (startDate: Date, endDate: Date) => {
                                    const sm = startDate.getMonth() + 1;
                                    const sd = startDate.getDate();
                                    const em = endDate.getMonth() + 1;
                                    const ed = endDate.getDate();
                                    if (sm === em) {
                                      return `${sm}月${sd}日 – ${ed}日`;
                                    } else {
                                      return `${sm}月${sd}日 – ${em}月${ed}日`;
                                    }
                                  };
                                  return formatDateRange(start, end);
                                })()}
                              </span>
                              
                              <button
                                onClick={() => handleWeekChange(1)}
                                disabled={!canGoNext}
                                className={`flex items-center gap-2 transition-colors ${
                                  canGoNext 
                                    ? 'text-brand hover:text-brand-dark cursor-pointer' 
                                    : 'text-muted/30 cursor-not-allowed'
                                }`}
                              >
                                <span className="text-base font-medium">下一周</span>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </>
                          );
                        })()}
                        </div>
                      </div>
                      
                      <WeekView
                        plan={currentPlan}
                        records={records}
                        instance={instance}
                        projectId={instance?.projectId}
                        onDayClick={(date, dayIndex) => navigate(workoutPath(date, dayIndex))}
                      />
                    </>
                  : <div className="text-center text-muted py-10 text-sm bg-white rounded-2xl">
                      {planLoading ? '正在生成训练计划…' : '暂无本周计划'}
                    </div>
              )}
              {view === 'month' && (
                <MonthView
                  year={viewYear}
                  month={viewMonth}
                  records={records}
                  plans={monthPlans}
                  instance={instance}
                  onMonthChange={handleMonthChange}
                  onDayClick={handleDayClickFromMonthOrYear}
                />
              )}
              {view === 'year' && !instanceId && (
                <YearView 
                  year={viewYear} 
                  records={records} 
                  plans={yearPlans} 
                  instance={instance}
                  onDayClick={handleDayClickFromMonthOrYear}
                />
              )}
            </div>
          </main>

          {/* 右侧 Copilot 抽屉（桌面端推挤式，移动端隐藏） */}
          <aside className="hidden lg:block w-[340px] flex-shrink-0">
            <CopilotSidebarDesktop 
              weekProgress={weekProgress}
              heroMessage={heroMessage}
            />
          </aside>
        </div>
      </div>

      {/* 右缘竖排重开按钮（收起时显示） */}
      {!isOpen && (
        <button
          onClick={open}
          className="hidden lg:block fixed right-0 top-1/2 -translate-y-1/2 bg-brand text-white px-2 py-6 rounded-l-lg shadow-lg hover:px-3 transition-all duration-200 z-40 text-sm"
          style={{ writingMode: 'vertical-rl' }}
          aria-label="打开教练寄语"
        >
          ‹ 教练寄语
        </button>
      )}

      {/* Copilot Peek 胶囊（桌面端） */}
      <CopilotPeekCapsule />

      <BottomNav />
    </div>
  );
};
