import { Router, type Request, type Response } from 'express';
import OpenAI from 'openai';
import { copilotChatInputSchema, DEFAULT_AVAILABLE_EQUIPMENT, type CopilotChatInput } from '@flourish/contracts';
import { getDb } from '../../db/index.js';
import {
  copilotSessions,
  copilotMessages,
  userProfiles,
  weeklyPlans,
  trainingRecords,
  workoutSessions,
} from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { validateBody } from '../../shared/validation.js';
import { requireAuth, requireUserId } from '../../shared/security.js';
import { loadExerciseLibrary } from '../exercises/index.js';
import { safety, exercises as exerciseQueries } from '@flourish/training-domain';
import { guardCopilotOutput } from './output-guard.js';

// Supports OpenAI-compatible providers (e.g. SiliconFlow) via OPENAI_BASE_URL.
// Model is also configurable since compatible providers use different model names.
const openai = process.env['OPENAI_API_KEY']
  ? new OpenAI({
      apiKey: process.env['OPENAI_API_KEY'],
      baseURL: process.env['OPENAI_BASE_URL'] || undefined,
    })
  : null;

const COPILOT_MODEL = process.env['OPENAI_MODEL'] || 'gpt-4o-mini';

const copilotRouter: Router = Router();

/**
 * POST /api/copilot/chat
 * Send a message to the AI copilot and receive a streaming response (SSE)
 * Requires authentication
 */
