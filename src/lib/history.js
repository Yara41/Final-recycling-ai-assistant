// Conversation history stored on the server (RLS: users only see their own).
import { getSupabase } from './supabase.js';
import { ApiError } from './errors.js';

export async function listConversations(client = getSupabase()) {
  const { data, error } = await client
    .from('conversations')
    .select('id,title,updated_at')
    .order('updated_at', { ascending: false })
    .limit(30);
  if (error) throw new ApiError(error.message, 400, 'request_failed');
  return data ?? [];
}

export async function loadMessages(conversationId, client = getSupabase()) {
  const { data, error } = await client
    .from('messages')
    .select('id,role,content,actions')
    .eq('conversation_id', conversationId)
    .order('id', { ascending: true })
    .limit(200);
  if (error) throw new ApiError(error.message, 400, 'request_failed');
  return (data ?? []).map((m) => ({
    id: m.id,
    role: m.role === 'assistant' ? 'ai' : 'user',
    text: m.content,
    actions: Array.isArray(m.actions) ? m.actions : [],
  }));
}
