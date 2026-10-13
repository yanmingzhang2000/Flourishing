import { Router, type Request, type Response } from 'express';
import OpenAI from 'openai';
import { copilotChatInputSchema, type CopilotChatInput } from '@flourish/contracts';
import { getDb } from '../../db/index.js';
import { copilotSessions, copilotMessages, userProfiles, weeklyPlans, trainingRecords } from '../../db/schema.js';
import { eq, and, gte, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { validateBody } from '../../shared/validation.js';
import { requireAuth, requireUserId } from '../../shared/security.js';

const openai = process.env['OPENAI_API_KEY']
  ? new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] })
  : null;

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

      // Recent records (last 5)
      const recentRecords = db
        .select()
        .from(trainingRecords)
        .where(eq(trainingRecords.userId, userId))
        .orderBy(desc(trainingRecords.createdAt))
        .limit(5)
        .all();

      // 4. Load conversation history for context (last 20 messages excluding current user message)
      const conversationHistory = db
        .select()
        .from(copilotMessages)
        .where(eq(copilotMessages.sessionId, sessionId))
        .orderBy(copilotMessages.createdAt)
        .limit(20)
        .all();

      // 5. Construct OpenAI messages array
      const systemPrompt = buildSystemPrompt(userProfile, activePlan, recentRecords);
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
          model: 'gpt-4o-mini',
          messages,
          stream: true,
          max_tokens: 1500,
          temperature: 0.7,
        });

        let assistantResponse = '';
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            assistantResponse += delta;
            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
          }
        }

        // Persist assistant response
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

/**
 * Build system prompt with user context
 */
function buildSystemPrompt(profile: any, activePlan: any, recentRecords: any[]): string {
  const profileSummary = profile
    ? `User profile: ${profile.experienceLevel || 'beginner'} level, ${profile.heightCm || '?'}cm/${profile.weightKg || '?'}kg, injuries: ${(profile.injuries || []).join(', ') || 'none'}, available equipment: ${(profile.availableEquipment || []).join(', ') || 'bodyweight only'}.`
    : 'User profile not set.';

  const planSummary = activePlan
    ? `Current training plan: ${Array.isArray(activePlan.days) ? activePlan.days.length : 0} training days this week, starting ${activePlan.startDate}.`
    : 'No active training plan.';

  const recordsSummary =
    recentRecords.length > 0
      ? `Recent training history: ${recentRecords.length} sessions, latest feedback: ${recentRecords[0]?.feedback || 'N/A'}.`
      : 'No training history yet.';

  return `You are Flourish AI, a personal training assistant for at-home resistance training.
Your role: answer questions about exercises, explain training plans, provide form tips, and offer encouragement.
Always base recommendations on the user's actual data below.

${profileSummary}
${planSummary}
${recordsSummary}

Guidelines:
- Be supportive, clear, and concise (2-4 sentences unless detailed explanation needed).
- Never invent training data the user hasn't done.
- For exercise form questions, reference safety and contraindications (e.g., knee issues → avoid deep squats).
- For plan questions, explain the reasoning based on recovery time, difficulty progression, and available equipment.
- If the user asks to generate a new plan or modify workouts, explain that they can do so via the "我的训练" page.
- If asked about features not yet available (e.g., nutrition, community), acknowledge it's coming soon.

Respond naturally in Chinese (中文).`;
}

export { copilotRouter };
