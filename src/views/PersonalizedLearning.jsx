import React, { useState, useEffect } from 'react';
import { BookOpen, Clock, Target, ArrowRight, Activity, Zap, RefreshCw } from 'lucide-react';

const PersonalizedLearning = () => {
  const [learningPlan, setLearningPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLearningPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/learning-plan`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to generate learning plan.');
      }
      const data = await res.json();
      setLearningPlan(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not connect to the AI service. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLearningPlan();
  }, []);

  const getDifficultyColor = (diff) => {
    switch (diff?.toLowerCase()) {
      case 'easy': return 'var(--accent-success)';
      case 'medium': return 'var(--accent-warning)';
      case 'hard': return 'var(--accent-danger)';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <BookOpen size={28} style={{ color: 'var(--accent-primary)' }} />
            Personalized Learning Path
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Gemma AI-powered roadmap tailored to your specific weak points and goals.
          </p>
        </div>
        <button className="clay-btn btn-outline" onClick={fetchLearningPlan} disabled={loading}>
          <RefreshCw size={18} className={loading ? "animate-pulse" : ""} />
          {loading ? 'Analyzing Stats...' : 'Refresh Plan'}
        </button>
      </div>

      {loading ? (
        <div className="clay-card flex flex-col items-center justify-center" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <div className="animate-pulse" style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-primary)', opacity: 0.5, marginBottom: '1.5rem' }}></div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Gemma is analyzing your performance...</h3>
          <p style={{ color: 'var(--text-muted)' }}>Generating your personalized coding roadmap.</p>
        </div>
      ) : error ? (
        <div className="clay-card" style={{ borderLeft: '4px solid var(--accent-danger)', padding: '2rem' }}>
          <h3 style={{ color: 'var(--accent-danger)', fontWeight: 700, marginBottom: '0.5rem' }}>AI Service Unavailable</h3>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      ) : (
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)', gap: '2rem' }}>
          
          {/* Roadmap Section */}
          <div className="clay-card" style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '1.5rem' }}>
              <Target size={22} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Recommended Topics</h3>
            </div>
            
            <div style={{ position: 'relative', padding: '2rem 0', margin: '0 1rem' }}>
              {/* Central dashed line */}
              <div style={{ position: 'absolute', left: '50%', top: '2rem', bottom: '2rem', width: '4px', borderLeft: '4px dashed var(--accent-primary)', transform: 'translateX(-50%)', opacity: 0.4 }}></div>
              
              {learningPlan?.roadmap?.map((item, idx) => {
                const isLeft = idx % 2 === 0;
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: isLeft ? 'flex-start' : 'flex-end', width: '100%', position: 'relative', marginBottom: '3rem' }}>
                    
                    {/* The Node on the central line */}
                    <div style={{
                      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-primary)', border: '4px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--accent-primary)', zIndex: 10, boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }}>
                      {idx + 1}
                    </div>
                    
                    {/* The Topic Card */}
                    <div className="clay-recessed" style={{
                       width: '42%',
                       padding: '1.5rem',
                       position: 'relative',
                       display: 'flex',
                       flexDirection: 'column',
                       gap: '0.75rem',
                       transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                       zIndex: 5
                    }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                      
                       {/* Connector to center line */}
                       <div style={{
                         position: 'absolute',
                         top: '50%',
                         [isLeft ? 'right' : 'left']: '-19%', // approx 8% of total width (42% + 8% = 50%)
                         width: '19%',
                         height: '4px',
                         background: 'var(--accent-primary)',
                         transform: 'translateY(-50%)',
                         opacity: 0.4,
                         zIndex: -1
                       }}></div>

                       <div className="flex justify-between items-start gap-2">
                         <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{item.topic}</h4>
                         <span className="badge" style={{ backgroundColor: 'transparent', color: getDifficultyColor(item.difficulty), border: `1px solid ${getDifficultyColor(item.difficulty)}`, fontSize: '0.7rem', flexShrink: 0 }}>
                           {item.difficulty}
                         </span>
                       </div>
                       
                       <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.reason}</p>
                       
                       {item.steps && item.steps.length > 0 && (
                         <div style={{ marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                           <ul style={{ margin: 0, paddingLeft: '1rem', listStyleType: 'disc', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                             {item.steps.map((step, sIdx) => (
                               <li key={sIdx} style={{ marginBottom: '0.15rem' }}>{step}</li>
                             ))}
                           </ul>
                         </div>
                       )}
                       
                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                         <Clock size={14} style={{ color: 'var(--accent-primary)' }} /> {item.estimatedTime}
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Challenges Section */}
          <div className="clay-card" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column' }}>
             <div className="flex items-center gap-2" style={{ marginBottom: '1.5rem' }}>
              <Zap size={22} style={{ color: 'var(--accent-streak)' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Daily Challenges</h3>
            </div>

            <div className="flex flex-col gap-4">
              {learningPlan?.dailyChallenges?.map((challenge, idx) => (
                <div key={idx} style={{ padding: '1.25rem', borderRadius: '20px', background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: getDifficultyColor(challenge.difficulty) }} />
                  <div className="flex justify-between items-start" style={{ marginBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{challenge.title}</h4>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: getDifficultyColor(challenge.difficulty) }}>
                      {challenge.difficulty}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {challenge.reason}
                  </p>
                  <button className="clay-btn btn-primary w-full" style={{ marginTop: '1rem', padding: '0.5rem', fontSize: '0.85rem' }}>
                    Solve Now
                  </button>
                </div>
              ))}
            </div>

            <div className="clay-recessed" style={{ marginTop: 'auto', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
              <Activity size={18} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '0.8rem' }}>Challenges refresh every 24 hours to match your evolving skill level.</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default PersonalizedLearning;
