import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export const DisclaimerPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-6 mt-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">免责声明与使用条款</h1>

        <div className="space-y-6 text-sm text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">1. 医疗免责</h2>
            <p>
              本产品（Flourish AI）提供的训练计划和健身建议仅供参考，<strong className="text-red-600">不能替代专业医疗建议、诊断或治疗</strong>。
              在开始任何训练计划之前，请咨询您的医生或其他合格的医疗专业人士，特别是如果您：
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>有任何慢性疾病（心脏病、高血压、糖尿病等）</li>
              <li>近期有过手术或受伤</li>
              <li>怀孕或产后恢复期</li>
              <li>有关节、肌肉或骨骼问题</li>
              <li>长期未进行体育锻炼</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">2. 个人责任</h2>
            <p>
              您自愿选择使用本产品提供的训练计划。在训练过程中：
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li><strong>如感到任何不适、疼痛、头晕或呼吸困难，请立即停止训练</strong></li>
              <li>您需要根据自己的身体状况调整训练强度和动作</li>
              <li>您对自己的安全负责，包括确保训练环境安全、器械使用正确</li>
              <li>本平台不对因使用训练计划导致的任何伤害或健康问题承担责任</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">3. 关节不适处理</h2>
            <p>
              如果在训练中某个动作导致关节不适或疼痛：
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li><strong className="text-red-600">立即停止该动作</strong></li>
              <li>系统会标记该动作，避免在未来计划中推荐</li>
              <li>如疼痛持续或加重，请及时就医</li>
              <li>不要忍痛继续训练，以免加重伤病</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">4. 数据准确性</h2>
            <p>
              我们尽力确保动作库和训练计划的科学性，但：
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>动作演示视频和说明仅供参考，请确保动作标准</li>
              <li>建议对照镜子或录像检查动作姿势</li>
              <li>如对动作有疑问，建议咨询专业教练</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">5. 用户承诺</h2>
            <p>使用本产品即表示您：</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>已阅读并理解本免责声明</li>
              <li>已咨询医生（如有必要）并获得许可开始训练</li>
              <li>承诺在训练中注意安全，量力而行</li>
              <li>同意自行承担训练风险</li>
            </ul>
          </section>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-6">
            <p className="text-sm text-yellow-800">
              <strong>重要提示：</strong>
              健身训练存在固有风险。如果您不同意以上条款，请勿使用本产品。
            </p>
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="flex-1"
          >
            返回
          </Button>
          <Button
            onClick={() => navigate('/')}
            className="flex-1"
          >
            我已理解
          </Button>
        </div>
      </div>
    </div>
  );
};
