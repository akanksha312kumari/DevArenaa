const fetch = require('node-fetch');
require('dotenv').config({ path: 'server/.env' });

async function testGroq() {
    try {
        console.log('Key:', process.env.GROQ_API_KEY ? 'exists' : 'missing');
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'user', content: 'hello' }
                ]
            })
        });
        
        console.log('Status:', response.status);
        const data = await response.text();
        console.log('Response:', data);
    } catch (e) {
        console.error(e);
    }
}

testGroq();
