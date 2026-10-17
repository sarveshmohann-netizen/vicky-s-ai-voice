import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/vicky-chat')({
  server: { handlers: { POST: async ({ request }) => {
    const { handleVickyChat } = await import('@/lib/vicky-chat.server');
    return handleVickyChat(request);
  } } },
});