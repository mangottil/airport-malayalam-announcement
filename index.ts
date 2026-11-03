import express, { Request, Response } from 'express';
import axios from 'axios';
const gTTS = require('gtts');

const app = express();
const PORT = process.env.PORT || 3000;

// API Keys from Render Environment Variables
const AIRLABS_API_KEY = process.env.AIRLABS_API_KEY || "";
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || "";

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('Malayalam Announcement Server (Airport, Weather & Prayer) is Live!');
});

// 1. AIRPORT ANNOUNCEMENTS (Clicks 5 to 8)
app.get('/airport/:name', async (req: Request, res: Response) => {
    const airportCode = req.params.name.toLowerCase();
    let iataCode = "";
    let airportMalayalamName = "";

    if (airportCode === 'calicut') {
        iataCode = "CCJ";
        airportMalayalamName = "കോഴിക്കോട് അന്താരാഷ്ട്ര വിമാനത്താവളം.";
    } else if (airportCode === 'cochin') {
        iataCode = "COK";
        airportMalayalamName = "കൊച്ചി അന്താരാഷ്ട്ര വിമാനത്താവളം നെടുമ്പാശ്ശേരി.";
    } else if (airportCode === 'trivandrum') {
        iataCode = "TRV";
        airportMalayalamName = "തിരുവനന്തപുരം അന്താരാഷ്ട്ര വിമാനത്താവളം.";
    } else if (airportCode === 'coimbatore') {
        iataCode = "CJB";
        airportMalayalamName = "കോയമ്പത്തൂർ വിമാനത്താവളം.";
    } else {
        return res.status(400).json({ error: "Invalid airport name." });
    }

    try {
        const now = new Date();
        const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);

        const arrResponse = await axios.get(`https://airlabs.co/api/v9/schedules`, {
            params: { api_key: AIRLABS_API_KEY, arr_iata: iataCode }
        });
        const depResponse = await axios.get(`https://airlabs.co/api/v9/schedules`, {
            params: { api_key: AIRLABS_API_KEY, dep_iata: iataCode }
        });

        const arrivals = arrResponse.data.response || [];
        const departures = depResponse.data.response || [];

        const upcomingArrivals = arrivals.filter((f: any) => {
            if (!f.arr_time) return false;
            const arrTime = new Date(f.arr_time);
            return arrTime >= now && arrTime <= fourHoursLater;
        });

        const upcomingDepartures = departures.filter((f: any) => {
            if (!f.dep_time) return false;
            const depTime = new Date(f.dep_time);
            return depTime >= now && depTime <= fourHoursLater;
        });

        let malayalamSpeech = `${airportMalayalamName} തത്സമയ അനൗൺസ്മെന്റ്. `;

        if (upcomingArrivals.length > 0) {
            malayalamSpeech += `വന്നെത്തുന്ന ഫ്ലൈറ്റുകൾ: `;
            upcomingArrivals.forEach((f: any) => {
                const timeStr = f.arr_time ? f.arr_time.split(' ')[1] : '';
                malayalamSpeech += `നമ്പർ ${f.flight_number}, സമയം ${timeStr}. `;
            });
        } else {
            malayalamSpeech += `അടുത്ത നാല് മണിക്കൂറിൽ വന്നെത്തുന്ന ഫ്ലൈറ്റുകൾ ഇല്ല. `;
        }

        if (upcomingDepartures.length > 0) {
            malayalamSpeech += `പുറപ്പെടുന്ന ഫ്ലൈറ്റുകൾ: `;
            upcomingDepartures.forEach((f: any) => {
                const timeStr = f.dep_time ? f.dep_time.split(' ')[1] : '';
                malayalamSpeech += `നമ്പർ ${f.flight_number}, സമയം ${timeStr}. `;
            });
        } else {
            malayalamSpeech += `അടുത്ത നാല് മണിക്കൂറിൽ പുറപ്പെടുന്ന ഫ്ലൈറ്റുകൾ ഇല്ല.`;
        }

        const gtts = new gTTS(malayalamSpeech, 'ml');
        res.setHeader('Content-Type', 'audio/mpeg');
        gtts.stream().pipe(res);

    } catch (error) {
        console.error("Airport Error:", error);
        res.status(500).json({ error: "Failed to fetch schedules." });
    }
});

// 2. WEATHER FORECAST (Click 9 - Tirur / Malappuram)
app.get('/weather/tirur', async (req: Request, res: Response) => {
    try {
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=Malappuram,IN&units=metric&appid=${WEATHER_API_KEY}`;
        const response = await axios.get(weatherUrl);
        const data = response.data;

        const temp = Math.round(data.main.temp);
        const humidity = data.main.humidity;
        const windSpeed = data.wind.speed;

        let weatherSpeech = `തിരൂർ കാലാവസ്ഥ വിവരങ്ങൾ. നിലവിലെ താപനില ${temp} ഡിഗ്രി സെൽഷ്യസ്. ആർദ്രത ${humidity} ശതമാനം. കാറ്റിന്റെ വേഗത മണിക്കൂറിൽ ${windSpeed} മീറ്റർ.`;

        const gtts = new gTTS(weatherSpeech, 'ml');
        res.setHeader('Content-Type', 'audio/mpeg');
        gtts.stream().pipe(res);

    } catch (error) {
        console.error("Weather Error:", error);
        res.status(500).json({ error: "Failed to fetch weather data." });
    }
});

// 3. PRAYER TIMES (Click 10 - AlAdhan API with Lat/Long and IST Offset)
app.get('/prayer/tirur', async (req: Request, res: Response) => {
    try {
        const prayerUrl = `https://api.aladhan.com/v1/timings?latitude=10.9148&longitude=75.9235&method=2&utcOffset=+530`;
        const response = await axios.get(prayerUrl);
        const timings = response.data.data.timings;

        let prayerSpeech = `ഇന്നത്തെ നിസ്കാര സമയങ്ങൾ. സുബ്ഹി ${timings.Fajr}, ദുഹ്ർ ${timings.Dhuhr}, അസർ ${timings.Asr}, മഗ്രിബ് ${timings.Maghrib}, ഇശാ ${timings.Isha}.`;

        const gtts = new gTTS(prayerSpeech, 'ml');
        res.setHeader('Content-Type', 'audio/mpeg');
        gtts.stream().pipe(res);

    } catch (error) {
        console.error("Prayer Error:", error);
        res.status(500).json({ error: "Failed to fetch prayer times." });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
