import { useState, useRef, useEffect } from 'react';
import api from '../api/client';

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: "### 👋 Welcome to the IT Chat Assistant!\n\nI can help you search for assets, check active license seat availability, retrieve maintenance tickets, or pull inventory summaries.\n\nClick one of the suggestions below or type your question!",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Auto-scroll to the bottom of the message thread
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const sendQuery = async (text) => {
    if (!text.trim() || loading) return;

    const userMessage = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const payloadMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.post('/ai/chat', { messages: payloadMessages });
      
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: res.data.text || "I couldn't process that query. Please try again.",
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `❌ **Error:** Failed to connect to the AI Agent service. ${
            err.response?.data?.error || err.message
          }`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    sendQuery(input);
  };

  // Helper parser for basic Markdown syntax
  const parseMarkdown = (text) => {
    if (!text) return '';
    let html = text;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="font-bold text-base text-indigo-950 mt-2 mb-1">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="font-bold text-lg text-indigo-900 mt-3 mb-1">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="font-bold text-xl text-indigo-900 mt-4 mb-2">$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-indigo-900 bg-indigo-50 px-1 rounded">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

    // Lists (ensure grouped lists don't split weirdly)
    html = html.replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc text-gray-700 py-0.5">$1</li>');
    html = html.replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-gray-700 py-0.5">$1</li>');

    // Replace lines with line breaks unless they are tags
    html = html.split('\n').map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('<li') || trimmed.startsWith('<h') || trimmed === '') return line;
      return `${line}<br />`;
    }).join('\n');

    return <div dangerouslySetInnerHTML={{ __html: html }} className="space-y-1 text-sm" />;
  };

  const suggestions = [
    { label: '📊 Summary', query: 'Show me the inventory summary' },
    { label: '🔧 Repairs', query: 'List all active repair tickets' },
    { label: '💾 Licenses', query: 'What software licenses do we have?' },
    { label: '💻 Available Laptops', query: 'Search for available laptops' }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window Panel */}
      {isOpen && (
        <div className="mb-4 flex h-[500px] w-88 flex-col overflow-hidden rounded-2xl border border-white/20 bg-white/95 shadow-2xl backdrop-blur-md transition-all duration-300 ease-in-out sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-brand-800 to-indigo-800 px-4 py-3.5 text-white">
            <div className="flex items-center space-x-2">
              <div className="relative flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 border border-white"></span>
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-wide">Nationwide Paper IT Agent</h3>
                <p className="text-2xs text-indigo-150">Powered by Vercel AI & Gemini</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                    m.role === 'user'
                      ? 'bg-gradient-to-r from-brand-700 to-indigo-700 text-white rounded-br-none'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                  }`}
                >
                  {parseMarkdown(m.content)}
                </div>
              </div>
            ))}

            {/* Thinking / Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-none bg-white border border-gray-100 px-4 py-3.5 shadow-sm">
                  <div className="flex items-center space-x-2.5">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-500" style={{ animationDelay: '0ms' }}></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-500" style={{ animationDelay: '150ms' }}></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-500" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-xs font-medium text-indigo-600/80 animate-pulse">IT Agent is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions */}
          <div className="border-t border-gray-100 bg-white/80 px-3 py-2">
            <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto py-0.5">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => sendQuery(s.query)}
                  className="rounded-full border border-indigo-100 bg-indigo-50/40 px-2.5 py-1 text-2xs font-semibold text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 active:scale-95 transition-all shadow-2xs"
                  disabled={loading}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Form */}
          <form onSubmit={submit} className="flex border-t border-gray-150 bg-white p-3 space-x-2">
            <input
              type="text"
              placeholder="Ask me something about inventory..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              disabled={loading}
            />
            <button
              type="submit"
              className="flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-4 text-white shadow-md hover:from-brand-700 hover:to-indigo-700 active:scale-95 transition-all"
              disabled={loading}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-brand-600 via-indigo-600 to-fuchsia-500 text-white shadow-[0_4px_20px_rgba(99,102,241,0.4)] hover:scale-105 active:scale-95 transition-all duration-300 group"
      >
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-75"></span>
          <span className="relative inline-flex h-4 w-4 rounded-full bg-fuchsia-500 border-2 border-white flex items-center justify-center text-[8px] font-black">AI</span>
        </span>
        {isOpen ? (
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        ) : (
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="group-hover:rotate-6 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.625.625 0 11-1.25 0 .625.625 0 011.25 0zm0 0H8.25m4.125 0a.625.625 0 11-1.25 0 .625.625 0 011.25 0zm0 0H12m4.125 0a.625.625 0 11-1.25 0 .625.625 0 011.25 0zm0 0h-.375M12 21a9.003 9.003 0 008.354-5.646 9.003 9.003 0 00-8.354-5.646 9.003 9.003 0 00-8.354 5.646 9.003 9.003 0 008.354 5.646z" />
          </svg>
        )}
      </button>
    </div>
  );
}
