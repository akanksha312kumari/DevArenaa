const categories = [
  'Arrays', 'Strings', 'Linked List', 'Stack', 'Queue', 'Trees', 'Graphs', 
  'Dynamic Programming', 'Greedy', 'Binary Search', 'Recursion', 'Backtracking', 
  'Math', 'Bit Manipulation', 'Sliding Window', 'Two Pointers', 'Heap / Priority Queue', 
  'Trie', 'Segment Tree', 'Union Find'
];

// Helper to generate deterministic pseudo-random numbers based on a string seed
const getSeed = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
};

// Simple pseudo-random generator
const seededRandom = (seed, index) => {
  const x = Math.sin(seed + index) * 10000;
  return x - Math.floor(x);
};

const calculateUserSkills = (user) => {
  const totalSolved = user.stats?.problemsSolved?.total || 0;
  
  // Initialize topic scores (this will store effective 'points')
  const topicPoints = {};
  categories.forEach(c => topicPoints[c] = 0);

  // If user has no problems, return early with 0s
  if (totalSolved === 0) {
    return {
      radarData: categories.map(c => ({
        subject: c,
        A: 0,
        problems: 0,
        fullMark: 100,
        suggestion: "Solve some problems to unlock your skill score."
      })),
      strengths: [],
      focusAreas: []
    };
  }

  // 1. Distribute a baseline of points deterministically so the chart feels populated 
  // for users with lots of solved problems but few cached recent submissions.
  const seed = getSeed(user.username || 'user');
  
  // Total baseline points proportional to total problems solved (assume avg difficulty weight = 2)
  const baselineTotalPoints = totalSolved * 2;
  
  // Allocate baseline points across categories pseudo-randomly but deterministically
  let sumWeights = 0;
  const weights = categories.map((c, i) => {
    // Some categories (like Arrays, Strings, Math, DP, Greedy) naturally have more volume.
    let naturalWeight = 1.0;
    if (['Arrays', 'Strings', 'Math'].includes(c)) naturalWeight = 3.0;
    if (['Dynamic Programming', 'Greedy', 'Graphs', 'Trees'].includes(c)) naturalWeight = 2.0;
    if (['Segment Tree', 'Trie'].includes(c)) naturalWeight = 0.5;

    const w = seededRandom(seed, i) * naturalWeight;
    sumWeights += w;
    return w;
  });

  categories.forEach((c, i) => {
    const allocatedPoints = (weights[i] / sumWeights) * baselineTotalPoints;
    topicPoints[c] += allocatedPoints;
  });

  // 2. Add specific points based on actual recent submissions if available
  const allSubmissions = [];
  if (user.recentSubmissions && Array.isArray(user.recentSubmissions)) {
    allSubmissions.push(...user.recentSubmissions);
  }
  // Also collect from platformStats just in case
  if (user.platformStats) {
    for (const platform of Object.keys(user.platformStats)) {
      if (user.platformStats[platform]?.recentSubmissions) {
        allSubmissions.push(...user.platformStats[platform].recentSubmissions);
      }
    }
  }

  // Define keywords to map titles to categories
  const keywordMap = {
    'array': 'Arrays', 'subarray': 'Arrays', 'matrix': 'Arrays', 'grid': 'Arrays',
    'string': 'Strings', 'palindrome': 'Strings', 'anagram': 'Strings',
    'list': 'Linked List',
    'stack': 'Stack',
    'queue': 'Queue',
    'tree': 'Trees', 'bst': 'Trees',
    'graph': 'Graphs', 'dfs': 'Graphs', 'bfs': 'Graphs', 'shortest path': 'Graphs',
    'dp': 'Dynamic Programming', 'dynamic': 'Dynamic Programming', 'memoization': 'Dynamic Programming',
    'greedy': 'Greedy',
    'binary search': 'Binary Search',
    'recurs': 'Recursion',
    'backtrack': 'Backtracking',
    'math': 'Math', 'number': 'Math', 'prime': 'Math',
    'bit': 'Bit Manipulation', 'xor': 'Bit Manipulation',
    'sliding window': 'Sliding Window',
    'two pointer': 'Two Pointers', 'pair': 'Two Pointers',
    'heap': 'Heap / Priority Queue', 'priority': 'Heap / Priority Queue',
    'trie': 'Trie',
    'segment tree': 'Segment Tree',
    'union find': 'Union Find', 'disjoint set': 'Union Find'
  };

  // Analyze submissions and add bonus points for recent activity
  allSubmissions.forEach(sub => {
    if (!sub.title) return;
    const title = sub.title.toLowerCase();
    
    // Determine difficulty weight
    let weight = 2; // default
    if (sub.difficulty) {
      const d = sub.difficulty.toLowerCase();
      if (d === 'easy') weight = 1;
      else if (d === 'medium') weight = 3;
      else if (d === 'hard') weight = 5;
    }

    // Assign to matched categories
    let matched = false;
    for (const [kw, cat] of Object.entries(keywordMap)) {
      if (title.includes(kw)) {
        // Bonus points for actual recent submissions (heavily weights active practice)
        topicPoints[cat] += (weight * 2); 
        matched = true;
      }
    }
    
    // If no match, optionally dump into a generic bucket or infer from global stats
    if (!matched) {
       // Randomly allocate to a top category based on seed
       const fallbackCat = categories[Math.floor(seededRandom(seed, title.length) * categories.length)];
       topicPoints[fallbackCat] += (weight * 1);
    }
  });

  // 3. Normalize points to a 0-100 score using a logarithmic curve
  // A topic point of 0 = 0.
  // We want to plateau around 100.
  // Formula: score = min(100, Math.floor(100 * (1 - Math.exp(-points / Scale))))
  // Scale determines how fast they reach 100. If we assume a user needs ~100 points in a topic for 90%, 
  // -100 / Scale = ln(0.1) => Scale ~ 43.4
  const scale = 50; 
  
  const radarData = categories.map(c => {
    const points = topicPoints[c];
    let score = Math.floor(100 * (1 - Math.exp(-points / scale)));
    if (score < 0) score = 0;
    if (score > 100) score = 100;

    // Estimate problems solved in this category (avg weight 2 per problem)
    const estimatedProblems = Math.round(points / 2);

    let suggestion = "Keep practicing!";
    if (score < 30) suggestion = "Try solving some basic problems to build fundamentals.";
    else if (score < 60) suggestion = "You understand the basics, practice medium problems.";
    else if (score < 85) suggestion = "Solid skills! Tackle some hard problems to master it.";
    else suggestion = "Exceptional mastery. You're ready for advanced contests.";

    return {
      subject: c,
      A: score,
      problems: estimatedProblems,
      fullMark: 100,
      suggestion
    };
  });

  // Sort categories by score
  const sorted = [...radarData].sort((a, b) => b.A - a.A);

  const strengths = sorted.slice(0, 3);
  const focusAreas = sorted.slice(-3).reverse(); // weakest first

  return {
    radarData,
    strengths,
    focusAreas
  };
};

module.exports = {
  calculateUserSkills
};
