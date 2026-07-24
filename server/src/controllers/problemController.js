const Problem = require('../models/Problem');
const User = require('../models/User');
const mockProblems = require('../data/mockProblems');
const judgingService = require('../services/judgingService');

const getProblems = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.platform) filter.platform = req.query.platform;
    if (req.query.difficulty) filter.difficulty = req.query.difficulty;

    const problems = await Problem.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 });
    const total = await Problem.countDocuments(filter);

    res.json({ problems, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPOTD = async (req, res) => {
  try {
    let potd = await Problem.findOne({ isPOTD: true }).sort({ potdDate: -1 });
    
    const today = new Date();
    today.setHours(0,0,0,0);

    // If no POTD or POTD is from previous days, rotate it
    if (!potd || !potd.potdDate || potd.potdDate < today) {
      // Unmark old POTD
      if (potd) {
        potd.isPOTD = false;
        await potd.save();
      }
      
      // Pick a random problem to be the new POTD
      const allProblems = await Problem.find({});
      if (allProblems.length > 0) {
        const randomIndex = Math.floor(Math.random() * allProblems.length);
        potd = allProblems[randomIndex];
        potd.isPOTD = true;
        potd.potdDate = new Date();
        await potd.save();
      }
    }
    
    res.json(potd || { message: 'No problems available' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPOTDHistory = async (req, res) => {
  try {
    // Return all problems that have a potdDate, sorted newest first
    const history = await Problem.find({ potdDate: { $ne: null } }).sort({ potdDate: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const solvePOTD = async (req, res) => {
  try {
    const { problemId, code, language } = req.body;
    const problem = await Problem.findById(problemId);
    if (!problem) return res.status(404).json({ message: 'Problem not found' });
    
    // Execute against hidden tests
    const result = await judgingService.executeCode(code, problem.hiddenTests, language);
    
    if (result.success) {
      // Mark as solved for user and log activity
      const user = await User.findById(req.user._id);
      if (user && !user.solvedPotds.includes(problemId)) {
        user.solvedPotds.push(problemId);
        
        if (!user.platformStats) user.platformStats = {};
        if (!user.platformStats.devarena) {
          user.platformStats.devarena = { heatmapData: new Map(), recentSubmissions: [] };
        }
        
        const dateStr = new Date().toISOString().split('T')[0];
        const daStats = user.platformStats.devarena;
        
        if (!daStats.heatmapData) daStats.heatmapData = new Map();
        daStats.heatmapData.set(dateStr, (daStats.heatmapData.get(dateStr) || 0) + 1);
        
        daStats.recentSubmissions.unshift({
          title: problem.title,
          platform: 'devarena',
          timestamp: new Date(),
          url: `/potd`
        });
        
        if (daStats.recentSubmissions.length > 20) {
          daStats.recentSubmissions = daStats.recentSubmissions.slice(0, 20);
        }
        
        if (!daStats.problemsSolved) {
          daStats.problemsSolved = { easy: 0, medium: 0, hard: 0, total: 0 };
        }
        daStats.problemsSolved.total += 1;
        const diffLower = (problem.difficulty || 'Easy').toLowerCase();
        if (daStats.problemsSolved[diffLower] !== undefined) {
          daStats.problemsSolved[diffLower] += 1;
        }
        
        user.markModified('platformStats.devarena');
        
        // Use gamification service for XP
        const gamificationService = require('../services/gamificationService');
        gamificationService.awardXP(user, 10, 'Solved Problem of the Day');
        
        // Recalculate global heatmap and overall universal streak
        const platformService = require('../services/platformService');
        platformService.recalculateGlobalStats(user);
        
        await user.save();
      }
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const seedProblems = async (req, res) => {
  try {
    const count = await Problem.countDocuments();
    if (count === 0) {
      // Map mock problems to Problem schema
      const formattedProblems = mockProblems.map(p => ({
        title: p.title || p.name,
        platform: 'leetcode',
        difficulty: p.difficulty,
        url: p.url || `https://leetcode.com/problems/${p.id}`,
        tags: [],
        description: p.description || '',
        functionSignature: p.functionSignature || '',
        constraints: p.constraints || [],
        sampleTests: p.sampleTests || [],
        hiddenTests: p.hiddenTests || []
      }));
      await Problem.insertMany(formattedProblems);
      return res.json({ message: 'Seeded mock problems database' });
    }
    res.json({ message: 'Database already has problems' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getProblems,
  getPOTD,
  getPOTDHistory,
  solvePOTD,
  seedProblems
};
