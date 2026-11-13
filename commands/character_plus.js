const axios = require('axios');

async function characterCommand(sock, chatId, message) {
    let userToAnalyze;
    
    // Mention se
    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        userToAnalyze = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    // Reply se
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToAnalyze = message.message.extendedTextMessage.contextInfo.participant;
    }
    
    if (!userToAnalyze) {
        return await sock.sendMessage(chatId, { 
            text: '❌ *Usage:*\n`.character @user`\n`.character` (reply karke)\n\n> Mention someone or reply to their message!'
        }, { quoted: message });
    }

    // ✅ Group ID check
    if (userToAnalyze.endsWith('@g.us')) {
        return await sock.sendMessage(chatId, { 
            text: '❌ Character analysis is not available for groups!'
        }, { quoted: message });
    }

    try {
        // ✅ Loading reactions
        const loadEmojis = ['🔮', '⏳', '✨'];
        for (const emoji of loadEmojis) {
            try {
                await sock.sendMessage(chatId, { react: { text: emoji, key: message.key } });
            } catch (e) {}
        }

        // ✅ DP fetch
        let profilePic;
        try {
            profilePic = await sock.profilePictureUrl(userToAnalyze, 'image');
        } catch {
            try {
                profilePic = await sock.profilePictureUrl(userToAnalyze, 'preview');
            } catch {
                // ✅ Reliable fallback
                profilePic = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
            }
        }

        const traits = [
            "Intelligent", "Creative", "Determined", "Ambitious", "Caring",
            "Charismatic", "Confident", "Empathetic", "Energetic", "Friendly",
            "Generous", "Honest", "Humorous", "Imaginative", "Independent",
            "Intuitive", "Kind", "Logical", "Loyal", "Optimistic",
            "Passionate", "Patient", "Persistent", "Reliable", "Resourceful",
            "Sincere", "Thoughtful", "Understanding", "Versatile", "Wise"
        ];

        // ✅ 3-5 unique traits
        const numTraits = Math.floor(Math.random() * 3) + 3;
        const selectedTraits = [];
        while (selectedTraits.length < numTraits) {
            const randomTrait = traits[Math.floor(Math.random() * traits.length)];
            if (!selectedTraits.includes(randomTrait)) {
                selectedTraits.push(randomTrait);
            }
        }

        // ✅ Random percentages 60-100
        const traitPercentages = selectedTraits.map(trait => {
            const percentage = Math.floor(Math.random() * 41) + 60;
            return `│ • *${trait}:* ${percentage}%`;
        });

        const targetNumber = userToAnalyze.split('@')[0];

        // ✅ Analysis message (NO channel link)
        const analysis = 
            `╭══✦〔 🔮 *Character Analysis* 🔮 〕✦══╮\n` +
            `│\n` +
            `│ 👤 *User:* @${targetNumber}\n` +
            `│\n` +
            `│ ✨ *Key Traits:*\n` +
            `${traitPercentages.join('\n')}\n` +
            `│\n` +
            `│ 🎯 *Overall Rating:* ${Math.floor(Math.random() * 21) + 80}%\n` +
            `│\n` +
            `│ ⚠️ _This is just for fun, do not take it seriously!_\n` +
            `│\n` +
            `╰═✦═✦═✦═✦═✦═✦═✦═✦═✦═╯\n\n` +
            `> *Powered by RAUF × LUCIFER MD BOT*`;

        // ✅ Send with DP
        await sock.sendMessage(chatId, {
            image: { url: profilePic },
            caption: analysis,
            mentions: [userToAnalyze]
        }, { quoted: message });

    } catch (error) {
        console.error('❌ Character command error:', error.message);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to analyze character! Try again later.'
        }, { quoted: message });
    }
}

module.exports = characterCommand;