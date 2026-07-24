import React, { useState, useEffect, useRef } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Bot, Send, Sparkles, Activity } from 'lucide-react';

import { useAuth } from '../context/AuthContext';

const AICoach = () => {
  const { user } = useAuth();
  
  // Skill Analysis State
  const [skillData, setSkillData] = useState(null);
  const [skillLoading, setSkillLoading] = useState(true);
  const [skillError, setSkillError] = useState(null);

  // Chat State
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('aiCoachMessages');
    const timestamp = localStorage.getItem('aiCoachTimestamp');
    if (saved && timestamp && (Date.now() - parseInt(timestamp) < 60 * 60 * 1000)) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      { role: 'assistant', content: "Hello! I'm your DevArena AI Coach. I'm analyzing your skills now. How can I help you today?" }
    ];
  });
  
  useEffect(() => {
    localStorage.setItem('aiCoachMessages', JSON.stringify(messages));
    localStorage.setItem('aiCoachTimestamp', Date.now().toString());
  }, [messages]);
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');

  // Fetch Skills
  useEffect(() => {
    const fetchSkills = async () => {
      setSkillLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/users/skills`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch skill data');
        const data = await res.json();
        setSkillData(data);
      } catch (err) {
        console.error(err);
        setSkillError(err.message);
      } finally {
        setSkillLoading(false);
      }
    };
    fetchSkills();
  }, []);

  const handleSend = async (text) => {
    if (!text.trim() || loading) return;
    
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ messages: newMessages })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting right now." }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "An error occurred while connecting to the AI Coach." }]);
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--card-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{data.subject}</h4>
          <p style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.85rem' }}>Score: {data.A}/100</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>Est. Problems Solved: {data.problems}</p>
          <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--card-border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            💡 {data.suggestion}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-grid" style={{ height: 'calc(100vh - 4rem)', gridTemplateColumns: '1fr 2fr' }}>
      {/* Skill Analysis Panel */}
      <div className="card flex flex-col h-full" style={{ overflowY: 'auto' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Skill Analysis</h3>
        
        {skillLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="animate-pulse" style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-secondary)' }} />
            <p style={{ color: 'var(--text-muted)' }}>Analyzing your cross-platform history...</p>
          </div>
        ) : skillError ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Activity size={32} color="var(--accent-danger)" style={{ marginBottom: '1rem' }} />
            <p style={{ color: 'var(--accent-danger)' }}>{skillError}</p>
          </div>
        ) : skillData && skillData.radarData ? (
          <>
            <div style={{ width: '100%', height: '350px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={skillData.radarData}>
                  <PolarGrid stroke="var(--card-border)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Radar name="Proficiency" dataKey="A" stroke="var(--accent-primary)" fill="var(--accent-primary)" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            
            {skillData.aiSummary && (
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', borderLeft: '4px solid var(--accent-primary)', marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <Sparkles size={14} style={{ display: 'inline', color: 'var(--accent-primary)', marginRight: '4px' }} />
                  {skillData.aiSummary}
                </p>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Strengths</h4>
              <div className="flex gap-2 flex-wrap">
                {skillData.strengths.map(area => (
                  <span key={area.subject} className="badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-success)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                    {area.subject} ({area.A}%)
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Focus Areas</h4>
              <div className="flex gap-2 flex-wrap">
                {skillData.focusAreas.map(area => (
                  <span key={area.subject} className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    {area.subject} ({area.A}%)
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Chat Interface */}
      <div className="card flex flex-col h-full" style={{ padding: '0', overflow: 'hidden' }}>
        <header className="flex items-center gap-2" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--card-border)', background: 'var(--bg-secondary)' }}>
          <Bot size={20} color="var(--accent-primary)" />
          <h3 style={{ fontWeight: 600 }}>DevArena Coach</h3>
        </header>

        <div style={{ flex: 1, minHeight: 0, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div style={{
                maxWidth: '80%', padding: '0.75rem 1rem', borderRadius: '12px',
                background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : '12px',
                borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '12px',
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--card-border)' }}>
          <div className="flex gap-2 mb-3 overflow-x-auto" style={{ paddingBottom: '0.5rem' }}>
            <button className="btn btn-outline" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }} onClick={() => handleSend("Analyze my recent Codeforces slump")}>
              <Sparkles size={14} /> Analyze my recent Codeforces slump
            </button>
            <button className="btn btn-outline" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }} onClick={() => handleSend("Give me a DP roadmap for interview prep")}>
              <Sparkles size={14} /> Give me a DP roadmap for interview prep
            </button>
          </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything..." 
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
                  disabled={loading}
                />
                <button className="btn btn-primary" onClick={() => handleSend(input)} disabled={loading}>
                  <Send size={20} />
                </button>
              </div>
        </div>
      </div>
    </div>
  );
};

export default AICoach;
