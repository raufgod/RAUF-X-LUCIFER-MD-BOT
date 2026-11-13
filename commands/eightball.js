const card = require('../lib/cardStyle');
const eightBallResponses = [
    "Yes, definitely!",
    "No way!",
    "Ask again later.",
    "It is certain.",
    "Very doubtful.",
    "Without a doubt.",
    "My reply is no.",
    "Signs point to yes."
];

async function eightBallCommand(sock, chatId, question) {
    if (!question) {
        await sock.sendMessage(chatId, { text: card.problem('Please ask a question!\nExample: .8ball will I win?', '8 Ball') });
        return;
    }

    const randomResponse = eightBallResponses[Math.floor(Math.random() * eightBallResponses.length)];
    await sock.sendMessage(chatId, { text: card.panel({ icon: '🎱', title: 'Magic 8 Ball', rows: [['❓', 'Question', String(question).trim()], ['🔮', 'Answer', randomResponse]] }) });
}

module.exports = { eightBallCommand };
