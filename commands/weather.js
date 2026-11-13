const card = require('../lib/cardStyle');
const axios = require('axios');

module.exports = async function (sock, chatId, message, city) {
    try {
        const apiKey = '4902c0f2550f58298ad4146a92b65e10';  // Replace with your OpenWeather API Key
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`);
        const weather = response.data;
        const cap = (t) => String(t || '').replace(/^./, (c) => c.toUpperCase());
        const rows = [['🌥️', 'Sky', cap(weather.weather[0].description)], ['🌡️', 'Temperature', `${weather.main.temp}°C`]];
        if (weather.main.feels_like !== undefined) rows.push(['🤒', 'Feels like', `${weather.main.feels_like}°C`]);
        if (weather.main.humidity !== undefined) rows.push(['💧', 'Humidity', `${weather.main.humidity}%`]);
        if (weather.wind && weather.wind.speed !== undefined) rows.push(['💨', 'Wind', `${weather.wind.speed} m/s`]);
        const weatherText = card.panel({ icon: '⛅', title: `Weather · ${weather.name}`, rows });
        await sock.sendMessage(chatId, { text: weatherText }, { quoted: message }   );
    } catch (error) {
        console.error('Error fetching weather:', error);
        await sock.sendMessage(chatId, { text: card.problem('Sorry, I could not fetch the weather right now.\nCheck the city name and try again.', 'Weather') }, { quoted: message } );
    }
};
