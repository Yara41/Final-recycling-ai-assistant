import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, FileText, Leaf, Recycle, Mail, ClipboardCheck, Trash2 } from 'lucide-react';
import './App.css';

export default function App() {
  const initialMessage = {
    id: 1,
    role: 'ai',
    text:
      'مرحباً بك في مساعد إعادة التدوير الذكي للجامعات الأردنية 🌱\n\n' +
      'أنا هنا لمساعدتكم في تعزيز الوعي البيئي وتقديم المعلومات الدقيقة حول ممارسات إعادة التدوير داخل الحرم الجامعي.\n\n' +
      'يمكنك الضغط على أحد الأسئلة المقترحة بالأسفل أو كتابة سؤالك مباشرة.\n\n' +
      'كيف يمكنني مساعدتك اليوم؟'
  };

  const [messages, setMessages] = useState(() => {
    const savedMessages = localStorage.getItem('chatMessages');
    try {
      return savedMessages ? JSON.parse(savedMessages) : [initialMessage];
    } catch {
      return [initialMessage];
    }
  });

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const quickQuestions = [
    {
      label: 'إرشادات فرز النفايات',
      prompt: 'كيف يمكن فرز النفايات بشكل صحيح داخل الحرم الجامعي؟',
      icon: Recycle
    },
    {
      label: 'أنواع النفايات',
      prompt: 'ما هي أنواع النفايات التي يمكن أن تنتج داخل الجامعة؟',
      icon: FileText
    },
    {
      label: 'أهمية إعادة التدوير',
      prompt: 'ما أهمية إعادة التدوير للبيئة والمجتمع؟',
      icon: Leaf
    }
  ];

  useEffect(() => {
    localStorage.setItem('chatMessages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const clearChat = () => {
    setMessages([initialMessage]);
    localStorage.removeItem('chatMessages');
  };

  const sendMessage = async (messageText) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      text: messageText
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: messageText
        })
      });

      const data = await response.json();
      console.log('Function response:', data);

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Unknown server error');
      }

      const aiMessage = {
        id: Date.now() + 1,
        role: 'ai',
        text:
          data.reply ||
          data.output ||
          data.text ||
          'تم استلام رسالتك بنجاح من نظام n8n.'
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Connection Error:', error);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'ai',
          text: 'الخادم غير متاح حالياً، حاول لاحقاً.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    sendMessage(inputValue);
  };

  const handleQuickQuestion = (prompt) => {
    sendMessage(prompt);
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
        style={{
          backgroundColor: '#1b4332',
          padding: '15px 25px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Recycle size={35} style={{ color: '#40916c' }} />

          <div>
            <h1 style={{ color: 'white', margin: 0, fontSize: '1.4rem' }}>
              Recycling AI Assistant
            </h1>

            <p style={{ color: '#b7e4c7', margin: 0, fontSize: '0.8rem' }}>
              نظام ذكي لتعزيز الوعي بإعادة التدوير في الجامعات الأردنية
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={clearChat}
            style={{
              backgroundColor: '#ffffff',
              color: '#1b4332',
              border: 'none',
              padding: '10px 14px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            title="مسح المحادثة"
          >
            <Trash2 size={16} />
            <span>مسح المحادثة</span>
          </button>

          <button
            onClick={() =>
              window.open(
                'https://forms.gle/W3xtwb49j7NsWHF59',
                '_blank'
              )
            }
            style={{
              backgroundColor: '#fca311',
              color: '#14213d',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <ClipboardCheck size={18} />
            <span>شاركنا رأيك بالاستبيان</span>
          </button>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto'
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              marginBottom: '15px',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{
                ...(msg.role === 'user'
                  ? {
                      backgroundColor: '#2d6a4f',
                      color: 'white',
                      marginLeft: 'auto'
                    }
                  : {
                      backgroundColor: 'white',
                      color: '#333',
                      marginRight: 'auto',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      border: '1px solid #e5e7eb'
                    }),
                maxWidth: '80%',
                padding: '12px 18px',
                borderRadius: '15px',
                lineHeight: '1.7',
                whiteSpace: 'pre-wrap'
              }}
            >
              {msg.role === 'ai' ? (
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.text}
                  </ReactMarkdown>
                </div>
              ) : (
                msg.text
              )}
            </div>

            {msg.id === 1 && (
              <div
                style={{
                  marginTop: '12px',
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}
              >
                {quickQuestions.map((item, index) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={index}
                      onClick={() => handleQuickQuestion(item.prompt)}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Icon size={14} color="#1b4332" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div
            style={{
              marginBottom: '15px',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                color: '#333',
                marginRight: 'auto',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: '1px solid #e5e7eb',
                maxWidth: '80%',
                padding: '12px 18px',
                borderRadius: '15px',
                lineHeight: '1.5'
              }}
            >
              <div className="typing-indicator">جاري التفكير...</div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <footer
        style={{
          padding: '15px 20px',
          backgroundColor: 'white',
          borderTop: '1px solid #e2e8f0'
        }}
      >
        <div
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
            placeholder="اسأل عن طرق فرز النفايات..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={isLoading}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              padding: '10px',
              outline: 'none'
            }}
          />

          <button
            onClick={handleSendMessage}
            disabled={isLoading}
            style={{
              background: '#1b4332',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              padding: '10px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            <Send size={18} />
          </button>
        </div>

        <div
          style={{
            textAlign: 'center',
            fontSize: '10px',
            color: '#888',
            marginTop: '8px'
          }}
        >
          <Mail size={10} /> للتواصل العلمي: yarahyari41@gmail.com
        </div>
      </footer>
    </div>
  );
}