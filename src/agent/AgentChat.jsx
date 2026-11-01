import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUp, Camera, History, Plus, X } from 'lucide-react';
import { sendAgentMessage } from '../lib/agent.js';
import { listConversations, loadMessages } from '../lib/history.js';
import { prepareImage } from '../lib/image.js';
import ActionCard from './ActionCard.jsx';
import VoiceButton from './VoiceButton.jsx';
import { strings } from './strings.js';

function suggestionsFor(s, role) {
  if (role === 'admin') return s.suggestions.admin;
  if (role === 'facilities') return s.suggestions.facilities;
  return s.suggestions.member;
}

// Chat with the agent: text, photo or voice in; reply plus action cards out.
// History lives on the server, so it follows the user's session.
export default function AgentChat({ profile, lang, dir, prompt = '', onNeedsOnboarding }) {
  const s = strings(lang);
  const [chats, setChats] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(prompt);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const fileRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    listConversations().then(setChats).catch(() => setChats([]));
  }, []);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const openChat = async (id) => {
    setShowHistory(false);
    setConversationId(id);
    setMessages(await loadMessages(id).catch(() => []));
  };

  const newChat = () => {
    setShowHistory(false);
    setConversationId(null);
    setMessages([]);
  };

  const errorText = (e) => (e?.code === 'rate_limited' ? s.rateLimited : e?.code === 'bad_image' ? s.photoError : s.serverDown);

  const send = async ({ text = '', image = null, preview = null }) => {
    if (busy || (!text.trim() && !image)) return;
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'user', text, image: preview }]);
    setInput('');
    setBusy(true);
    try {
      const res = await sendAgentMessage({ message: text.trim(), image, conversationId, lang });
      setMessages((m) => [...m, { id: `a${Date.now()}`, role: 'ai', text: res.reply, actions: res.actions }]);
      if (res.conversationId && res.conversationId !== conversationId) {
        setConversationId(res.conversationId);
        listConversations().then(setChats).catch(() => {});
      }
    } catch (e) {
      if (e?.code === 'needs_onboarding' || e?.code === 'unauthorized') {
        onNeedsOnboarding();
        return;
      }
      setMessages((m) => [...m, { id: `e${Date.now()}`, role: 'ai', text: errorText(e), actions: [] }]);
    } finally {
      setBusy(false);
    }
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const img = await prepareImage(file);
      await send({ text: input, image: { data: img.data, mimeType: img.mimeType }, preview: img.preview });
    } catch {
      setMessages((m) => [...m, { id: `e${Date.now()}`, role: 'ai', text: s.photoError, actions: [] }]);
    }
  };

  const empty = messages.length === 0;

  return (
    <>
      {showHistory && <div className="history-overlay" onClick={() => setShowHistory(false)} />}
      <aside className={`chat-sidebar ${showHistory ? 'open' : ''}`} dir={dir}>
        <div className="sidebar-top">
          <div className="sidebar-logo"><img src="/logo.png" alt="EcoWasteAI" /></div>
          <button type="button" className="chat-head-btn sidebar-close" onClick={() => setShowHistory(false)} aria-label="close"><X size={18} /></button>
        </div>
        <div className="agent-identity">
          <strong>{profile.universities?.name}</strong>
          <span>{s.roleLabel[profile.role]}{profile.faculty ? ` • ${profile.faculty}` : ''}</span>
        </div>
        <button type="button" className="sidebar-new" onClick={newChat}><Plus size={17} /> {s.newChat}</button>
        <div className="sidebar-title">{s.myChats}</div>
        <div className="chat-history">
          {chats.length === 0 ? (
            <p className="chat-history-empty">{s.noChats}</p>
          ) : (
            chats.map((c) => (
              <div key={c.id} className={`chat-history-item ${c.id === conversationId ? 'current' : ''}`}>
                <button type="button" className="chat-history-open" onClick={() => openChat(c.id)}>
                  <span className="chat-history-name">{c.title}</span>
                  <span className="chat-history-date">
                    {new Date(c.updated_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'ar', { day: 'numeric', month: 'short' })}
                  </span>
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      <section dir={dir} className={`assistant-main ${empty ? 'is-welcome' : ''}`}>
        <div className="assistant-toolbar">
          <button type="button" className="tool-btn only-mobile" onClick={() => setShowHistory(true)}><History size={16} /> {s.chats}</button>
          <button type="button" className="tool-btn only-mobile" onClick={newChat}><Plus size={16} /> {s.newChat}</button>
        </div>

        {empty ? (
          <div className="assistant-welcome">
            <span className="hero-small-title">{s.heroKicker}</span>
            <h1>{s.heroTitle}</h1>
            <p>{s.heroSub}</p>
          </div>
        ) : (
          <div className="assistant-messages" ref={boxRef}>
            {messages.map((m) => (
              <div key={m.id} className={`chat-message ${m.role === 'user' ? 'chat-user' : 'chat-ai'}`}>
                {m.role === 'ai' ? (
                  <div className="agent-reply">
                    {m.actions?.length > 0 && (
                      <div className="action-list">
                        {m.actions.map((card, i) => <ActionCard key={i} card={card} />)}
                      </div>
                    )}
                    {m.text && (
                      <div className="markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="user-message-text">
                    {m.image && <img src={m.image} alt="" className="chat-msg-image" />}
                    {m.text}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="chat-message chat-ai loading-message">
                <span></span><span></span><span></span>
                <span className="loading-text">{s.thinking}</span>
              </div>
            )}
          </div>
        )}

        <form className="assistant-input" onSubmit={(e) => { e.preventDefault(); send({ text: input }); }}>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={s.placeholder} disabled={busy} maxLength={1000} />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
          <VoiceButton lang={lang} label={s.voice} listeningLabel={s.listening} disabled={busy} onText={(t) => send({ text: t })} />
          <button type="button" className="chat-camera-btn" onClick={() => fileRef.current?.click()} disabled={busy} aria-label={s.photo}><Camera size={19} /></button>
          <button type="submit" aria-label={s.send} disabled={busy || !input.trim()}><ArrowUp size={19} /></button>
        </form>

        {empty && (
          <div className="suggested-questions">
            {suggestionsFor(s, profile.role).map((q) => (
              <button key={q} type="button" onClick={() => send({ text: q })}>{q}</button>
            ))}
            <button type="button" onClick={() => fileRef.current?.click()}><Camera size={14} /> {s.photo}</button>
          </div>
        )}
      </section>
    </>
  );
}
