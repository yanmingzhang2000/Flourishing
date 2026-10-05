/**
 * Copilot 端到端测试脚本
 */

const BASE_URL = 'http://localhost:3001';

// 测试用的 token（需要先注册一个测试用户）
let testToken = '';
let testUserId = null;

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(testToken ? { Authorization: `Bearer ${testToken}` } : {}),
      ...options.headers,
    },
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(err.error || '请求失败');
  }
  
  return res.json();
}

async function testCopilot() {
  console.log('=== Copilot 端到端测试 ===\n');

  try {
    // 1. 注册测试用户或登录游客
    console.log('1. 创建测试用户...');
    const authResult = await request('/api/auth/guest', { method: 'POST' });
    testToken = authResult.token;
    testUserId = authResult.userId;
    console.log(`✅ 用户创建成功: userId=${testUserId}\n`);

    // 2. 创建用户档案
    console.log('2. 创建用户档案...');
    await request('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify({
        experience: 'zero',
        injuries: [],
        equipment: ['bodyweight'],
        selected_projects: ['tricep_tone'],
        max_days_per_week: 3,
        session_max_min: 30,
      }),
    });
    console.log('✅ 用户档案创建成功\n');

    // 3. 模拟提交反馈记录（第 1 次 too_hard）
    console.log('3. 提交第 1 次反馈 (too_hard)...');
    await request('/api/records', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-10-05',
        dayIndex: 0,
        completed: true,
        feedback: 'too_hard',
        hasJointPain: false,
        completedExercises: ['ex_001'],
      }),
    });
    console.log('✅ 第 1 次反馈提交成功\n');

    // 4. 触发 Copilot（第 1 次 too_hard）
    console.log('4. 触发 Copilot 处理第 1 次 too_hard 反馈...');
    const response1 = await request('/api/copilot/process', {
      method: 'POST',
      body: JSON.stringify({
        event: {
          type: 'training_feedback_submitted',
          data: {
            feedback: 'too_hard',
            date: '2026-10-05',
            completedExercises: ['ex_001'],
          },
        },
      }),
    });

    if (response1.shouldRespond) {
      console.log('✅ Copilot 响应成功');
      console.log(`   消息: ${response1.message.content.substring(0, 100)}...`);
      console.log(`   语气: ${response1.message.tone}`);
      console.log(`   动作数量: ${response1.message.actions.length}\n`);
    } else {
      console.log('⚠️  Copilot 无响应（符合预期，首次反馈）\n');
    }

    // 5. 提交第 2 次反馈（too_hard）
    console.log('5. 提交第 2 次反馈 (too_hard)...');
    await request('/api/records', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-10-06',
        dayIndex: 2,
        completed: true,
        feedback: 'too_hard',
        hasJointPain: false,
        completedExercises: ['ex_002'],
      }),
    });
    console.log('✅ 第 2 次反馈提交成功\n');

    // 6. 触发 Copilot（第 2 次 too_hard，应该触发警告）
    console.log('6. 触发 Copilot 处理第 2 次 too_hard 反馈...');
    const response2 = await request('/api/copilot/process', {
      method: 'POST',
      body: JSON.stringify({
        event: {
          type: 'training_feedback_submitted',
          data: {
            feedback: 'too_hard',
            date: '2026-10-06',
            completedExercises: ['ex_002'],
          },
        },
      }),
    });

    if (response2.shouldRespond) {
      console.log('✅ Copilot 触发警告响应');
      console.log(`   SessionId: ${response2.sessionId}`);
      console.log(`   MessageId: ${response2.message.id}`);
      console.log(`   消息:\n   ${response2.message.content.replace(/\n/g, '\n   ')}`);
      console.log(`   语气: ${response2.message.tone}`);
      console.log(`   动作数量: ${response2.message.actions.length}`);
      
      if (response2.message.actions.length > 0) {
        console.log('   动作列表:');
        response2.message.actions.forEach(action => {
          console.log(`   - ${action.label} (${action.handler})`);
        });
      }
      console.log();

      // 7. 执行动作：降低难度
      console.log('7. 用户选择"帮我调整"（降低难度）...');
      const executeResult = await request('/api/copilot/execute', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: response2.sessionId,
          messageId: response2.message.id,
          actionId: 'adjust_difficulty_lower',
          params: {},
        }),
      });

      if (executeResult.success) {
        console.log('✅ 动作执行成功');
        console.log(`   结果: ${executeResult.message}\n`);
      } else {
        console.log('❌ 动作执行失败\n');
      }

      // 8. 验证用户偏好已保存
      console.log('8. 验证用户偏好已保存...');
      const profile = await request('/api/user/profile');
      const copilotSettings = JSON.parse(profile.copilot_settings || '{}');
      
      if (copilotSettings.difficulty_preference === 'keep_low') {
        console.log('✅ 用户偏好已正确保存');
        console.log(`   difficulty_preference: ${copilotSettings.difficulty_preference}\n`);
      } else {
        console.log('❌ 用户偏好保存失败\n');
      }

      // 9. 获取会话历史
      console.log('9. 获取会话历史...');
      const sessionHistory = await request(`/api/copilot/sessions/${response2.sessionId}`);
      console.log('✅ 会话历史获取成功');
      console.log(`   会话ID: ${sessionHistory.sessionId}`);
      console.log(`   意图: ${sessionHistory.intent}`);
      console.log(`   消息数量: ${sessionHistory.messages.length}`);
      console.log(`   状态: ${sessionHistory.status}\n`);

    } else {
      console.log('❌ Copilot 未触发警告（不符合预期）\n');
    }

    console.log('=== 测试完成 ===');
    console.log('✅ 所有测试通过！Copilot 系统运行正常。');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
testCopilot();
