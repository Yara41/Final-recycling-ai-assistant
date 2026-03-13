import React, { useState, useEffect, useRef } from 'react';
import { Send, FileText, Leaf, Recycle, Mail, ClipboardCheck } from 'lucide-react';
import './App.css';

export default function App() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'ai',
      text: 'مرحباً بك في مساعد إعادة التدوير الذكي للجامعات الأردنية 🌱\n\nأنا هنا لمساعدتكم في تعزيز الوعي البيئي وتقديم المعلومات الدقيقة حول ممارسات إعادة التدوير داخل الحرم الجامعي. يمكنك الضغط على أحد الأسئلة المقترحة بالأسفل أو كتابة سؤالك مباشرة.\n\nكيف يمكنني مساعدتك اليوم؟',
      sources: [
        { id: 's1', title: 'أنواع النفايات', icon: FileText, color: '#10b981', bg: '#ecfdf5' },
        { id: 's2', title: 'إرشادات فرز النفايات', icon: Recycle, color: '#0a6b57', bg: '#d1fae5' },
        { id: 's3', title: 'أهمية إعادة التدوير', icon: Leaf, color: '#2d6a4f', bg: '#dcfce7' }
      ]
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const quickQuestions = [
    {
      label: 'إرشادات فرز النفايات',
      prompt: 'كيف يمكن فرز النفايات بشكل صحيح داخل الحرم الجامعي؟',
    },
    {
      label: 'أنواع النفايات',
      prompt: 'ما هي أنواع النفايات التي يمكن أن تنتج داخل الجامعة؟',
    },
    {
      label: 'أهمية إعادة التدوير',
      prompt: 'ما أهمية إعادة التدوير للبيئة والمجتمع؟',
    },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (messageText) => {
    if (!messageText.trim()) return;

    const userMessage = { id: Date.now(), role: 'user', text: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    try {
      const response = await fetch('https://yarahyari41.app.n8n.cloud/webhook/recycling-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: messageText
        }),
      });

      const data = await response.json();

      const aiMessage = {
        id: Date.now() + 1,
        role: 'ai',
        text: data.output || data.text || 'تم استلام رسالتك بنجاح من نظام n8n.',
        sources: data.sources || []
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Connection Error:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: 'عذراً، واجهت مشكلة في الاتصال بالخادم. تأكدي من تفعيل خيار الـ Active في n8n.'
      }]);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    await sendMessage(inputValue);
  };

  const handleQuickQuestion = async (prompt) => {
    await sendMessage(prompt);
  };

  return (
    <div
      dir="rtl"
      className="ai-container"
      style={{
        backgroundColor: '#f8fafc',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <header
        className="ai-header"
        style={{
          backgroundColor: '#1b4332',
          padding: '15px 25px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Recycle size={35} style={{ color: '#40916c' }} />
          <div>
            <h1 className="ai-title" style={{ color: 'white', margin: 0, fontSize: '1.4rem' }}>
              Recycling AI Assistant
            </h1>
            <p className="ai-subtitle" style={{ color: '#b7e4c7', margin: 0, fontSize: '0.8rem' }}>
              نظام ذكي لتعزيز الوعي بإعادة التدوير في الجامعات الأردنية
            </p>
          </div>
        </div>

        <button
          onClick={() => window.open('https://forms.gle/W3xtwb49j7NsWHF59', '_blank')}
          style={{
            backgroundColor: '#fca311',
            color: '#14213d',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 10px rgba(252, 163, 17, 0.3)',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#ffb703';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#fca311';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <ClipboardCheck size={18} />
          <span>شاركنا رأيك بالاستبيان</span>
        </button>
      </header>

      <main className="ai-main" style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '20px',
            justifyContent: 'center'
          }}
        >
          {quickQuestions.map((item, index) => (
            <button
              key={index}
              onClick={() => handleQuickQuestion(item.prompt)}
              style={{
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '20px',
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                color: '#1b4332',
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#ecfdf5';
                e.currentTarget.style.borderColor = '#95d5b2';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {messages.map((msg) => (
          <div
            key={msg.id}
            className="ai-message-wrapper"
            style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column' }}
          >
            <div
              className={`ai-speech-bubble ${msg.role === 'user' ? 'user-msg' : ''}`}
              style={{
                ...(msg.role === 'user'
                  ? { backgroundColor: '#2d6a4f', color: 'white', alignSelf: 'flex-start' }
                  : { backgroundColor: 'white', color: '#333', alignSelf: 'flex-end' }),
                maxWidth: '80%',
                padding: '12px 18px',
                borderRadius: '15px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}
            >
              {msg.text}
            </div>

            {msg.sources && msg.sources.length > 0 && (
              <div className="ai-sources-section" style={{ marginTop: '8px' }}>
                <div className="ai-sources-grid" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {msg.sources.map((source) => (
                    <div
                      key={source.id}
                      className="ai-source-card"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: '#f1f5f9',
                        padding: '5px 10px',
                        borderRadius: '8px'
                      }}
                    >
                      {source.icon && <source.icon size={14} style={{ color: source.color }} />}
                      <span style={{ fontSize: '12px', fontWeight: '500' }}>{source.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </main>

      <footer
        className="ai-footer"
        style={{
          padding: '15px 20px',
          backgroundColor: 'white',
          borderTop: '1px solid #e2e8f0'
        }}
      >
        <div
          className="ai-search-bar"
          style={{
            display: 'flex',
            gap: '10px',
            backgroundColor: '#f1f5f9',
            borderRadius: '25px',
            padding: '5px 15px',
            alignItems: 'center'
          }}
        >
          <input
            type="text"
            placeholder="اسأل عن طرق التدوير أو فرز النفايات..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              padding: '10px',
              outline: 'none',
              fontSize: '14px'
            }}
          />
          <button
            className="ai-send-btn"
            onClick={handleSendMessage}
            style={{
              background: '#1b4332',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              padding: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Send size={18} />
          </button>
        </div>

        <div
          className="ai-footer-note"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            marginTop: '10px',
            color: '#1b4332',
            fontSize: '11px',
            opacity: 0.8
          }}
        >
          <Leaf size={14} />
          <span>يدعم هذا النظام أهداف التنمية المستدامة في المؤسسات التعليمية الأردنية</span>
        </div>

        <div
          style={{
            textAlign: 'center',
            fontSize: '10px',
            color: '#888',
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            borderTop: '1px solid #f1f5f9',
            paddingTop: '8px'
          }}
        >
          <Mail size={10} />
          <span>للتواصل العلمي: yarahyari41@gmail.com</span>
        </div>
      </footer>
    </div>
  );
}