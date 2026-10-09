import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { 
  Send, 
  Sparkles, 
  Brain, 
  Image as ImageIcon, 
  User, 
  Bot, 
  RefreshCw, 
  Lightbulb, 
  Paperclip,
  CheckCircle,
  Copy,
  AlertCircle
} from 'lucide-react';
import { ChatMessage } from '../../types/index.ts';

export const AiChatAssistantView: React.FC = () => {
  const { aiSettings, updateAiSettings, items } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content: `Hello! I'm **Hero Gemini**, your expert collectibles appraiser, eBay listing strategist, and inventory architect.

I can help you with:
- **Grading Forecasts**: Estimate PSA 10 vs 9 vs Raw values and submit recommendations.
- **eBay SEO & Titles**: Craft high-converting titles strictly under the 80-character limit.
- **Google Drive Organization**: Structure thousands of photos across stream/mirror modes.
- **Valuation Comps**: Recent sold trends across Pokemon, Sports Cards, Comics, Coins, and Retro Games.

Feel free to attach an image or ask any question!`,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItemAttachment, setSelectedItemAttachment] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() && !selectedItemAttachment) return;

    const attachedItem = items.find(i => i.id === selectedItemAttachment);

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString(),
      imageAttachment: attachedItem ? attachedItem.previewUrl : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare history for server endpoint
      const historyPayload = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      historyPayload.push({ role: 'user', content: textToSend });

      let imageAttachmentPayload = undefined;
      if (attachedItem) {
        imageAttachmentPayload = {
          mimeType: attachedItem.mimeType || 'image/jpeg',
          data: attachedItem.previewUrl,
        };
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyPayload,
          model: aiSettings.geminiModel,
          enableThinking: aiSettings.enableThinking,
          imageAttachment: imageAttachmentPayload,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const botMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: 'model',
          content: data.text || 'Analysis completed.',
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          content: `I encountered an issue connecting to the Gemini API: ${err.message}. Please check your GEMINI_API_KEY or connection.`,
          timestamp: new Date().toLocaleTimeString(),
          error: true,
        },
      ]);
    } finally {
      setIsLoading(false);
      setSelectedItemAttachment(null);
    }
  };

  const starterPrompts = [
    "What's the price spread between PSA 10 and PSA 9 for 1999 Base Set Charizard?",
    "Suggest 3 high-converting 80-character eBay titles for a 2026 Topps Chrome Refractor",
    "How should I structure my Google Drive for Desktop folders for 5,000 sports cards?",
    "What are the top 3 flaws to check before submitting chromium cards to PSA?",
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto h-[calc(100vh-6rem)] flex flex-col space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>Hero Gemini Appraiser & Advisor</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
              Interactive Chat
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Real-time appraisal, pricing comps, and eBay listing optimization backed by Gemini.
          </p>
        </div>

        {/* Model switcher */}
        <div className="flex items-center gap-3 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
          <Brain className="w-3.5 h-3.5 text-amber-400" />
          <select
            value={aiSettings.geminiModel}
            onChange={(e) => updateAiSettings({ geminiModel: e.target.value as any })}
            className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
          >
            <option value="gemini-3.8-flash" className="bg-slate-900 text-white">Gemini 3.8 Flash (Default)</option>
            <option value="gemini-3.1-pro-preview" className="bg-slate-900 text-white">Gemini 3.1 Pro (Deep Thinking)</option>
          </select>

          <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={aiSettings.enableThinking}
              onChange={(e) => updateAiSettings({ enableThinking: e.target.checked })}
              className="rounded bg-slate-950 border-slate-700 text-amber-500"
            />
            <span>Thinking</span>
          </label>
        </div>
      </div>

      {/* Chat Thread Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 text-xs ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center flex-shrink-0 text-slate-950 shadow-md">
                <Sparkles className="w-4 h-4 fill-current" />
              </div>
            )}

            <div
              className={`max-w-2xl rounded-2xl p-4 space-y-2 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-amber-500 text-slate-950 font-medium'
                  : msg.error
                  ? 'bg-rose-950/40 border border-rose-800/80 text-rose-200'
                  : 'bg-slate-900 border border-slate-800 text-slate-200'
              }`}
            >
              {msg.imageAttachment && (
                <div className="w-36 h-48 rounded-lg overflow-hidden border border-slate-700/80 mb-2">
                  <img src={msg.imageAttachment} alt="Attachment" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="whitespace-pre-wrap leading-relaxed text-sm">
                {msg.content}
              </div>

              <div
                className={`text-[10px] text-right font-mono ${
                  msg.role === 'user' ? 'text-slate-800' : 'text-slate-500'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-300 border border-slate-700">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 text-xs justify-start items-center">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 text-amber-400 border border-slate-700">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2 text-slate-400 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Hero Gemini is analyzing market comps & reasoning...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Starter Prompts */}
      {messages.length <= 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-shrink-0">
          {starterPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="text-left p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="truncate">{prompt}</span>
            </button>
          ))}
        </div>
      )}

      {/* Selected Item Attachment Preview */}
      {selectedItemAttachment && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 flex-shrink-0">
          <Paperclip className="w-3.5 h-3.5 text-amber-400" />
          <span>Attached item:</span>
          <span className="font-semibold text-white">
            {items.find(i => i.id === selectedItemAttachment)?.proposedName}
          </span>
          <button
            onClick={() => setSelectedItemAttachment(null)}
            className="ml-auto text-slate-500 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex items-center gap-2 flex-shrink-0 shadow-lg">
        {/* Item Attachment Dropdown */}
        <div className="relative">
          <select
            value={selectedItemAttachment || ''}
            onChange={(e) => setSelectedItemAttachment(e.target.value || null)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-2 focus:outline-none cursor-pointer max-w-[140px] truncate"
            title="Attach a card from catalog for appraisal"
          >
            <option value="">Attach Item...</option>
            {items.map((it, idx) => (
              <option key={`${it.id}-${idx}`} value={it.id} className="bg-slate-900">
                {it.proposedName}
              </option>
            ))}
          </select>
        </div>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
          placeholder="Ask Hero Gemini about grading, comps, titles, or Drive sync..."
          className="flex-1 bg-transparent border-0 text-sm text-white placeholder-slate-500 focus:outline-none px-2"
        />

        <button
          onClick={() => handleSend()}
          disabled={isLoading || (!input.trim() && !selectedItemAttachment)}
          className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold transition-all cursor-pointer shadow-md shadow-amber-500/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
