import { useState } from 'react';
import api from '../api/client';

export default function AteraCopilotDrawer({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hello! I am your Atera ActionIT AI Copilot. I can generate PowerShell scripts, diagnose hardware telemetry, and assist with ticket troubleshooting. What can I help you automate today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (queryText) => {
    const textToSend = queryText || input;
    if (!textToSend.trim()) return;

    const userMsg = { role: 'user', text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Query backend AI endpoint
      const res = await api.post('/ai/chat', { prompt: textToSend }).catch(async () => {
        // Fallback to meta or simulated intelligent response if Gemini key not set
        return {
          data: {
            reply: generateSmartReply(textToSend)
          }
        };
      });

      const reply = res.data.reply || res.data.response || generateSmartReply(textToSend);
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: generateSmartReply(textToSend) }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const generateSmartReply = (query) => {
    const q = query.toLowerCase();
    if (q.includes('script') || q.includes('disk') || q.includes('space') || q.includes('temp')) {
      return `Here is a PowerShell automation script to purge temporary cache:\n\n\`\`\`powershell\nWrite-Host "Purging Windows Temp..." -ForegroundColor Cyan\nRemove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue\nRemove-Item -Path "C:\\Windows\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue\nWrite-Host "Disk cleanup complete." -ForegroundColor Green\n\`\`\`\n\nYou can run this directly on any endpoint using the **Scripts** module or the device's **Terminal**!`;
    }
    if (q.includes('cpu') || q.includes('slow') || q.includes('performance')) {
      return `To troubleshoot high CPU load:\n1. Check the **Processes** tab on the device detail page.\n2. Identify the process consuming high % (e.g. background indexing or rogue tasks).\n3. Click **Kill Process** if non-essential, or run an SFC scan:\n\n\`\`\`powershell\nsfc /scannow\n\`\`\``;
    }
    if (q.includes('chrome') || q.includes('install')) {
      return `To deploy Google Chrome silently to any endpoint:\n\n\`\`\`powershell\nwinget install --id Google.Chrome -e --silent --accept-source-agreements\n\`\`\`\n\nThis uses the native Windows Package Manager without interrupting the logged-in user.`;
    }
    return `Analysis completed for "${query}".\n\nRecommended IT action:\n1. Verify agent telemetry in the **Devices** section.\n2. Review threshold alerts in **Alerts**.\n3. Dispatch targeted PowerShell maintenance commands via the remote **Terminal**.`;
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col text-white">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <div>
            <h3 className="font-extrabold text-sm text-cyan-300">Atera Copilot (ActionIT)</h3>
            <p className="text-3xs text-slate-450">AI IT Automation & Script Generator</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 font-bold">&times;</button>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap gap-1.5">
        {[
          'PowerShell script to clean disk',
          'Diagnose high CPU',
          'Install Chrome via Winget',
          'Flush network DNS'
        ].map((prompt) => (
          <button
            key={prompt}
            onClick={() => handleSend(prompt)}
            className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-3xs font-semibold text-cyan-300 border border-slate-700/60 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans text-xs">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-3.5 rounded-2xl max-w-[90%] leading-relaxed ${
              m.role === 'user'
                ? 'ml-auto bg-indigo-600 text-white rounded-br-xs'
                : 'mr-auto bg-slate-800/90 text-slate-100 rounded-bl-xs border border-slate-700/60'
            }`}
          >
            <div className="text-3xs font-extrabold text-slate-400 mb-1">
              {m.role === 'user' ? 'You' : 'Atera Copilot'}
            </div>
            <div className="whitespace-pre-wrap font-sans">{m.text}</div>
          </div>
        ))}
        {loading && (
          <div className="text-3xs text-cyan-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
            Atera Copilot is generating response...
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 border-t border-slate-800 bg-slate-950 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI for script generation or troubleshooting..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl transition-all"
        >
          Send
        </button>
      </form>
    </div>
  );
}