copilotRouter.post(
  '/chat',
  requireAuth,
  validateBody(copilotChatInputSchema),
  async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const input = req.body as CopilotChatInput;
    const { message, sessionId: inputSessionId } = input;
    const db = getDb();

    try {
      // 1. Create or retrieve session
      let sessionId = inputSessionId;
      if (!sessionId) {
        sessionId = randomUUID();
        db.insert(copilotSessions)
          .values({
            id: sessionId,
            userId,
            title: message.slice(0, 50), // First message as title
            createdAt: Date.now(),
          })
          .run();
        console.log(JSON.stringify({ level: 'info', msg: 'copilot_session_created', sessionId, userId }));
      } else {
        // Verify session belongs to user
        const existingSession = db
          .select()
          .from(copilotSessions)
          .where(and(eq(copilotSessions.id, sessionId), eq(copilotSessions.userId, userId)))
          .limit(1)
          .all();
        if (existingSession.length === 0) {
          res.status(404).json({ success: false, error: { code: 'not_found', message: 'Session not found' } });
          return;
        }
      }

      // 2. Persist user message
      const userMessageId = randomUUID();
      db.insert(copilotMessages)
        .values({
          id: userMessageId,
          sessionId,
          role: 'user',
          content: message,
          createdAt: Date.now(),
        })
        .run();

      // 3. Read user context (profile, active plan, recent records) — read-only via DB
      const userProfile = db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1).get() || null;

      // Active plan (most recent active plan)
      const activePlan =
        db
          .select()
          .from(weeklyPlans)
          .where(and(eq(weeklyPlans.userId, userId), eq(weeklyPlans.status, 'active')))
          .orderBy(desc(weeklyPlans.startDate), desc(weeklyPlans.createdAt))
          .limit(1)
          .get() || null;

      // Recent records (last 5, completed only)
      const recentRecords = db
        .select()
        .from(trainingRecords)
        .where(and(eq(trainingRecords.userId, userId), eq(trainingRecords.completed, true)))
        .orderBy(desc(trainingRecords.createdAt))
        .limit(5)
        .all();

      // Today's live workout session (in_progress / completed / aborted).
      // training_records only exists AFTER the user saves the completion
      // form, so without this the copilot tells users who are mid-workout
      // "no training sessions yet" (P1 test-report fix).
      const todayStr = localIsoDate();
      const todaySession =
        db
          .select()
          .from(workoutSessions)
          .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.date, todayStr)))
          .limit(1)
          .get() || null;

      // Safety context: compute contraindicated exercises from user's injuries.
      // Uses the same deterministic rule engine as plan generation (SAFE-01) —
      // this is NOT an LLM decision, it's a lookup injected into the prompt.
      const library = loadExerciseLibrary();
      const injuryTags = safety.mapInjuryOptionsToTags(userProfile?.injuries || []);
      const { excludedIds: contraindicatedIds, reasons: contraindicationReasons } =
        safety.getExcludedExercises(library.exercises, injuryTags);
      const contraindicatedNames = library.exercises
        .filter((ex) => contraindicatedIds.has(ex.exerciseId))
        .map((ex) => ex.name);
      // Safe exercise names available to this user — injury-filtered AND
      // equipment-filtered, so a bodyweight-only user is never pointed at
      // dumbbell exercises (same filterByEquipment as plan generation).
      const availableEquipment = userProfile?.availableEquipment ?? [...DEFAULT_AVAILABLE_EQUIPMENT];
      const safeExerciseNames = exerciseQueries
        .filterByEquipment(
          library.exercises.filter((ex) => !contraindicatedIds.has(ex.exerciseId)),
          availableEquipment,
        )
        .map((ex) => ex.name);
      const allLibraryNames = library.exercises.map((ex) => ex.name);

      // Plan exercise names (from the active plan's days JSON)
      const planDayList = Array.isArray(activePlan?.days) ? (activePlan.days as Array<{ exercises?: Array<{ exerciseSnapshot?: { name?: string } }> }>) : [];
      const planExerciseNames = planDayList
        .flatMap((day) => day.exercises ?? [])
        .map((ex) => ex.exerciseSnapshot?.name)
        .filter((name): name is string => typeof name === 'string' && name.length > 0);

      // 4. Load conversation history for context (last 20 messages excluding current user message)
      const conversationHistory = db
        .select()
        .from(copilotMessages)
        .where(eq(copilotMessages.sessionId, sessionId))
        .orderBy(copilotMessages.createdAt)
        .limit(20)
        .all();

      // 5. Construct OpenAI messages array
      const systemPrompt = buildSystemPrompt({
        profile: userProfile,
        activePlan,
        recentRecords,
        todaySession,
        contraindicatedNames,
        contraindicationReasons,
        safeExerciseNames,
        planExerciseNames,
      });
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory
          .slice(0, -1)
          .map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        { role: 'user', content: message },
      ];

      // 6. Stream response via SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        if (!openai) {
          // Graceful degradation: OPENAI_API_KEY not set
          const degradedMsg = '抱歉,AI 教练服务暂时不可用。请稍后再试或联系管理员。';
          res.write(`data: ${JSON.stringify({ content: degradedMsg })}\n\n`);
          res.write(`data: ${JSON.stringify({ sessionId })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          console.log(
            JSON.stringify({
              level: 'warn',
              msg: 'copilot_degraded_no_openai_key',
              sessionId,
              userId,
            }),
          );
          return;
        }

        const completion = await openai.chat.completions.create({
          model: COPILOT_MODEL,
          messages,
          stream: true,
          max_tokens: 1500,
          temperature: 0.7,
        });

        // Collect the FULL response first, then run the deterministic
        // output guard, and only then write to the client. Streaming deltas
        // straight through (the old behaviour) made violations impossible
        // to retract once sent. max_tokens=1500 keeps the added latency
        // acceptable; the SSE protocol is unchanged so the frontend does
        // not need to know.
        let assistantResponse = '';
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            assistantResponse += delta;
          }
        }

        // Hard safety layer (04-SAFETY §6): strip contraindicated exercise
        // names and non-library (invented) exercises from the reply before
        // it reaches the user or the database.
        const guard = guardCopilotOutput({
          text: assistantResponse,
          contraindicatedNames,
          libraryNames: allLibraryNames,
          safeExerciseNames,
        });
        if (guard.contraindicatedHits.length > 0 || guard.inventedHits.length > 0) {
          console.log(
            JSON.stringify({
              level: 'warn',
              msg: 'copilot_output_guard_triggered',
              sessionId,
              userId,
              contraindicatedHits: guard.contraindicatedHits,
              inventedHits: guard.inventedHits,
            }),
          );
        }
        assistantResponse = guard.safeText;

        // Single content event with the sanitized text (frontend
        // accumulates chunks identically — one chunk is still valid SSE).
        if (assistantResponse.length > 0) {
          res.write(`data: ${JSON.stringify({ content: assistantResponse })}\n\n`);
        }

        // Persist sanitized assistant response (never the raw violating text)
        db.insert(copilotMessages)
          .values({
            id: randomUUID(),
            sessionId,
            role: 'assistant',
            content: assistantResponse,
            createdAt: Date.now(),
          })
          .run();

        res.write(`data: ${JSON.stringify({ sessionId })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        console.log(
          JSON.stringify({
            level: 'info',
            msg: 'copilot_response_complete',
            sessionId,
            userId,
            messageLength: assistantResponse.length,
          }),
        );
      } catch (err: any) {
        console.log(JSON.stringify({ level: 'error', msg: 'copilot_llm_error', err: err.message, sessionId, userId }));
        res.write(`data: ${JSON.stringify({ error: 'LLM service unavailable' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (err: any) {
      console.log(JSON.stringify({ level: 'error', msg: 'copilot_chat_error', err: err.message, userId }));
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: { code: 'internal_error', message: 'Failed to process chat' } });
      } else {
        res.end();
      }
    }
  },
);

/** Local YYYY-MM-DD date, matching the server's local-timezone day. */
function localIsoDate(date: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const FEEDBACK_LABELS: Record<string, string> = {
  too_easy: '太轻松',
  just_right: '刚好',
  too_hard: '太难',
};

const SESSION_STATUS_LABELS: Record<string, string> = {
  in_progress: '进行中',
  completed: '已完成',
  aborted: '已结束',
};

/**
 * Human-readable training-activity summary injected into the system
 * prompt. Covers BOTH sources: completed training_records AND today's
 * live workout_sessions — a user mid-workout has session progress but no
 * record yet, and must never be told "no training sessions yet" (P1 fix).
 */
function buildRecordsSummary(recentRecords: any[], todaySession: any): string {
  const parts: string[] = [];

  if (recentRecords.length > 0) {
    const latest = recentRecords[0];
    const feedback = latest?.feedback ? (FEEDBACK_LABELS[latest.feedback] ?? latest.feedback) : null;
    parts.push(
      `Recent training history: ${recentRecords.length} completed sessions. ` +
        `Latest: ${latest?.date || 'N/A'}${latest?.durationMinutes ? ` (${latest.durationMinutes}min)` : ''}` +
        `${feedback ? `, feedback: ${feedback}` : ''}${latest?.notes ? `, notes: ${latest.notes}` : ''}.`,
    );
  }

  if (todaySession) {
    const sessionExercises: Array<{ status?: string }> = Array.isArray(todaySession.exercises)
      ? todaySession.exercises
      : [];
    const done = sessionExercises.filter((e) => e.status === 'completed').length;
    const skipped = sessionExercises.filter((e) => e.status === 'skipped').length;
    const blocked = sessionExercises.filter((e) => e.status === 'blocked').length;
    const statusLabel = SESSION_STATUS_LABELS[todaySession.status] ?? todaySession.status;
    parts.push(
      `Today's workout session (${todaySession.date}): status ${statusLabel}, ` +
        `completed ${done}/${sessionExercises.length} exercises` +
        `${skipped > 0 ? `, skipped ${skipped}` : ''}${blocked > 0 ? `, safety-blocked ${blocked}` : ''}.`,
    );
  }

  if (parts.length === 0) {
    return 'No completed training sessions yet, and no workout session started today.';
  }
  return parts.join(' ');
}

