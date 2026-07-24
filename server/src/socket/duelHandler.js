const axios = require('axios');
const User = require('../models/User');
const Duel = require('../models/Duel');
const gamificationService = require('../services/gamificationService');
const platformService = require('../services/platformService');
const judgingService = require('../services/judgingService');
const mockProblems = require('../data/mockProblems');

const activeDuels = new Map(); // duelId -> duel state
const socketToDuel = new Map(); // socket.id -> duelId
let matchmakingQueue = []; // [{ socketId, userId, user: { id, username, avatar, platforms } }]

module.exports = (io, socket, connectedUsers) => {
  // --- Challenge Logic ---
  socket.on('send_challenge', (data) => {
    const { targetUserId, problem, timeLimit } = data;
    const senderId = connectedUsers.get(socket.id);
    
    // Notify the target user (if they are online and authenticated)
    io.to(targetUserId).emit('challenge_received', {
      senderId,
      problem,
      timeLimit,
      challengeId: `chal_${Date.now()}` // Basic unique ID for the challenge
    });
  });

  // --- Random Matchmaking Logic ---
  const checkMatchmakingQueue = () => {
    if (matchmakingQueue.length >= 2) {
      const p1Data = matchmakingQueue.shift();
      const p2Data = matchmakingQueue.shift();

      const duelId = `duel_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const randomProblemIndex = Math.floor(Math.random() * mockProblems.length);
      const fullProblem = mockProblems[randomProblemIndex];
      const timeLimit = 15;

      activeDuels.set(duelId, {
        id: duelId,
        players: [
          { ...p1Data.user, status: 'Ready', maxPassed: 0 },
          { ...p2Data.user, status: 'Ready', maxPassed: 0 }
        ],
        problem: fullProblem,
        timeLimit,
        status: 'starting',
        startTime: Date.now() + 3000,
        endTime: Date.now() + 3000 + (timeLimit * 60 * 1000)
      });

      const duelState = activeDuels.get(duelId);

      io.to(p1Data.socketId).emit('match_found', duelState);
      io.to(p2Data.socketId).emit('match_found', duelState);

      startDuelTimer(io, duelId);
    }
  };

  socket.on('find_random_match', async () => {
    const userId = connectedUsers.get(socket.id);
    if (!userId) return;

    // Check if user is already in queue
    const existingIndex = matchmakingQueue.findIndex(p => p.userId === userId);
    if (existingIndex !== -1) return; // Already in queue

    try {
      const userObj = await User.findById(userId).select('username profile stats platforms');
      const user = { id: userId, username: userObj?.username, avatar: userObj?.profile?.avatar, platforms: userObj?.platforms };
      
      matchmakingQueue.push({ socketId: socket.id, userId, user });
      checkMatchmakingQueue();
    } catch (e) {
      console.error('Error finding random match:', e);
    }
  });

  socket.on('cancel_match_search', () => {
    const userId = connectedUsers.get(socket.id);
    matchmakingQueue = matchmakingQueue.filter(p => p.userId !== userId);
  });

  socket.on('disconnect', () => {
    matchmakingQueue = matchmakingQueue.filter(p => p.socketId !== socket.id);
    
    // Handle duel disconnect
    const duelId = socketToDuel.get(socket.id);
    if (duelId) {
      const duel = activeDuels.get(duelId);
      const userId = connectedUsers.get(socket.id);
      if (duel && (duel.status === 'active' || duel.status === 'starting')) {
        handleDuelForfeit(io, duel, userId);
      }
      socketToDuel.delete(socket.id);
    }
  });

  socket.on('leave_duel', (duelId) => {
    const duel = activeDuels.get(duelId);
    if (!duel) return;
    const userId = connectedUsers.get(socket.id);
    if (duel.status === 'active' || duel.status === 'starting') {
      handleDuelForfeit(io, duel, userId);
    }
    socketToDuel.delete(socket.id);
  });

  socket.on('accept_challenge', async (data) => {
    const { senderId, challengeId, problem, timeLimit } = data;
    const acceptorId = connectedUsers.get(socket.id);
    
    try {
      const sender = await User.findById(senderId).select('username profile stats platforms');
      const acceptor = await User.findById(acceptorId).select('username profile stats platforms');
      
      const p1 = { id: senderId, username: sender?.username, avatar: sender?.profile?.avatar, platforms: sender?.platforms };
      const p2 = { id: acceptorId, username: acceptor?.username, avatar: acceptor?.profile?.avatar, platforms: acceptor?.platforms };
    
      const duelId = `duel_${Date.now()}`;
      
      const searchStr = (problem.url || problem.problemId || '').toString().toLowerCase().trim();
      const fullProblem = mockProblems.find(p => 
        p.url.toLowerCase().includes(searchStr) || 
        p.id.toLowerCase() === searchStr || 
        p.questionId === searchStr
      ) || mockProblems[0];
      activeDuels.set(duelId, {
        id: duelId,
        players: [p1, p2].map(p => ({ ...p, maxPassed: 0 })),
        problem: fullProblem, // Use full mock problem with test cases
        timeLimit: timeLimit || 15,
        status: 'starting',
        startTime: Date.now() + 3000,
        endTime: Date.now() + 3000 + ((timeLimit || 15) * 60 * 1000)
      });

      const duelState = activeDuels.get(duelId);

      io.to(senderId).emit('challenge_accepted', duelState);
      io.to(acceptorId).emit('challenge_accepted', duelState);

      startDuelTimer(io, duelId);
    } catch (e) {
      console.error('Error accepting challenge:', e);
    }
  });



  socket.on('reject_challenge', (data) => {
    const { senderId } = data;
    io.to(senderId).emit('challenge_rejected', {
      message: 'Your challenge was declined.'
    });
  });

  // --- Group Challenge Logic ---
  socket.on('send_group_challenge', async (data) => {
    const { roomId, problem, timeLimit } = data;
    const senderId = connectedUsers.get(socket.id);
    
    try {
      const sender = await User.findById(senderId).select('username profile stats platforms');
      const p1 = { id: senderId, username: sender?.username, avatar: sender?.profile?.avatar, platforms: sender?.platforms, status: 'Ready' };

      const searchStrGroup = (problem.problemId || problem.url || '').toString().toLowerCase().trim();
      const fullProblem = mockProblems.find(p => 
        p.url.toLowerCase().includes(searchStrGroup) || 
        p.id.toLowerCase() === searchStrGroup || 
        p.questionId === searchStrGroup
      ) || mockProblems[0];

      const duelId = `group_duel_${Date.now()}`;
      activeDuels.set(duelId, {
        id: duelId,
        roomId,
        isGroup: true,
        players: [{ ...p1, maxPassed: 0 }], // Array of participants
        problem: fullProblem,
        timeLimit: timeLimit || 15,
        status: 'lobby',
        lobbyEndTime: Date.now() + 15000 // 15 seconds to accept
      });

      const duelState = activeDuels.get(duelId);
      
      // Notify the room
      io.to(roomId).emit('group_challenge_received', {
        duelId,
        senderId,
        senderName: sender?.username,
        problem,
        timeLimit,
        lobbyEndTime: duelState.lobbyEndTime
      });

      // Start a timer to transition from lobby to starting
      setTimeout(() => {
        const d = activeDuels.get(duelId);
        if (d && d.status === 'lobby') {
          if (d.players.length > 1) {
            d.status = 'starting';
            d.startTime = Date.now() + 3000;
            d.endTime = d.startTime + (d.timeLimit * 60 * 1000);
            
            // Notify all players who joined
            d.players.forEach(p => {
              // Wait, we need their socket id, or we just broadcast to the whole room that the duel started, and frontend checks if they are in d.players
            });
            io.to(roomId).emit('group_challenge_started', d);
            startDuelTimer(io, duelId);
          } else {
            // Not enough players joined
            io.to(roomId).emit('group_challenge_cancelled', { duelId, reason: 'Not enough players joined.' });
            activeDuels.delete(duelId);
          }
        }
      }, 15000);

    } catch (e) {
      console.error('Error sending group challenge:', e);
    }
  });

  socket.on('accept_group_challenge', async (data) => {
    const { duelId } = data;
    const acceptorId = connectedUsers.get(socket.id);
    const duel = activeDuels.get(duelId);
    
    if (!duel || duel.status !== 'lobby') return;
    
    // Check if already joined
    if (duel.players.find(p => p.id === acceptorId)) return;

    try {
      const acceptor = await User.findById(acceptorId).select('username profile stats platforms');
      const p = { id: acceptorId, username: acceptor?.username, avatar: acceptor?.profile?.avatar, platforms: acceptor?.platforms, status: 'Ready', maxPassed: 0 };
      
      duel.players.push(p);
      io.to(duel.roomId).emit('group_challenge_player_joined', { duelId, player: p });
    } catch (e) {
      console.error('Error accepting group challenge:', e);
    }
  });

  // --- Live Duel Logic ---
  socket.on('join_duel', (duelId) => {
    socket.join(duelId);
    socketToDuel.set(socket.id, duelId);
    console.log(`Socket ${socket.id} joined duel ${duelId}`);
    
    // Send current state if exists
    const duel = activeDuels.get(duelId);
    if (duel) {
      socket.emit('duel_state_update', duel);
    }
  });

  socket.on('run_code', async (data) => {
    const { duelId, code, language = 'javascript' } = data;
    const duel = activeDuels.get(duelId);
    const logMsg = `[DEBUG] run_code called with duelId: ${duelId}. duel exists: ${!!duel}, status: ${duel?.status}\n`;
    require('fs').appendFileSync('debug_duel.log', logMsg);
    
    if (!duel || duel.status !== 'active') {
      require('fs').appendFileSync('debug_duel.log', `[DEBUG] run_code failing because duel not active. Keys in activeDuels: ${Array.from(activeDuels.keys())}\n`);
      socket.emit('run_code_result', { error: true, output: 'Duel is not active or has already ended.' });
      return;
    }

    // Run against sample tests
    const result = await judgingService.executeCode(code, duel.problem.sampleTests, language);
    socket.emit('run_code_result', result);
  });

  socket.on('verify_submission', async (data) => {
    const { duelId, code, language = 'javascript' } = data;
    const userId = connectedUsers.get(socket.id);
    const duel = activeDuels.get(duelId);
    
    console.log(`[DEBUG] verify_submission called with duelId: ${duelId}. duel exists: ${!!duel}, status: ${duel?.status}`);
    if (!duel || duel.status !== 'active') {
      socket.emit('submission_failed', { message: 'Duel is not active or has already ended.' });
      return;
    }

    const playerIndex = duel.players.findIndex(p => p.id === userId);
    if (playerIndex === -1) return;
    
    // Update player status in duel state
    duel.players[playerIndex].status = 'Evaluating...';
    io.to(duelId).emit('player_status_update', { userId, status: 'Evaluating...' });
    
    // Run against hidden tests
    const result = await judgingService.executeCode(code, duel.problem.hiddenTests, language);
    
    if (result.passed > duel.players[playerIndex].maxPassed) {
      duel.players[playerIndex].maxPassed = result.passed;
    }

    if (result.success) {
      // 100% passed! Declare winner immediately
      handleDuelWin(io, duel, userId);
    } else {
      duel.players[playerIndex].status = 'Failed';
      io.to(duelId).emit('player_status_update', { userId, status: 'Failed' });
      socket.emit('submission_failed', { 
        message: `Failed on test cases. Passed ${result.passed}/${result.total}.`,
        output: result.output
      });
    }
  });

  socket.on('confirm_opponent_victory', (data) => {
    const { duelId, winnerId } = data;
    const duel = activeDuels.get(duelId);
    if (!duel || duel.status !== 'active') return;
    
    handleDuelWin(io, duel, winnerId);
  });
  
  socket.on('dispute_victory', (data) => {
    const { duelId, claimantId } = data;
    io.to(duelId).emit('victory_disputed', { claimantId });
  });

  socket.on('debug_dump', () => {
    const duels = {};
    for (const [k, v] of activeDuels.entries()) {
      duels[k] = { ...v };
    }
    socket.emit('debug_dump_result', duels);
  });
};

function recordActivity(user, problem, result) {
  const dateStr = new Date().toISOString().split('T')[0];
  
  if (!user.platformStats) user.platformStats = {};
  if (!user.platformStats.devarena) {
    user.platformStats.devarena = { heatmapData: new Map(), recentSubmissions: [] };
  }
  
  const daStats = user.platformStats.devarena;
  if (!daStats.heatmapData) daStats.heatmapData = new Map();
  daStats.heatmapData.set(dateStr, (daStats.heatmapData.get(dateStr) || 0) + 1);

  if (!daStats.recentSubmissions) daStats.recentSubmissions = [];
  daStats.recentSubmissions.unshift({
    platform: 'devarena',
    title: `${problem?.title || 'Unknown Problem'} (Duel ${result})`,
    difficulty: problem?.difficulty || 'Custom',
    url: problem?.url || problem?.problemId || '',
    timestamp: new Date()
  });
  if (daStats.recentSubmissions.length > 20) daStats.recentSubmissions.pop();
  
  // Mark modified for nested Mongoose properties
  user.markModified('platformStats.devarena.heatmapData');
  user.markModified('platformStats.devarena.recentSubmissions');
  user.markModified('platformStats');

  // Recalculate global stats to instantly reflect this new activity
  platformService.recalculateGlobalStats(user);
  
  user.markModified('heatmapData');
  user.markModified('recentSubmissions');
}

const handleDuelWin = (io, duel, winnerId) => {
  duel.status = 'finished';
  duel.winner = winnerId;
  
  // Persist to MongoDB
  Duel.create({
    players: duel.players.map(p => p.id),
    winner: winnerId,
    problem: duel.problem,
    timeLimit: duel.timeLimit,
    status: 'finished',
    startTime: new Date(duel.startTime),
    endTime: new Date()
  }).catch(err => console.error('Error saving duel to DB:', err));
  
  // Find losers (all players except winner)
  const losers = duel.players.filter(p => p.id !== winnerId);

  // Update Winner
  User.findById(winnerId).then(user => {
    if (user) {
      user.stats = user.stats || {};
      user.stats.duels = user.stats.duels || { total: 0, wins: 0, losses: 0 };
      user.stats.duels.total += 1;
      user.stats.duels.wins += 1;
      
      const winRate = user.stats.duels.wins / user.stats.duels.total;
      if (user.stats.duels.wins >= 10 && winRate > 0.8) user.stats.arenaRank = 'Grandmaster';
      else if (user.stats.duels.wins >= 5 && winRate > 0.6) user.stats.arenaRank = 'Master';
      else if (user.stats.duels.wins >= 1) user.stats.arenaRank = 'Challenger';

      recordActivity(user, duel.problem, 'Win');

      gamificationService.awardXP(user, 100, 'Won a duel!', 'duel_win');
      gamificationService.updateStreak(user);
      user.save().then(() => {
        io.to(winnerId).emit('xp_awarded', { amount: 100, reason: 'Won a duel!' });
      });
    }
  }).catch(err => console.error('Error updating winner stats:', err));

  // Update Losers
  losers.forEach(loser => {
    User.findById(loser.id).then(user => {
      if (user) {
        user.stats = user.stats || {};
        user.stats.duels = user.stats.duels || { total: 0, wins: 0, losses: 0 };
        user.stats.duels.total += 1;
        user.stats.duels.losses += 1;
        
        recordActivity(user, duel.problem, 'Loss');
        
        user.save();
      }
    }).catch(err => console.error('Error updating loser stats:', err));
  });
  
  io.to(duel.id).emit('duel_finished', {
    winner: winnerId,
    reason: 'solution_accepted'
  });
  activeDuels.delete(duel.id);
};

const handleDuelForfeit = (io, duel, forfeitingUserId) => {
  if (duel.status === 'finished') return; // already handled
  
  duel.status = 'finished';
  
  // Clear any existing timers
  if (duel.countdownInterval) clearInterval(duel.countdownInterval);
  if (duel.matchTimeout) clearTimeout(duel.matchTimeout);
  
  const losers = duel.players.filter(p => p.id === forfeitingUserId);
  const winners = duel.players.filter(p => p.id !== forfeitingUserId);
  
  if (winners.length === 0 || losers.length === 0) {
      activeDuels.delete(duel.id);
      return; 
  }
  
  const winnerId = winners[0].id;
  duel.winner = winnerId;
  
  // Persist to MongoDB
  Duel.create({
    players: duel.players.map(p => p.id),
    winner: winnerId,
    problem: duel.problem,
    timeLimit: duel.timeLimit,
    status: 'finished',
    startTime: new Date(duel.startTime),
    endTime: new Date()
  }).catch(err => console.error('Error saving forfeit duel to DB:', err));
  
  // Update Winner
  User.findById(winnerId).then(user => {
    if (user) {
      user.stats = user.stats || {};
      user.stats.duels = user.stats.duels || { total: 0, wins: 0, losses: 0 };
      user.stats.duels.total += 1;
      user.stats.duels.wins += 1;
      
      const winRate = user.stats.duels.wins / user.stats.duels.total;
      if (user.stats.duels.wins >= 10 && winRate > 0.8) user.stats.arenaRank = 'Grandmaster';
      else if (user.stats.duels.wins >= 5 && winRate > 0.6) user.stats.arenaRank = 'Master';
      else if (user.stats.duels.wins >= 1) user.stats.arenaRank = 'Challenger';

      recordActivity(user, duel.problem, 'Win (Forfeit)');

      gamificationService.awardXP(user, 100, 'Won a duel by forfeit!', 'duel_win');
      gamificationService.updateStreak(user);
      user.save().then(() => {
        io.to(winnerId).emit('xp_awarded', { amount: 100, reason: 'Won a duel!' });
      });
    }
  }).catch(err => console.error('Error updating winner stats:', err));

  // Update Loser
  User.findById(forfeitingUserId).then(user => {
    if (user) {
      user.stats = user.stats || {};
      user.stats.duels = user.stats.duels || { total: 0, wins: 0, losses: 0 };
      user.stats.duels.total += 1;
      user.stats.duels.losses += 1;
      recordActivity(user, duel.problem, 'Loss (Forfeited)');
      user.save();
    }
  }).catch(err => console.error('Error updating loser stats:', err));
  
  io.to(duel.id).emit('duel_forfeited', {
    winner: winnerId,
    reason: 'Opponent Forfeited'
  });
  activeDuels.delete(duel.id);
};

function startDuel(io, duelId, problem) {
  const duel = activeDuels.get(duelId);
  if (!duel) return;
  
  duel.problem = problem;
  duel.status = 'starting';
  duel.startTime = Date.now() + 3000;
  duel.endTime = duel.startTime + (duel.timeLimit * 60 * 1000);
  
  io.to(duelId).emit('duel_state_update', duel);
  startDuelTimer(io, duelId);
}

function startDuelTimer(io, duelId) {
  const duel = activeDuels.get(duelId);
  if (!duel) return;

  let count = 3;
  const countdownInterval = setInterval(() => {
    if (!activeDuels.has(duelId)) {
      clearInterval(countdownInterval);
      return;
    }
    duel.countdownInterval = countdownInterval;
    
    io.to(duelId).emit('duel_countdown', { count });
    count--;

    if (count < 0) {
      clearInterval(countdownInterval);
      
      const activeDuel = activeDuels.get(duelId);
      if (activeDuel) {
        activeDuel.status = 'active';
        io.to(duelId).emit('duel_started', { startTime: Date.now() });

        // Set timeout for end of match
        const remainingTime = activeDuel.endTime - Date.now();
        activeDuel.matchTimeout = setTimeout(() => {
          const d = activeDuels.get(duelId);
          if (d && d.status === 'active') {
            d.status = 'finished';
            
            // Determine winner by maxPassed
            let bestPlayer = null;
            let maxScore = -1;
            let isTie = false;
            
            d.players.forEach(p => {
              if (p.maxPassed > maxScore) {
                maxScore = p.maxPassed;
                bestPlayer = p;
                isTie = false;
              } else if (p.maxPassed === maxScore && maxScore > 0) {
                isTie = true;
              }
            });

            if (bestPlayer && !isTie && maxScore > 0) {
              handleDuelWin(io, d, bestPlayer.id);
            } else {
              // Tie or nobody passed anything
              d.winner = null;
              Duel.create({
                players: d.players.map(p => p.id),
                winner: null,
                problem: d.problem,
                timeLimit: d.timeLimit,
                status: 'finished',
                startTime: new Date(d.startTime),
                endTime: new Date()
              }).catch(err => console.error('Error saving draw duel to DB:', err));
              
              // Update both players for draw
              d.players.forEach(p => {
                User.findById(p.id).then(user => {
                  if (user) {
                    user.stats = user.stats || {};
                    user.stats.duels = user.stats.duels || { total: 0, wins: 0, losses: 0 };
                    user.stats.duels.total += 1;
                    recordActivity(user, d.problem, 'Draw');
                    user.save();
                  }
                }).catch(e => console.error('Error updating draw stats:', e));
              });

              io.to(duelId).emit('duel_finished', { winner: null, reason: 'time_up' });
              activeDuels.delete(duelId);
            }
          }
        }, remainingTime);
      }
    }
  }, 1000);
}
