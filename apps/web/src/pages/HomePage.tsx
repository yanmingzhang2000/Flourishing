import { Button } from '@/components/ui/button';

export function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">Flourish AI</h1>
      <p className="text-gray-500">你的 AI 健身私教 · 重开发骨架</p>
      <Button type="button">开始今日训练</Button>
    </main>
  );
}
