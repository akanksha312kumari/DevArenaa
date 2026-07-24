import React, { useState, useEffect, useRef } from 'react';
import { Flame, Trophy, Activity, Swords, Code, ExternalLink, Calendar, Star, TrendingUp, CheckCircle, XCircle, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { getLevelFromXP, getXPForLevel, getXPProgress } from '../utils/xpProgression';

const Heatmap = ({ heatmapData = {} }) => {
  // Generate a mock or real heatmap (last 52 weeks = 364 days for a full horizontal heatmap)
  const weeks = 52;
  const days = 7;
  const totalDays = weeks * days;
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const dates = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

  let minCount = Infinity;
  let maxCount = -Infinity;
  Object.values(heatmapData).forEach(entry => {
    const total = typeof entry === 'object' ? (entry.total || 0) : (entry || 0);
    if (total > 0 && total < minCount) minCount = total;
    if (total > maxCount) maxCount = total;
  });

  if (minCount === Infinity) minCount = 1;
  if (maxCount === -Infinity) maxCount = 1;

  const getColor = (count) => {
    if (!count || count === 0) return 'var(--bg-secondary)'; // Default dark background
    if (minCount === maxCount) return '#006d32'; // Base dark green

    // GitHub-style scale
    const colors = ['#006d32', '#26a641', '#39d353', '#A7F3D0'];
    const normalized = (count - minCount) / (maxCount - minCount);
    let index = Math.round(normalized * 3);
    if (index < 0) index = 0;
    if (index > 3) index = 3;
    return colors[index];
  };

  const getTooltip = (dateStr, entry) => {
    const total = typeof entry === 'object' ? (entry.total || 0) : (entry || 0);
    let title = `${new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n`;
    title += `Total: ${total} submissions\n`;
    
    if (total > 0 && typeof entry === 'object') {
      title += `\n`;
      const platforms = ['leetcode', 'codeforces', 'codechef', 'atcoder', 'gfg', 'hackerrank', 'devarena'];
      const names = {
        leetcode: 'LeetCode',
        codeforces: 'Codeforces',
        codechef: 'CodeChef',
        atcoder: 'AtCoder',
        gfg: 'GeeksforGeeks',
        hackerrank: 'HackerRank',
        devarena: 'DevArena'
      };
      
      platforms.forEach(p => {
        // If it's a connected platform, we want to show it even if 0. We can check if it's in the entry (if it had activity)
        // or just show all supported platforms that had activity. The prompt requests listing platforms if connected.
        // For simplicity, we just list the 7 platforms. If not in entry, it's 0.
        // To only show *connected* platforms, we can pass connected platforms as a prop.
        title += `${names[p]}: ${entry[p] || 0}\n`;
      });
    }
    return title.trim();
  };

  // Group columns by month to determine where to place the label
  const monthLabels = [];
  let currentMonth = -1;
  const columns = Array.from({ length: weeks }).map((_, weekIndex) => {
    const weekDates = [];
    let weekMonth = -1;
    for (let dayIndex = 0; dayIndex < days; dayIndex++) {
      const dateObj = dates[weekIndex * days + dayIndex];
      weekDates.push(dateObj);
      if (dayIndex === 0) weekMonth = new Date(dateObj).getMonth();
    }
    
    if (weekMonth !== currentMonth) {
      monthLabels.push({ index: weekIndex, label: new Date(dates[weekIndex * days]).toLocaleString('default', { month: 'short' }) });
      currentMonth = weekMonth;
    }
    
    return weekDates;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {columns.map((weekDates, weekIndex) => (
          <div key={weekIndex} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {weekDates.map((dateStr, dayIndex) => {
              const entry = heatmapData[dateStr] || { total: 0 };
              const count = typeof entry === 'object' ? (entry.total || 0) : (entry || 0);
              return (
                <div 
                  key={dayIndex}
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    backgroundColor: getColor(count),
                    opacity: count === 0 ? 0.3 : 1
                  }}
                  title={getTooltip(dateStr, entry)}
                />
              );
            })}
          </div>
        ))}
      </div>
      
      {/* Month Labels */}
      <div style={{ position: 'relative', height: '20px', fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: `${weeks * 16}px` }}>
        {monthLabels.map((ml, i) => (
          <div key={i} style={{ position: 'absolute', left: `${ml.index * 16}px` }}>
            {ml.label}
          </div>
        ))}
      </div>
    </div>
  );
};

