const User = require('../models/User');

const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.username = req.body.username || user.username;
    user.profile.bio = req.body.bio || user.profile.bio;
    user.profile.college = req.body.college || user.profile.college;
    user.profile.avatar = req.body.avatar || user.profile.avatar;

    if (req.body.platforms) {
      user.platforms = { ...user.platforms, ...req.body.platforms };
    }

    const updatedUser = await user.save();
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const users = await User.find({
      username: { $regex: q, $options: 'i' },
      _id: { $ne: req.user.id },
    })
      .select('username profile stats platforms')
      .limit(10);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('friends', 'username profile stats');
    res.json(user.friends);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const sendFriendRequest = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    if (targetUserId === req.user.id) return res.status(400).json({ message: 'Cannot send request to yourself' });

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    if (targetUser.friendRequests.includes(req.user.id) || targetUser.friends.includes(req.user.id)) {
      return res.status(400).json({ message: 'Request already sent or already friends' });
    }

    targetUser.friendRequests.push(req.user.id);
    await targetUser.save();
    res.json({ message: 'Friend request sent' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getFriendRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('friendRequests', 'username profile stats');
    res.json(user.friendRequests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const acceptFriendRequest = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const user = await User.findById(req.user.id);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) return res.status(404).json({ message: 'User not found' });

    if (!user.friendRequests.includes(targetUserId)) {
      return res.status(400).json({ message: 'No friend request from this user' });
    }

    // Remove from requests, add to friends for both
    user.friendRequests = user.friendRequests.filter(id => id.toString() !== targetUserId);
    if (!user.friends.includes(targetUserId)) user.friends.push(targetUserId);
    if (!targetUser.friends.includes(user._id)) targetUser.friends.push(user._id);

    await user.save();
    await targetUser.save();

    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const rejectFriendRequest = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    user.friendRequests = user.friendRequests.filter(id => id.toString() !== targetUserId);
    await user.save();

    res.json({ message: 'Friend request rejected' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const user = await User.findById(targetUserId).select(
      '-password -email -__v'
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSkillAnalysis = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const skillService = require('../services/skillService');
    const skillData = skillService.calculateUserSkills(user);

    // If no recent activity and 0 score, return immediately
    if (skillData.strengths.length === 0) {
      return res.json({ ...skillData, aiSummary: "Solve more problems across platforms to generate your personalized skill analysis!" });
    }

    // Check if we have a cached AI summary less than 24 hours old
    const now = new Date();
    let aiSummary = "Keep practicing across different topics to strengthen your coding fundamentals!";
    
    if (
      user.aiSkillSummary && 
      user.aiSkillSummary.lastGeneratedAt && 
      (now - user.aiSkillSummary.lastGeneratedAt) < 24 * 60 * 60 * 1000 &&
      user.aiSkillSummary.summary
    ) {
      aiSummary = user.aiSkillSummary.summary;
    } else if (process.env.GROQ_API_KEY) {
      // Generate a new AI summary using Groq
      try {
        const topStr = skillData.strengths.map(s => `${s.subject} (${s.A}%)`).join(', ');
        const botStr = skillData.focusAreas.map(f => `${f.subject} (${f.A}%)`).join(', ');
        
        const prompt = `You are a personalized coding AI Coach.
User's Strengths: ${topStr}
User's Weaknesses: ${botStr}
Write a short, engaging 2-sentence summary (max 30 words) acknowledging their strengths and suggesting they focus on one of their weak areas. Do not use markdown.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }]
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          aiSummary = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
          
          user.aiSkillSummary = {
            summary: aiSummary,
            lastGeneratedAt: now
          };
          await user.save();
        }
      } catch (aiErr) {
        console.error('Groq AI Skill Summary Error:', aiErr.message);
      }
    }

    res.json({ ...skillData, aiSummary });
  } catch (error) {
    console.error('Skill Analysis Error:', error);
    res.status(500).json({ message: 'Failed to retrieve skill analysis' });
  }
};

module.exports = {
  updateProfile,
  searchUsers,
  getFriends,
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getUserProfile,
  getSkillAnalysis,
};
