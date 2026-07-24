const User = require('../models/User');

const aiChat = async (req, res) => {
  let user = null;
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: 'Invalid messages array' });
    }

    user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Try to init Groq API
    if (!process.env.GROQ_API_KEY) {
      // Fallback for when no API key is provided
      const msg = req.body.messages[req.body.messages.length - 1]?.content.toLowerCase() || '';
      let reply = `I see you have ${user.xp} XP and a ${user.stats.dailyStreak}-day streak! Keep up the good work.`;
      if (msg.includes('hello') || msg.includes('hi')) reply = `Hello ${user.username}! How can I help with your coding today?`;
      return res.json({ content: `[Coach] ${reply} (Note: Add GROQ_API_KEY to server/.env for real AI)` });
    }

    // Construct System Prompt
    const systemInstruction = `You are the DevArena AI Coach. 
    You are advising user ${user.username}.
    Their stats: Level ${user.level}, XP ${user.xp}, Daily Streak: ${user.stats.dailyStreak}.
    Global Rating: ${user.stats.globalRating}.
    Problems Solved: ${user.stats.problemsSolved.easy} Easy, ${user.stats.problemsSolved.medium} Medium, ${user.stats.problemsSolved.hard} Hard.
    Their badges: ${user.badges.join(', ') || 'None'}.
    - Be conversational and match the length/intent of the user's input. If the user just says a simple greeting like "hello", simply reply back with a greeting like "Hello, how are you?". Do NOT dump their stats or give unsolicited advice on every message.
    - When explicitly asked for advice or guidance, provide actionable, concise, and encouraging advice for improving their coding skills based on their stats.
    
    CRITICAL RULE: You must ONLY answer questions related to coding, programming, algorithms, computer science, or the user's learning journey on DevArena. If the user asks ANY off-topic questions (e.g., sports, celebrities like "who is messi", politics, movies, etc.), you MUST politely refuse and ask them to please stick to relevant coding and platform topics.`;

    // For simplicity, we send the most recent user message.
    const lastUserMsg = messages[messages.length - 1]?.content || 'Hello';
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: lastUserMsg }
        ]
      })
    });
    
    if (!response.ok) {
        throw new Error(`Groq API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices[0].message.content;

    res.json({ content: text });
  } catch (error) {
    console.error('AI Error:', error);
    // Responsive Fallback if AI fails (e.g. invalid API key, model not found)
    const msgs = req.body.messages || [];
    const msg = msgs[msgs.length - 1]?.content?.toLowerCase() || '';
    let responseText = "Keep practicing those algorithms! Consistency is key.";
    
    if (msg.includes('hello') || msg.includes('hi ') || msg === 'hi') {
      const name = user ? user.username : 'there';
      responseText = `Hello ${name}! How are you doing? Ready for a coding challenge?`;
    } else if (msg.includes('roadmap') || msg.includes('plan')) {
      responseText = "I recommend focusing on Dynamic Programming next. Check your Learning Path page!";
    } else if (msg.includes('error') || msg.includes('bug')) {
      responseText = "Don't worry, every developer faces bugs! Try breaking the problem down and using console logs.";
    } else if (msg.includes('thank')) {
      responseText = "You're welcome! Let me know if you need anything else.";
    } else if (msg.length < 15) {
      responseText = "I'm listening. Tell me more about what you're working on.";
    } else if (msg.includes('slump') || msg.includes('stuck') || msg.includes('help')) {
      responseText = "It's normal to feel stuck sometimes! Take a break, revisit the fundamentals, and try some easier problems to build momentum back up.";
    }

    return res.json({
      content: `[Offline Coach] ${responseText}`
    });
  }
};

const getLearningPlan = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const now = new Date();
    // Check if recommendations exist and are less than 24 hours old
    if (
      user.aiRecommendations &&
      user.aiRecommendations.lastGeneratedAt &&
      (now - user.aiRecommendations.lastGeneratedAt) < 24 * 60 * 60 * 1000
    ) {
      return res.json({
        roadmap: user.aiRecommendations.roadmap,
        dailyChallenges: user.aiRecommendations.dailyChallenges,
      });
    }

    if (!process.env.GROQ_API_KEY) {
      console.warn("Learning Plan: GROQ_API_KEY is missing. Returning fallback roadmap data.");
      return res.json({
        roadmap: [
          { topic: 'Dynamic Programming', difficulty: 'Hard', estimatedTime: '2 hours', reason: 'You have a 30% success rate.', steps: ['Learn memoization', 'Solve 1D DP', 'Solve 2D DP'] },
          { topic: 'Two Pointers', difficulty: 'Medium', estimatedTime: '1 hour', reason: 'Great for array problems.', steps: ['Learn theory', 'Solve basic pairs', 'Master sliding window'] }
        ],
        dailyChallenges: [
          { title: 'Two Sum', difficulty: 'Easy', reason: 'Warm up exercise.' },
          { title: 'Longest Substring', difficulty: 'Medium', reason: 'Improve sliding window skills.' }
        ]
      });
    }

    // Construct user stats payload
    const userStats = {
      globalRating: user.stats.globalRating,
      problemsSolved: user.stats.problemsSolved,
      xp: user.xp,
      streak: user.stats.dailyStreak,
      badges: user.badges,
      recentSubmissions: user.recentSubmissions.slice(0, 10).map(s => s.title)
    };

    const prompt = `You are a personalized AI coding coach powered by Llama. 
Analyze the following user stats: ${JSON.stringify(userStats)}.
Based on their rating, solved problems, and recent submissions, generate:
1. A Personalized Learning Roadmap: Rank topics from weakest to strongest. Recommend the next 5 topics to study with estimated difficulty, study time, a short reason, and an array of 3 very brief actionable steps to tackle the topic (e.g. ['Learn theory', 'Solve 5 easy array problems', 'Master two pointers technique']).
2. AI Daily Challenge Recommendation: Recommend 3 specific coding problems (mix of Easy/Medium/Hard) based on weak topics and current skill level, with a short reason for each.

Return ONLY a valid JSON object with this exact structure (no markdown, no backticks, no extra text):
{
  "roadmap": [
    { "topic": "string", "difficulty": "string", "estimatedTime": "string", "reason": "string", "steps": ["string"] }
  ],
  "dailyChallenges": [
    { "title": "string", "difficulty": "string", "reason": "string" }
  ]
}`;

    console.log("Generating Learning Plan using Groq API...");
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Groq API Error [${response.status}]:`, errorText);
        throw new Error(`Groq API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let resultText = data.choices[0].message.content;
    
    // Clean up any potential markdown formatting or conversational text from the response
    let jsonStart = resultText.indexOf('{');
    let jsonEnd = resultText.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('No valid JSON object found in the AI response: ' + resultText);
    }
    
    resultText = resultText.substring(jsonStart, jsonEnd + 1);
    console.log("Groq Raw Response:", resultText);
    
    const parsedData = JSON.parse(resultText);

    // Update user in DB
    user.aiRecommendations = {
      roadmap: parsedData.roadmap,
      dailyChallenges: parsedData.dailyChallenges,
      lastGeneratedAt: now
    };
    await user.save();

    res.json(parsedData);
  } catch (error) {
    console.error('Learning Plan Error:', error);
    res.status(500).json({ message: 'Failed to generate learning plan from AI: ' + error.message });
  }
};

module.exports = { aiChat, getLearningPlan };
