const card = require('../lib/cardStyle');
const axios = require('axios');

module.exports = async function (sock, chatId) {
    try {
        const response = await axios.get('https://icanhazdadjoke.com/', {
            headers: { Accept: 'application/json' }
        });
        const joke = response.data.joke;
        await sock.sendMessage(chatId, { text: card.panel({ icon: '😂', title: 'Joke', body: joke }) });
    } catch (error) {
        console.error('Error fetching joke:', error);
        await sock.sendMessage(chatId, { text: card.problem('Sorry, I could not fetch a joke right now.') });
    }
};
