const axios = require('axios');
(async () => {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:5000/api';
    const res = await axios.post(`${apiUrl}/ai/chat`, {
      messages: [{ role: 'user', content: 'Can you help me learn dynamic programming?' }]
    }, {
      headers: {
        // Need to simulate auth, or bypass auth?
        // Wait, the route is protected by `protect` middleware.
        // I need a valid token.
      }
    });
    console.log(res.data);
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
})();
