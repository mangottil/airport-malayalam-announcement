import express, { Request, Response } from 'express';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

const AIRLABS_API_KEY = process.env.AIRLABS_API_KEY || "";
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || "";

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('Airport & Weather Micro-Chunks Malayalam API is Live and Running!');
});

// Helper function to fetch Arrivals and Departures separately and chunk them in Malayalam
async function handleAirportRequest(iataCode: string, airportMalayalamName: string, res: Response) {
    try {
        const now = new Date();
        const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);

        // Making separate calls for Arrivals and Departures as required
        const [arrResponse, depResponse] = await Promise.all([
            axios.get(`https://airlabs.co/api/v9/schedules`, {
                params: { api_key: AIRLABS_API_KEY, arr_iata: iataCode, limit: 5 }
            }).catch(() => ({ data: { response: [] } })),
            
            axios.get(`https://airlabs.co/api/v9/schedules`, {
                params: { api_key: AIRLABS_API_KEY, dep_iata: iataCode, limit: 5 }
            }).catch(() => ({ data: { response: [] } }))
        ]);

        const arrivals = arrResponse.data?.response || [];
        const departures = depResponse.data?.response || [];

        // Filtering upcoming flights within the next 4 hours
        const upcomingArrivals = arrivals.filter((f: any) => {
            if (!f.arr_time) return false;
            const t = new Date(f.arr_time);
            return t >= now && t <= fourHoursLater;
        });

        const upcomingDepartures = departures.filter((f: any) => {
            if (!f.dep_time) return false;
            const t = new Date(f.dep_time);
            return t >= now && t <= fourHoursLater;
        });

        // Building small micro-chunks for ESP32 memory safety
        let textChunks: string[] = [
            `${airportMalayalamName} അനൗൺസ്മെന്റ്.`,
            `അടുത്ത നാല് മണിക്കൂറിലെ വിവരങ്ങൾ.`
        ];

        // Process Arrivals chunks
        if (upcomingArrivals.length > 0) {
            textChunks.push(`വന്നെത്തുന്ന ഫ്ലൈറ്റുകൾ ഉണ്ട്.`);
            upcomingArrivals.forEach((f: any) => {
                const timeStr = f.arr_time ? f.arr_time.split(' ')[1] : 'സമയം ഇല്ല';
                const flightNo = f.flight_iata || f.flight_number || 'വിവരം';
                textChunks.push(`ഫ്ലൈറ്റ് ${flightNo}`);
                textChunks.push(`സമയം ${timeStr}`);
            });
        } else {
            textChunks.push(`വന്നെത്തുന്ന ഫ്ലൈറ്റുകൾ ഇല്ല.`);
        }

        // Process Departures chunks
        if (upcomingDepartures.length > 0) {
            textChunks.push(`പുറപ്പെടുന്ന ഫ്ലൈറ്റുകൾ ഉണ്ട്.`);
            upcomingDepartures.forEach((f: any) => {
                const timeStr = f.dep_time ? f.dep_time.split(' ')[1] : 'സമയം ഇല്ല';
                const flightNo = f.flight_iata || f.flight_number || 'വിവരം';
                textChunks.push(`ഫ്ലൈറ്റ് ${flightNo}`);
                textChunks.push(`സമയം ${timeStr}`);
            });
        } else {
            textChunks.push(`പുറപ്പെടുന്ന ഫ്ലൈറ്റുകൾ ഇല്ല.`);
        }

        // Sending structured small chunks in JSON response
        res.json({
            status: "success",
            airport: airportMalayalamName,
            total_chunks: textChunks.length,
            chunks: textChunks
        });

    } catch (error: any) {
        console.error("AirLabs API Error:", error.message);
        res.status(500).json({ 
            status: "error", 
            message: "Failed to fetch airport schedules",
            chunks: ["വിവരങ്ങൾ ലഭ്യമാക്കുന്നതിൽ തടസ്സം നേരിട്ടു."]
        });
    }
}

// 1. Calicut Airport Endpoint
app.get('/api/calicut', async (req: Request, res: Response) => {
    await handleAirportRequest('CCJ', 'കോഴിക്കോട് കരിപ്പൂർ എയർപോർട്ട്', res);
});

// 2. Kochi Airport Endpoint
app.get('/api/kochi', async (req: Request, res: Response) => {
    await handleAirportRequest('COK', 'കൊച്ചി നെടുമ്പാശ്ശേരി എയർപോർട്ട്', res);
});

// 3. Trivandrum Airport Endpoint
app.get('/api/trivandrum', async (req: Request, res: Response) => {
    await handleAirportRequest('TRV', 'തിരുവനന്തപുരം എയർപോർട്ട്', res);
});

// 4. Coimbatore Airport Endpoint
app.get('/api/coimbatore', async (req: Request, res: Response) => {
    await handleAirportRequest('CJB', 'കോയമ്പത്തൂർ എയർപോർട്ട്', res);
});

// 5. Weather API Endpoint (Vattathani) split into safe micro-chunks
app.get('/api/weather', async (req: Request, res: Response) => {
    try {
        const lat = "10.9526"; 
        const lon = "75.8989";
        
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather`;
        const response = await axios.get(weatherUrl, {
            params: {
                lat: lat,
                lon: lon,
                units: 'metric',
                lang: 'ml', // Malayalam weather description
                appid: WEATHER_API_KEY
            }
        });
        
        const data = response.data;
        const temp = Math.round(data.main.temp);
        const humidity = data.main.humidity;
        const windSpeed = data.wind.speed;
        const description = data.weather[0]?.description || "വ്യക്തമല്ല";
        const rain1h = data.rain && data.rain['1h'] ? data.rain['1h'] : 0;

        // Micro-chunks array for Weather
        let weatherChunks: string[] = [
            "വട്ടത്താണി കാലാവസ്ഥ.",
            `താപനില ${temp} ഡിഗ്രി.`,
            `അവസ്ഥ ${description}.`,
            `ആർദ്രത ${humidity} ശതമാനം.`,
            `കാറ്റിന്റെ വേഗത ${windSpeed} മീറ്റർ.`
        ];

        if (rain1h > 0) {
            weatherChunks.push(`മഴ ${rain1h} മില്ലിമീറ്റർ.`);
        }

        res.json({
            status: "success",
            location: "Vattathani",
            total_chunks: weatherChunks.length,
            chunks: weatherChunks
        });

    } catch (error: any) {
        console.error("Weather API Error:", error.message);
        res.status(500).json({ 
            status: "error", 
            message: "Weather fetch failed",
            chunks: ["കാലാവസ്ഥ വിവരങ്ങൾ ലഭ്യമായില്ല."]
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
