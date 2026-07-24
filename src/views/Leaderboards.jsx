import React, { useState, useEffect } from 'react';
import { Trophy, Code2, Flame, Star, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UserProfileModal from '../components/UserProfileModal';
import { getLevelFromXP, getXPProgress } from '../utils/xpProgression';

const Leaderboards = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('global');
  const [leaderboard, setLeaderboard] = useState([]);
  const [sortBy, setSortBy] = useState('xp');
  const [selectedUserId, setSelectedUserId] = useState(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [activeTab, sortBy]);

  const fetchLeaderboard = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/leaderboard?type=${sortBy}&filter=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <header className="flex justify-between items-end" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>Global Leaderboards</h2>
          <p style={{ color: 'var(--text-secondary)' }}>See how you stack up against the best developers.</p>
        </div>
        
        <div className="flex gap-4">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
          >
            <option value="xp">Sort by XP</option>
            <option value="rating">Sort by Rating</option>
            <option value="streak">Sort by Streak</option>
          </select>

          <div className="flex gap-2 p-1" style={{ background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
            {['global', 'friends'].map(tab => (
              <button
                key={tab}
                style={{
                  padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  background: activeTab === tab ? 'var(--bg-secondary)' : 'transparent',
                  fontWeight: activeTab === tab ? 600 : 400,
                  color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                  textTransform: 'capitalize'
                }}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Rank</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Developer</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Level / XP</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Rating</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Streak</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((u, idx) => {
              const rank = idx + 1;
              const isCurrentUser = user && user._id === u._id;
              return (
                <tr key={u._id} style={{ 
                  borderTop: '1px solid var(--card-border)',
                  background: isCurrentUser ? 'rgba(217, 119, 6, 0.05)' : 'transparent',
                  transition: 'background 0.2s',
                }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                    {rank <= 3 ? <Trophy size={18} color={rank === 1 ? '#F59E0B' : rank === 2 ? '#94A3B8' : '#B45309'} /> : `#${rank}`}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div className="flex items-center gap-3">
                      <img src={u.profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} alt={u.username} style={{ width: 28, height: 28, borderRadius: '50%', cursor: 'pointer' }} onClick={() => setSelectedUserId(u._id)} />
                      <span style={{ fontWeight: isCurrentUser ? 700 : 500, cursor: 'pointer' }} onClick={() => setSelectedUserId(u._id)}>{u.username}</span>
                      {u.badges?.length > 0 && <Star size={14} color="var(--accent-primary)" />}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    {(() => {
                      const prog = getXPProgress(u.xp || 0);
                      return (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: isCurrentUser ? '0.25rem' : 0 }}>
                            <span style={{
                              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                              color: 'white', padding: '0.1rem 0.5rem', borderRadius: '9999px',
                              fontSize: '0.7rem', fontWeight: 700
                            }}>
                              Lv. {prog.currentLevel}
                            </span>
                            <span style={{ fontSize: '0.75rem' }}>
                              <Zap size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {u.xp || 0} XP
                            </span>
                          </div>
                          {isCurrentUser && (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', marginTop: '0.25rem' }}>
                                <span>{prog.xpInCurrentLevel} / {prog.xpRequiredForNextLevel} XP</span>
                                <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{prog.percentage}%</span>
                              </div>
                              <div style={{
                                width: '100%', height: '4px', borderRadius: '9999px',
                                background: 'var(--bg-primary)', overflow: 'hidden'
                              }}>
                                <div style={{
                                  height: '100%', borderRadius: '9999px',
                                  width: `${prog.percentage}%`,
                                  background: 'linear-gradient(90deg, #6366F1, #A78BFA)',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{u.stats?.globalRating || 0}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div className="flex items-center gap-1" style={{ color: 'var(--accent-streak)', fontWeight: 600 }}>
                      <Flame size={16} /> {u.stats?.dailyStreak || 0}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedUserId && <UserProfileModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />}
    </div>
  );
};

export default Leaderboards;
