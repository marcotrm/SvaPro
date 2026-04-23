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
      setMessages([...newMessages, { role: 'assistant', content: 'Scusa, c\'è stato un errore di connessione con i server AI.' }]);
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
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #a855f7, #7e22ce)',
            color: 'white',
            border: 'none',
            boxShadow: '0 8px 24px rgba(168, 85, 247, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            animation: !isOpen ? 'spAiPulse 2s infinite' : 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
          )}
        </button>

        {isOpen && (
          <div style={{
            position: 'absolute',
            bottom: '80px',
            right: '0',
            width: '350px',
            height: '500px',
            backgroundColor: '#f3f4f6',
            borderRadius: '16px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            border: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'spAiPopupIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
            transformOrigin: 'bottom right'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px',
              background: 'linear-gradient(135deg, #a855f7, #7e22ce)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🤖</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14px' }}>SvaPro AI</div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Sempre al tuo fianco</div>
                </div>
              </div>
              <button onClick={() => setMessages([{ role: 'assistant', content: 'Ciao! Sono l\'assistente AI di SvaPro. Come posso aiutarti oggi?' }])} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '11px', opacity: 0.8, textDecoration: 'underline' }}>Pulisci Chat</button>
            </div>

            {/* Chat Area */}
            <div style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: '#f3f4f6'
            }}>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: msg.role === 'user' ? '#a855f7' : '#ffffff',
                  color: msg.role === 'user' ? 'white' : '#1f2937',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  maxWidth: '85%',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
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
                <div style={{ alignSelf: 'flex-start', color: '#6b7280', fontSize: '12px', padding: '10px' }}>L'AI sta pensando...</div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div style={{
              padding: '12px',
              borderTop: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              display: 'flex',
              gap: '8px'
            }}>
              <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Chiedi qualcosa..."
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '20px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                  color: '#1f2937',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              <button 
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#a855f7',
                  color: 'white',
                  border: 'none',
                  cursor: (loading || !input.trim()) ? 'default' : 'pointer',
                  opacity: (loading || !input.trim()) ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.1s'
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
