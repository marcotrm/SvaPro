import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../api.jsx';

export default function FloatingAI() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const chatEndRef = useRef(null);

  // Carica i messaggi dal localStorage all'avvio
  useEffect(() => {
    const saved = localStorage.getItem('svapro_ai_chat_history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load AI chat history', e);
      }
    } else {
      setMessages([{ role: 'assistant', content: 'Ciao! Sono l\'assistente AI di SvaPro. Come posso aiutarti oggi?' }]);
    }
  }, []);

  // Salva i messaggi ogni volta che cambiano
  useEffect(() => {
    localStorage.setItem('svapro_ai_chat_history', JSON.stringify(messages));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleChat = () => setIsOpen(!isOpen);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // Invia il contesto della rotta corrente per maggiore consapevolezza
      const res = await api.post('/ai/chiedi-consiglio', { 
        question: userMsg,
        context_url: location.pathname + location.search 
      });

      let reply = res.data.answer;
      if (typeof reply === 'object') {
        if (reply.type === 'text') reply = reply.content;
        else reply = JSON.stringify(reply, null, 2);
      }

      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch (err) {
      console.error(err);
      let errMsg = 'Scusa, c\'è stato un errore di connessione con i server AI.';
      if (err.response && err.response.data && err.response.data.message) {
        errMsg = 'Errore dal server: ' + err.response.data.message;
      } else if (err.message) {
        errMsg = 'Errore: ' + err.message;
      }
      setMessages([...newMessages, { role: 'assistant', content: errMsg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes spAiPopupIn {
          0% { opacity: 0; transform: translateY(20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spAiPulse {
          0% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(168, 85, 247, 0); }
          100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
        }
        .ai-markdown p { margin-top: 0; margin-bottom: 0.5em; }
        .ai-markdown p:last-child { margin-bottom: 0; }
        .ai-markdown ul { margin: 0; padding-left: 1.2em; }
        .ai-markdown li { margin-bottom: 0.25em; }
      `}</style>
      <div 
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
        }}
      >
        <button 
          onClick={toggleChat}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
            color: 'white',
            border: 'none',
            boxShadow: '0 8px 32px rgba(139, 92, 246, 0.5)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease',
            animation: !isOpen ? 'spAiPulse 2.5s infinite' : 'none',
            zIndex: 10000,
            position: 'relative'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.3s' }}>
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.3s' }}>
              <path d="m9.9 17.5.5-1.5 1.5-.5-1.5-.5-.5-1.5-.5 1.5-1.5.5 1.5.5.5 1.5Z"/>
              <path d="m17 21 .5-1.5 1.5-.5-1.5-.5-.5-1.5-.5 1.5-1.5.5 1.5.5.5 1.5Z"/>
              <path d="m14.5 10 .5-1.5 1.5-.5-1.5-.5-.5-1.5-.5 1.5-1.5.5 1.5.5.5 1.5Z"/>
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
            </svg>
          )}
        </button>

        <div style={{
          position: 'absolute',
          bottom: '80px',
          right: '0',
          width: '450px',
          height: '70vh',
          maxHeight: '750px',
          minHeight: '400px',
          backgroundColor: '#f3f4f6',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          border: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transformOrigin: 'bottom right',
          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(40px)',
          pointerEvents: isOpen ? 'auto' : 'none'
        }}>
          {/* Header */}
          <div style={{
            padding: '20px',
            background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'white'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                ✨
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '0.5px' }}>SvaPro AI</div>
                <div style={{ fontSize: '12px', opacity: 0.85 }}>Il tuo assistente intelligente</div>
              </div>
            </div>
            <button onClick={() => setMessages([{ role: 'assistant', content: 'Ciao! Sono l\'assistente AI di SvaPro. Come posso aiutarti oggi?' }])} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600, opacity: 0.8, transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.8}>Ricominciamo</button>
          </div>

          {/* Chat Area */}
          <div style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: '#f8fafc'
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.role === 'user' ? '#8b5cf6' : '#ffffff',
                color: msg.role === 'user' ? 'white' : '#1e293b',
                padding: '14px 18px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                maxWidth: '85%',
                fontSize: '14px',
                lineHeight: '1.5',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0'
              }}>
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <div className="ai-markdown">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', color: '#64748b', fontSize: '13px', padding: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6', animation: 'spAiPulse 1s infinite' }} />
                L'AI sta pensando...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div style={{
            padding: '16px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            gap: '12px'
          }}>
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Chiedi qualcosa all'AI..."
              style={{
                flex: 1,
                padding: '12px 18px',
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                fontSize: '14px',
                outline: 'none',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#8b5cf6'}
              onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
            />
            <button 
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
                color: 'white',
                border: 'none',
                cursor: (loading || !input.trim()) ? 'default' : 'pointer',
                opacity: (loading || !input.trim()) ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.1s, box-shadow 0.2s',
                boxShadow: (loading || !input.trim()) ? 'none' : '0 4px 12px rgba(139, 92, 246, 0.4)'
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