/**
 * Build system prompt with user context and safety constraints.
 *
 * Safety (04-SAFETY §1.1): the contraindicated exercise list is computed
 * by the deterministic rule engine (training-domain/safety), NOT by the
 * LLM. The prompt instructs the model to never recommend these exercises.
 */
function buildSystemPrompt(ctx: {
  profile: any;
  activePlan: any;
  recentRecords: any[];
  todaySession: any;
  contraindicatedNames: string[];
  contraindicationReasons: Record<string, string[]>;
  safeExerciseNames: string[];
  planExerciseNames: string[];
}): string {
  const {
    profile,
    activePlan,
    recentRecords,
    todaySession,
    contraindicatedNames,
    safeExerciseNames,
    planExerciseNames,
  } = ctx;

  const profileSummary = profile
    ? `User profile: ${profile.experienceLevel || 'beginner'} level, ${profile.heightCm || '?'}cm/${profile.weightKg || '?'}kg, injuries: ${(profile.injuries || []).join(', ') || 'none'}, available equipment: ${(profile.availableEquipment || []).join(', ') || 'bodyweight only'}.`
    : 'User profile not set.';

  const planSummary = activePlan
    ? `Current training plan: ${planExerciseNames.length > 0 ? `exercises include: ${planExerciseNames.slice(0, 20).join(', ')}. ` : ''}${Array.isArray(activePlan.days) ? activePlan.days.length : 0} training days this week, starting ${activePlan.startDate}.`
    : 'No active training plan.';

  const recordsSummary = buildRecordsSummary(recentRecords, todaySession);

  // Safety: inject the contraindicated exercise list (deterministic, from
  // the rule engine). The model MUST NOT recommend these exercises.
  const safetySection =
    contraindicatedNames.length > 0
      ? `SAFETY CONSTRAINTS (non-negotiable):
The following exercises are CONTRAINDICATED for this user due to their injuries and MUST NEVER be recommended, suggested, or described as alternatives:
${contraindicatedNames.join(', ')}
If the user asks about any of these exercises, explain that they are not recommended given their injury profile and suggest safe alternatives from the list below instead.`
      : 'SAFETY: no exercise contraindications for this user.';

  // Exercise whitelist: only recommend exercises that exist in the library.
  const exerciseWhitelist = `AVAILABLE EXERCISES (only recommend from this list, never invent exercises):
${safeExerciseNames.join(', ')}`;

  return `You are Flourish AI, a personal training assistant for at-home resistance training.
Your role: answer questions about exercises, explain training plans, provide form tips, and offer encouragement.
Always base recommendations on the user's actual data below.

${profileSummary}
${planSummary}
${recordsSummary}

${safetySection}

${exerciseWhitelist}

Guidelines:
- Be supportive, clear, and concise (2-4 sentences unless detailed explanation needed).
- Never invent training data the user hasn't done.
- NEVER recommend an exercise that is not in the AVAILABLE EXERCISES list above. If asked about an exercise not in the list, say it's not available in the app yet.
- NEVER recommend an exercise listed under SAFETY CONSTRAINTS, even if the user explicitly asks for it.
- For exercise form questions, reference safety and contraindications.
- For plan questions, explain the reasoning based on recovery time, difficulty progression, and available equipment.
- If the user asks to generate a new plan or modify workouts, explain that they can do so via the "我的训练" page.
- If asked about features not yet available (e.g., nutrition, community), acknowledge it's coming soon.

Respond naturally in Chinese (中文).`;
}

export { copilotRouter };
