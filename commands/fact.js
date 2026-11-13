const card = require('../lib/cardStyle');
const axios = require('axios');

module.exports = async function (sock, chatId, message) {
    try {
        const response = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
        const fact = response.data.text;
        await sock.sendMessage(chatId, { text: card.panel({ icon: '🧠', title: 'Fact', body: fact }) },{ quoted: message });
    } catch (error) {
        console.error('Error fetching fact:', error);
        await sock.sendMessage(chatId, { text: card.problem('Sorry, I could not fetch a fact right now.') },{ quoted: message });
    }
};
