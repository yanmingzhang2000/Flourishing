/**
 * Template Service - 模板管理服务
 * 
 * 负责加载、匹配 Copilot 响应模板
 */

import db from '../config/database';
import { CopilotTemplate, CopilotTemplateRow, CopilotIntent, CopilotContext } from './types';

export class TemplateService {
  /**
   * 从数据库加载所有启用的模板
   */
  async loadTemplates(intent: CopilotIntent): Promise<CopilotTemplate[]> {
    const rows = db.prepare(`
      SELECT * FROM copilot_templates
      WHERE intent = ? AND enabled = 1
      ORDER BY priority DESC
    `).all(intent) as CopilotTemplateRow[];

    return rows.map(row => this.rowToTemplate(row));
  }

  /**
   * 匹配最佳模板
   */
  match(templates: CopilotTemplate[], context: CopilotContext): CopilotTemplate | null {
    // 按优先级遍历，找到第一个条件匹配的模板
    for (const template of templates) {
      if (this.evaluateCondition(template.conditionExpr, context)) {
        return template;
      }
    }
    return null;
  }

  /**
   * 变量插值
   */
  interpolate(template: string, context: CopilotContext): string {
    return template.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
      try {
        // 使用 Function 构造器执行表达式
        const fn = new Function('ctx', `with (ctx) { return ${expr}; }`);
        const result = fn(context);
        return String(result);
      } catch (error) {
        console.error(`Failed to interpolate expression: ${expr}`, error);
        return `{{${expr}}}`;
      }
    });
  }

  /**
   * 评估条件表达式
   */
  private evaluateCondition(expr: string, context: CopilotContext): boolean {
    try {
      // 使用 Function 构造器执行条件表达式
      const fn = new Function('ctx', `with (ctx) { return ${expr}; }`);
      return Boolean(fn(context));
    } catch (error) {
      console.error(`Failed to evaluate condition: ${expr}`, error);
      return false;
    }
  }

  /**
   * 将数据库行转换为模板对象
   */
  private rowToTemplate(row: CopilotTemplateRow): CopilotTemplate {
    let actions = [];
    try {
      actions = JSON.parse(row.actions || '[]');
    } catch {
      actions = [];
    }

    return {
      id: row.id,
      intent: row.intent as CopilotIntent,
      conditionExpr: row.condition_expr,
      priority: row.priority,
      messageTemplate: row.message_template,
      tone: row.tone,
      actions,
      enabled: row.enabled === 1,
      version: row.version,
    };
  }
}