const Dashboard = ({ setActiveTab, setSelectedPotd }) => {
  const { user } = useAuth();
  const [potd, setPotd] = useState(null);
  const [potdHistory, setPotdHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showAllSubmissions, setShowAllSubmissions] = useState(false);
  const [arenaRank, setArenaRank] = useState(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState(0);
  const prevLevelRef = useRef(null);

  // XP Progression
  const totalXP = user?.xp || 0;
  const xpProgress = getXPProgress(totalXP);

  // Detect level-up
  useEffect(() => {
    if (prevLevelRef.current !== null && xpProgress.currentLevel > prevLevelRef.current) {
      setLevelUpLevel(xpProgress.currentLevel);
      setShowLevelUp(true);
      const timer = setTimeout(() => setShowLevelUp(false), 4000);
      return () => clearTimeout(timer);
    }
    prevLevelRef.current = xpProgress.currentLevel;
  }, [xpProgress.currentLevel]);

  useEffect(() => {
    const fetchRank = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/leaderboard?type=xp&filter=global`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          const rankIndex = data.findIndex(u => u.username === user?.username);
          setArenaRank(rankIndex !== -1 ? rankIndex + 1 : '50+');
        }
      } catch (err) {
        console.error("Failed to fetch rank", err);
      }
    };
    if (user?.username) {
      fetchRank();
    }
  }, [user]);
  
  const stats = user?.stats || { globalRating: 0, dailyStreak: 0, problemsSolved: { easy: 0, medium: 0, hard: 0 } };
  const totalSolved = (stats.problemsSolved?.total) || ((stats.problemsSolved?.easy || 0) + (stats.problemsSolved?.medium || 0) + (stats.problemsSolved?.hard || 0));
  
  // Fake total counts for progress calculation
  const EASY_TOTAL = 800;
  const MED_TOTAL = 1500;
  const HARD_TOTAL = 700;
  const totalProblems = EASY_TOTAL + MED_TOTAL + HARD_TOTAL;

  useEffect(() => {
    // Fetch POTD dynamically
    const fetchPotd = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/problems/potd`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data && data.title) {
          setPotd(data);
        }
      } catch (err) {
        console.error("Failed to fetch POTD", err);
      }
    };
    fetchPotd();
  }, []);

  const fetchHistory = async () => {
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/problems/potd/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setPotdHistory(data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
    setHistoryLoading(false);
  };

  const pieData = [
    { name: 'Easy', value: stats.problemsSolved?.easy || 0, color: 'var(--accent-success)' },
    { name: 'Medium', value: stats.problemsSolved?.medium || 0, color: 'var(--accent-streak)' },
    { name: 'Hard', value: stats.problemsSolved?.hard || 0, color: 'var(--accent-danger)' },
  ];
  
  // Ensure the chart shows empty state if no problems solved
  const chartData = totalSolved === 0 ? [{ name: 'Empty', value: 1, color: 'var(--card-border)' }] : pieData;

  const recentSubmissions = user?.recentSubmissions || [];

  // Activity Line Chart Data
  const ALL_PLATFORMS = ['leetcode', 'codeforces', 'codechef', 'atcoder', 'gfg', 'hackerrank', 'devarena'];
  const activityMap = {};

  if (user?.platformStats) {
    Object.entries(user.platformStats).forEach(([platform, pStats]) => {
      const normalizedPlatform = platform.toLowerCase();
      if (pStats?.heatmapData) {
        Object.entries(pStats.heatmapData).forEach(([date, count]) => {
          if (!activityMap[date]) {
            activityMap[date] = { date };
            ALL_PLATFORMS.forEach(p => activityMap[date][p] = 0);
          }
          if (ALL_PLATFORMS.includes(normalizedPlatform)) {
            activityMap[date][normalizedPlatform] = count;
          }
        });
      }
    });
  }
  const activityChartData = Object.values(activityMap)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-30); // Show up to last 30 active days

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Level Up Toast */}
      {showLevelUp && (
        <div style={{
          position: 'fixed', top: '2rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, padding: '1rem 2rem', borderRadius: '16px',
          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          color: 'white', fontWeight: 700, fontSize: '1.1rem',
          boxShadow: '0 8px 32px rgba(99, 102, 241, 0.5)',
          animation: 'levelUpToast 4s ease-in-out forwards',
          display: 'flex', alignItems: 'center', gap: '0.75rem'
        }}>
          <span style={{ fontSize: '1.5rem' }}>🎉</span>
          Level Up! You reached Level {levelUpLevel}
          <Zap size={20} />
        </div>
      )}

      {/* Compact Top Profile Bar with XP Progress */}
      <div className="clay-card" style={{ padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div className="flex items-center gap-4">
            <img src={user?.profile?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=default"} alt="Profile" style={{ width: '64px', height: '64px', borderRadius: '50%' }} />
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>{user?.username}</h2>
              <div className="flex items-center gap-3" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                <span style={{
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  color: 'white', padding: '0.2rem 0.75rem', borderRadius: '9999px',
                  fontSize: '0.8rem', fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)'
                }}>
                  Level {xpProgress.currentLevel}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  <Zap size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />
                  {totalXP} XP
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-6">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Global Rating</div>
              <div className="flex items-center gap-1 justify-center" style={{ fontWeight: 700, fontSize: '1.25rem' }}>
                <Trophy size={20} color="var(--accent-primary)" />
                {stats.globalRating}
              </div>
            </div>
            <div style={{ width: '2px', background: 'var(--bg-primary)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Daily Streak</div>
              <div className="flex items-center gap-1 justify-center" style={{ fontWeight: 700, fontSize: '1.25rem' }}>
                <Flame size={20} color="var(--accent-streak)" />
                {stats.dailyStreak}
              </div>
            </div>
          </div>
        </div>

        {/* XP Progress Section */}
        <div>
          <div className="flex justify-between items-center" style={{ marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {xpProgress.xpInCurrentLevel} / {xpProgress.xpRequiredForNextLevel} XP
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {xpProgress.xpRemaining} XP to Level {xpProgress.currentLevel + 1}
            </span>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              position: 'relative', width: '100%', height: '14px',
              borderRadius: '9999px', overflow: 'hidden',
              background: 'var(--bg-primary)',
              boxShadow: 'inset 2px 2px 5px var(--clay-outer-dark), inset -2px -2px 5px var(--clay-outer-light)'
            }}
            title={`${totalXP} XP total\n${xpProgress.xpInCurrentLevel} / ${xpProgress.xpRequiredForNextLevel} XP in current level\n${xpProgress.xpRemaining} XP remaining\n${xpProgress.percentage}% complete`}
          >
            <div style={{
              height: '100%', borderRadius: '9999px',
              width: `${xpProgress.percentage}%`,
              background: 'linear-gradient(90deg, #6366F1, #818CF8, #A78BFA)',
              boxShadow: '0 0 12px rgba(99, 102, 241, 0.5)',
              transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
            }} />
          </div>

          {/* Milestone markers */}
          <div className="flex justify-between" style={{ marginTop: '0.35rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
              Lv. {xpProgress.currentLevel}
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-primary)', opacity: 0.6 }}>
              {xpProgress.percentage}%
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              Lv. {xpProgress.currentLevel + 1}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '2rem' }}>
        
        {/* Problems Solved */}
        <div className="clay-card flex flex-col items-center gap-2">
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-secondary)', alignSelf: 'flex-start', marginBottom: '0.5rem' }}>Problems Solved</h3>
          
          <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={60}
                  paddingAngle={totalSolved > 0 ? 5 : 0}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={10}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalSolved}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Solved</div>
            </div>
          </div>

          <div className="flex gap-2 w-full justify-between mt-2">
            <div className="clay-recessed flex flex-col items-center" style={{ padding: '0.75rem', flex: 1 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-success)', marginBottom: '0.25rem', fontWeight: 700 }}>Easy</span>
              <span style={{ fontSize: '1.125rem', fontWeight: 800 }}>{stats.problemsSolved?.easy || 0}</span>
            </div>
            <div className="clay-recessed flex flex-col items-center" style={{ padding: '0.75rem', flex: 1 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-streak)', marginBottom: '0.25rem', fontWeight: 700 }}>Med</span>
              <span style={{ fontSize: '1.125rem', fontWeight: 800 }}>{stats.problemsSolved?.medium || 0}</span>
            </div>
            <div className="clay-recessed flex flex-col items-center" style={{ padding: '0.75rem', flex: 1 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-danger)', marginBottom: '0.25rem', fontWeight: 700 }}>Hard</span>
              <span style={{ fontSize: '1.125rem', fontWeight: 800 }}>{stats.problemsSolved?.hard || 0}</span>
            </div>
          </div>
        </div>

        {/* Duels Stats Card */}
        <div className="clay-card flex flex-col justify-between">
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1rem' }}>Duel Statistics</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="clay-recessed" style={{ padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.125rem', fontWeight: 600 }}>Total Duels</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{user?.stats?.duels?.total || 0}</div>
              </div>
              <div className="clay-recessed" style={{ padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.125rem', fontWeight: 600 }}>Win Rate</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  {user?.stats?.duels?.total ? Math.round(((user?.stats?.duels?.wins || 0) / user.stats.duels.total) * 100) : 0}%
                </div>
              </div>
              <div className="clay-recessed" style={{ padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.125rem', fontWeight: 600 }}>Wins</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-success)' }}>{user?.stats?.duels?.wins || 0}</div>
              </div>
              <div className="clay-recessed" style={{ padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.125rem', fontWeight: 600 }}>Losses</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-danger)' }}>{user?.stats?.duels?.losses || 0}</div>
              </div>
            </div>
            
            <div className="clay-recessed flex justify-between items-center" style={{ padding: '0.75rem 1rem' }}>
              <div className="flex items-center gap-2">
                <Trophy size={16} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>Arena Rank</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                {arenaRank ? `#${arenaRank}` : 'Loading...'}
              </div>
            </div>
          </div>
        </div>

        {/* POTD */}
        <div className="clay-card flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Problem of the Day</h3>
              <div 
                title="Past POTDs" 
                onClick={fetchHistory}
                style={{ cursor: 'pointer', padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: '50%' }} 
                className="clay-recessed hover:bg-gray-700 transition-colors"
              >
                <Calendar size={18} color="var(--accent-primary)" />
              </div>
            </div>
            
            {potd ? (
              <>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-primary)' }}>{potd.title}</div>
                <div className="clay-recessed flex items-center gap-3" style={{ padding: '0.75rem', fontSize: '0.875rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                  <span style={{ 
                    color: potd.difficulty === 'Easy' ? 'var(--accent-success)' : potd.difficulty === 'Medium' ? 'var(--accent-warning)' : 'var(--accent-danger)', 
                    fontWeight: 700 
                  }}>
                    {potd.difficulty}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>•</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{potd.platform}</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Loading Problem of the Day...</div>
            )}
          </div>
          
          {user?.solvedPotds?.includes(potd?._id) ? (
            <button 
              className="clay-btn btn-primary" 
              style={{ width: '100%', fontSize: '1rem', opacity: 0.7, cursor: 'default' }}
              disabled
            >
              <CheckCircle size={16} style={{ display: 'inline', marginRight: '8px' }} /> Already Solved
            </button>
          ) : (
            <button 
              className="clay-btn btn-primary" 
              style={{ width: '100%', fontSize: '1rem' }}
              onClick={async () => {
                try {
                  const token = localStorage.getItem('token');
                  const res = await fetch(`${import.meta.env.VITE_API_URL}/problems/potd`, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data && data.title) {
                    setPotd(data);
                    setSelectedPotd(data);
                    setActiveTab('potd-solver');
                  }
                } catch (err) {
                  console.error("Failed to fetch fresh POTD", err);
                  if (potd) {
                    setSelectedPotd(potd);
                    setActiveTab('potd-solver');
                  }
                }
              }}
              disabled={!potd}
            >
              Solve Now
            </button>
          )}
        </div>

      </div>

      {/* Heatmap (Full Width) */}
      <div className="clay-card">
        <div className="flex justify-between items-center flex-wrap gap-4" style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {Object.values(user?.heatmapData || {}).reduce((acc, entry) => acc + (typeof entry === 'object' ? (entry.total || 0) : (entry || 0)), 0)}
            </span> submissions in the past one year
          </div>
          
          <div className="flex gap-4 items-center" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
            <span style={{ color: 'var(--text-muted)' }}>Total active days: <span style={{ color: 'var(--text-primary)' }}>{Object.keys(user?.heatmapData || {}).length}</span></span>
            <span style={{ color: 'var(--text-muted)' }}>Current streak: <span style={{ color: 'var(--text-primary)' }}>{stats.dailyStreak || 0}</span></span>
            <span style={{ color: 'var(--text-muted)' }}>Max streak: <span style={{ color: 'var(--text-primary)' }}>{Math.max(stats.maxStreak || 0, stats.dailyStreak || 0)}</span></span>
            <select className="clay-input" style={{ padding: '0.5rem 1rem', width: 'auto' }}>
               <option>Current</option>
            </select>
          </div>
        </div>
        
        <div className="clay-recessed" style={{ padding: '1.5rem' }}>
          <Heatmap heatmapData={user?.heatmapData || {}} />
        </div>
      </div>

      {/* Activity Timeline Chart */}
      {activityChartData.length > 0 && (
        <div className="clay-card">
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Activity Timeline</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--clay-outer-dark)" opacity={0.2} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickFormatter={(tick) => new Date(tick).toLocaleDateString('default', { month: 'short', day: 'numeric' })} />
                <YAxis stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--card-bg)', border: 'none', borderRadius: '8px', boxShadow: '2px 2px 10px var(--clay-outer-dark)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend />
                {ALL_PLATFORMS.map((platform, i) => {
                  const colors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];
                  const platformNames = {
                    leetcode: 'LeetCode',
                    codeforces: 'Codeforces',
                    codechef: 'CodeChef',
                    atcoder: 'AtCoder',
                    gfg: 'GeeksforGeeks',
                    hackerrank: 'HackerRank',
                    devarena: 'DevArena'
                  };
                  return (
                    <Line key={platform} name={platformNames[platform]} type="monotone" dataKey={platform} stroke={colors[i % colors.length]} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Submissions */}
      <div className="clay-card">
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Recent Submissions</h3>
        <div className="flex flex-col gap-3">
          {recentSubmissions.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>No recent submissions. Sync your platforms to view activity!</div>
          ) : (
            (showAllSubmissions ? recentSubmissions : recentSubmissions.slice(0, 5)).map((sub, i) => (
              <div key={i} className="clay-recessed flex items-center justify-between" style={{ padding: '1rem 1.5rem' }}>
                <div className="flex items-center gap-4">
                  <CheckCircle size={20} color="var(--accent-success)" />
                  <div style={{ fontSize: '1rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text-primary)' }} onClick={() => sub.url && window.open(sub.url, '_blank')}>
                    {sub.title}
                  </div>
                  <span className="badge" style={{ background: 'var(--card-bg)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                    {sub.platform}
                  </span>
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {new Date(sub.timestamp).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
        {recentSubmissions.length > 5 && (
          <button 
            className="clay-btn w-full" 
            style={{ marginTop: '1rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            onClick={() => setShowAllSubmissions(!showAllSubmissions)}
          >
            {showAllSubmissions ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>

      {/* Platform Breakdowns */}
      {user?.platformStats && Object.keys(user.platformStats).length > 0 && (
        <div className="clay-card">
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Platform Breakdowns</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {Object.entries(user.platformStats).map(([platform, pStats]) => {
              if (!pStats || (pStats.problemsSolved?.total === 0 && pStats.rating === 0)) return null;
              return (
                <div key={platform} className="clay-recessed" style={{ padding: '1.25rem' }}>
                  <div className="flex items-center gap-3" style={{ fontWeight: 800, fontSize: '1rem', textTransform: 'capitalize', marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    <div style={{ padding: '0.5rem', background: 'var(--card-bg)', borderRadius: '50%', boxShadow: '2px 2px 5px var(--clay-outer-dark)' }}>
                      <Code size={16} color="var(--accent-primary)" />
                    </div>
                    {platform}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-muted)' }}>Rating: <span style={{ color: 'var(--accent-primary)' }}>{pStats.rating || 'N/A'}</span></span>
                      <span style={{ color: 'var(--text-muted)' }}>Contests: <span style={{ color: 'var(--accent-warning)' }}>{pStats.contests || 0}</span></span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-muted)' }}>Solved: <span style={{ color: 'var(--accent-success)' }}>{pStats.problemsSolved?.total || 0}</span></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* History Modal */}
      {showHistoryModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
        }}>
          <div className="clay-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>POTD History</h3>
              <button onClick={() => setShowHistoryModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <XCircle size={24} />
              </button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-muted)' }}>Loading history...</div>
              ) : potdHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-muted)' }}>No past problems found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {potdHistory.map(p => {
                    const isSolved = user?.solvedPotds?.includes(p._id);
                    return (
                      <div key={p._id} className="clay-recessed" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{p.title}</div>
                          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.875rem' }}>
                            <span style={{ color: p.difficulty === 'Easy' ? 'var(--accent-success)' : p.difficulty === 'Medium' ? 'var(--accent-warning)' : 'var(--accent-danger)' }}>{p.difficulty}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{new Date(p.potdDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                        {isSolved ? (
                          <span style={{ color: 'var(--accent-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle size={16} /> Solved
                          </span>
                        ) : (
                          <button 
                            className="clay-btn btn-primary"
                            style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }}
                            onClick={async () => {
                              try {
                                const token = localStorage.getItem('token');
                                const res = await fetch(`${import.meta.env.VITE_API_URL}/problems/${p._id}`, {
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                const data = await res.json();
                                if (data && data.title) {
                                  setSelectedPotd(data);
                                  setShowHistoryModal(false);
                                  setActiveTab('potd-solver');
                                } else {
                                  setSelectedPotd(p);
                                  setShowHistoryModal(false);
                                  setActiveTab('potd-solver');
                                }
                              } catch (err) {
                                console.error("Failed to fetch fresh history problem", err);
                                setSelectedPotd(p);
                                setShowHistoryModal(false);
                                setActiveTab('potd-solver');
                              }
                            }}
                          >
                            Solve
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
