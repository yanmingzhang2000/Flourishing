import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CopilotPanel } from '@/components/CopilotPanel';

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('@/api/copilot', () => ({
  streamCopilotChat: vi.fn().mockImplementation(async (input, onChunk) => {
    onChunk({ content: '你好' });
    onChunk({ content: ',我是AI教练' });
    onChunk({ sessionId: 'mock-session-123' });
    return 'mock-session-123';
  }),
}));

describe('CopilotPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders closed by default when isOpen=false', () => {
    render(<CopilotPanel isOpen={false} onClose={() => {}} />);
    const panel = screen.queryByRole('complementary');
    expect(panel).toHaveClass('translate-x-full');
  });

  it('renders open when isOpen=true', () => {
    render(<CopilotPanel isOpen={true} onClose={() => {}} />);
    const panel = screen.getByRole('complementary');
    expect(panel).not.toHaveClass('translate-x-full');
    expect(screen.getByText('AI 教练')).toBeInTheDocument();
  });

  it('sends message and displays streaming response', async () => {
    const user = userEvent.setup();
    render(<CopilotPanel isOpen={true} onClose={() => {}} />);

    const input = screen.getByPlaceholderText('问我训练相关的问题...');
    const sendButton = screen.getByRole('button', { name: '发送' });

    await user.type(input, '如何锻炼胸部?');
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('如何锻炼胸部?')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('你好'))).toBeInTheDocument();
    });
  });

  it.skip('disables input while streaming', async () => {
    const user = userEvent.setup();
    render(<CopilotPanel isOpen={true} onClose={() => {}} />);

    const input = screen.getByPlaceholderText('问我训练相关的问题...');
    await user.type(input, 'test');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => expect(input).toBeDisabled());
    await waitFor(() => expect(input).not.toBeDisabled());
  });
});
