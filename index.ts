import express, { Request, Response } from 'express';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

const AIRLABS_API_KEY = process.env.AIRLABS_API_KEY || "";
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || "";

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('Airport, Weather & Prayer Comprehensive Malayalam API is Live!');
});

// Helper: Get Current exact IST Date and Time Windows
function getISTWindows(): { currentIST: Date, fourHoursLaterIST: Date } {
    const nowUTC = new Date();
    const currentIST = new Date(nowUTC.getTime() + (nowUTC.getTimezoneOffset() * 60000) + (5.5 * 60 * 60 * 1000));
    const fourHoursLaterIST = new Date(currentIST.getTime() + 4 * 60 * 60 * 1000);
    return { currentIST, fourHoursLaterIST };
}

// Convert AirLabs schedule time string safely to IST Date object
function parseAirLabsTimeAsIST(dateTimeStr: string): Date {
    if (!dateTimeStr) return new Date(0);
    let formattedStr = dateTimeStr.includes('Z') || dateTimeStr.includes('+') ? dateTimeStr : dateTimeStr.replace(' ', 'T') + 'Z';
    let d = new Date(formattedStr);
    if (isNaN(d.getTime())) {
        d = new Date(dateTimeStr);
    }
    const utcMs = d.getTime() + (d.getTimezoneOffset() * 60000);
    const istMs = utcMs + (5.5 * 60 * 60 * 1000);
    return new Date(istMs);
}

// Safe time extractor for announcement speech (HH:mm)
function extractTime(dateTimeStr: string): string {
    if (!dateTimeStr) return 'സമയം ലഭ്യമല്ല';
    if (dateTimeStr.includes(' ')) {
        const parts = dateTimeStr.split(' ');
        if (parts[1]) return parts[1].substring(0, 5);
    }
    if (dateTimeStr.includes('T')) {
        const parts = dateTimeStr.split('T');
        if (parts[1]) return parts[1].substring(0, 5);
    }
    return dateTimeStr;
}

// Comprehensive Global Mapping Database
function getDestinationName(iata: string, isArrival: boolean): string {
    const database: { [key: string]: { from: string, to: string } } = {
        "LHR": { from: "ലണ്ടൻ ഹീത്രൂവിൽ നിന്നും", to: "ലണ്ടൻ ഹീത്രൂവിലേക്ക്" },
        "LGW": { from: "ലണ്ടൻ ഗാറ്റ്‌വിക്കിൽ നിന്നും", to: "ലണ്ടൻ ഗാറ്റ്‌വിക്കിലേക്ക്" },
        "DXB": { from: "ദുബായിൽ നിന്നും", to: "ദുബായിലേക്ക്" },
        "SHJ": { from: "ഷാർജയിൽ നിന്നും", to: "ഷാർജയിലേക്ക്" },
        "AUH": { from: "അബുദാബിയിൽ നിന്നും", to: "അബുദാബിയിലേക്ക്" },
        "DOH": { from: "ദോഹയിൽ നിന്നും", to: "ദോഹയിലേക്ക്" },
        "MCT": { from: "മസ്കറ്റിൽ നിന്നും", to: "മസ്കറ്റിലേക്ക്" },
        "BAH": { from: "ബഹ്റൈനിൽ നിന്നും", to: "ബഹ്റൈനിലേക്ക്" },
        "KWI": { from: "കുവൈറ്റിൽ നിന്നും", to: "കുവൈറ്റിലേക്ക്" },
        "JED": { from: "ജിദ്ദയിൽ നിന്നും", to: "ജിദ്ദയിലേക്ക്" },
        "RUH": { from: "റിയാദിൽ നിന്നും", to: "റിയാദിലേക്ക്" },
        "SIN": { from: "സിംഗപ്പൂരിൽ നിന്നും", to: "സിംഗപ്പൂരിലേക്ക്" },
        "KUL": { from: "ക്വാലാലംபூരിൽ നിന്നും", to: "ക്വാലാലംപൂരിലേക്ക്" },
        "CMB": { from: "കൊളംബോ ശ്രീലങ്കയിൽ നിന്നും", to: "കൊളംബോ ശ്രീലങ്കയിലേക്ക്" },
        "BLR": { from: "ബെംഗളൂരുവിൽ നിന്നും", to: "ബെംഗളൂരുവിലേക്ക്" },
        "MAA": { from: "ചെന്നൈയിൽ നിന്നും", to: "ചെന്നൈയിലേക്ക്" },
        "BOM": { from: "മുംബൈയിൽ നിന്നും", to: "മുംബൈയിലേക്ക്" },
        "HYD": { from: "ഹൈദരാബാദിൽ നിന്നും", to: "ഹൈദരാബാദിലേക്ക്" },
        "CCJ": { from: "കോഴിക്കോട്ടു നിന്നും", to: "കോഴിക്കോട്ടേക്ക്" },
        "COK": { from: "കൊച്ചിയിൽ നിന്നും", to: "കൊച്ചിയിലേക്ക്" },
        "TRV": { from: "തിരുവനന്തപുരത്തു നിന്നും", to: "തിരുവനന്തപുരത്തേക്ക്" },
        "CJB": { from: "കോയമ്പത്തൂരിൽ നിന്നും", to: "കോയമ്പത്തൂരിലേക്ക്" },
        "DEL": { from: "ഡൽഹിയിൽ നിന്നും", to: "ഡൽഹിയിലേക്ക്" }
    };

    if (database[iata]) {
        return isArrival ? database[iata].from : database[iata].to;
    }
    return isArrival ? `${iata}-ൽ നിന്നും` : `${iata}-ലേക്ക്`;
}

// Robust Airport Request Handler with Pure IST 4-Hour Window Filtering
async function handleAirportRequest(iataCode: string, airportMalayalamName: string, res: Response) {
    try {
        const { currentIST, fourHoursLaterIST } = getISTWindows();

        const [arrResponse, depResponse] = await Promise.all([
            axios.get(`https://airlabs.co/api/v9/schedules`, {
                params: { api_key: AIRLABS_API_KEY, arr_iata: iataCode, limit: 40 }
            }).catch(() => ({ data: { response: [] } })),
            
            axios.get(`https://airlabs.co/api/v9/schedules`, {
                params: { api_key: AIRLABS_API_KEY, dep_iata: iataCode, limit: 40 }
            }).catch(() => ({ data: { response: [] } }))
        ]);

        const arrivals = arrResponse.data?.response || [];
        const departures = depResponse.data?.response || [];

        const upcomingArrivals = arrivals.filter((f: any) => {
            if (!f.arr_time) return false;
            const flightTimeIST = parseAirLabsTimeAsIST(f.arr_time);
            return flightTimeIST >= currentIST && flightTimeIST <= fourHoursLaterIST;
        });

        const upcomingDepartures = departures.filter((f: any) => {
            if (!f.dep_time) return false;
            const flightTimeIST = parseAirLabsTimeAsIST(f.dep_time);
            return flightTimeIST >= currentIST && flightTimeIST <= fourHoursLaterIST;
        });

        let textChunks: string[] = [
            `${airportMalayalamName} അനൗൺസ്മെന്റ്.`,
            `അടുത്ത നാല് മണിക്കൂറിലെ ഫ്ലൈറ്റ് വിവരങ്ങൾ.`
        ];

        if (upcomingArrivals.length > 0) {
            textChunks.push(`വന്നെത്തുന്ന ഫ്ലൈറ്റുകൾ.`);
            upcomingArrivals.forEach((f: any) => {
                const originText = getDestinationName(f.dep_iata || '', true);
                const timeStr = extractTime(f.arr_time);
                const flightNo = f.flight_iata || f.flight_number || 'വിവരം';
                textChunks.push(`${originText} ഫ്ലൈറ്റ് നമ്പർ ${flightNo}, ${airportMalayalamName} എത്തിച്ചേരുന്ന സമയം ${timeStr}.`);
            });
        } else {
            textChunks.push(`വന്നെത്തുന്ന ഫ്ലൈറ്റുകൾ ഇല്ല.`);
        }

        if (upcomingDepartures.length > 0) {
            textChunks.push(`പുറപ്പെടുന്ന ഫ്ലൈറ്റുകൾ.`);
            upcomingDepartures.forEach((f: any) => {
                const destText = getDestinationName(f.arr_iata || '', false);
                const timeStr = extractTime(f.dep_time);
                const flightNo = f.flight_iata || f.flight_number || 'വിവരം';
                textChunks.push(`${airportMalayalamName} നിന്നും ${destText} പുറപ്പെടുന്ന ഫ്ലൈറ്റ് നമ്പർ ${flightNo}, സമയം ${timeStr}.`);
            });
        } else {
            textChunks.push(`പുറപ്പെടുന്ന ഫ്ലൈറ്റുകൾ ഇല്ല.`);
        }

        res.json({
            status: "success",
            airport: airportMalayalamName,
            total_chunks: textChunks.length,
            chunks: textChunks
        });

    } catch (error: any) {
        console.error("AirLabs Error:", error.message);
        res.status(500).json({ 
            status: "error", 
            message: "Failed to fetch schedules",
            chunks: ["വിവരങ്ങൾ ലഭ്യമല്ല."]
        });
    }
}

// Airport Endpoints
app.get('/api/calicut', async (req: Request, res: Response) => {
    await handleAirportRequest('CCJ', 'കോഴിക്കോട് കരിപ്പൂർ അന്താരാഷ്ട്ര വിമാനത്താവളം', res);
});

app.get('/api/kochi', async (req: Request, res: Response) => {
    await handleAirportRequest('COK', 'കൊച്ചി നെടുമ്പാശ്ശേരി അന്താരാഷ്ട്ര വിമാനത്താവളം', res);
});

app.get('/api/trivandrum', async (req: Request, res: Response) => {
    await handleAirportRequest('TRV', 'തിരുവനന്തപുരം അന്താരാഷ്ട്ര വിമാനത്താവളം', res);
});

app.get('/api/coimbatore', async (req: Request, res: Response) => {
    await handleAirportRequest('CJB', 'കോയമ്പത്തൂർ വിമാനത്താവളം', res);
});

// Prayer Times & Full Islamic (Hijri) Calendar Endpoint (Tirur Vattathani - Cleaned: No Sunrise/Sunset, No Lat/Lon)
app.get('/api/prayer', async (req: Request, res: Response) => {
    try {
        const prayerUrl = `https://api.aladhan.com/v1/timings?latitude=10.9526&longitude=75.8989&method=2&utcOffset=+530`;
        const response = await axios.get(prayerUrl);
        const data = response.data.data;
        const timings = data.timings;
        const hijri = data.date.hijri;

        let prayerChunks: string[] = [
            "തിരൂർ വട്ടത്താണി ഇന്നത്തെ ഇസ്ലാമിക കലണ്ടർ വിവരങ്ങളും നിസ്കാര സമയങ്ങളും.",
            `ഹിജ്‌റ വർഷം ${hijri.year}, ${hijri.month.en} മാസം ${hijri.day} തീയതി.`
        ];

        // Map all standard prayer and related times except Sunrise and Sunset
        const prayerNames: { [key: string]: string } = {
            "Fajr": "സുബ്ഹി",
            "Dhuhr": "ദുഹ്ർ",
            "Asr": "അസർ",
            "Maghrib": "മഗ്രിബ്",
            "Isha": "ഇശാ",
            "Imsak": "ഇംസാക്",
            "Midnight": "അർദ്ധരാത്രി"
        };

        for (const [key, malayalamName] of Object.entries(prayerNames)) {
            if (timings[key]) {
                prayerChunks.push(`${malayalamName} സമയം ${timings[key]}.`);
            }
        }

        res.json({
            status: "success",
            location: "Tirur Vattathani",
            total_chunks: prayerChunks.length,
            chunks: prayerChunks
        });
    } catch (error: any) {
        console.error("Prayer Error:", error.message);
        res.status(500).json({ status: "error", chunks: ["പ്രാർത്ഥനാ സമയങ്ങൾ ലഭ്യമല്ല."] });
    }
});

// Weather Endpoint (Tirur Vattathani)
app.get('/api/weather', async (req: Request, res: Response) => {
    try {
        const lat = "10.9526"; 
        const lon = "75.8989";
        
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
            params: { lat, lon, units: 'metric', lang: 'ml', appid: WEATHER_API_KEY }
        });
        
        const data = response.data;
        const temp = Math.round(data.main.temp);
        const humidity = data.main.humidity;
        const windSpeed = data.wind.speed;
        const description = data.weather[0]?.description || "വ്യക്തമല്ല";
        const rain1h = data.rain && data.rain['1h'] ? data.rain['1h'] : 0;

        let weatherChunks: string[] = [
            "മലപ്പുറം ജില്ലയിലെ തിരൂർ വട്ടത്താണി എന്ന സ്ഥലത്തെ കാലാവസ്ഥ വിവരങ്ങൾ.",
            `ഇന്നത്തെ തിരൂർ വട്ടത്താണി എന്ന സ്ഥലത്തെ അന്തരീക്ഷ താപനില ${temp} ഡിഗ്രി സെൽഷ്യസ്.`,
            `കാലാവസ്ഥ അവസ്ഥ: ${description}.`,
            `തിരൂർ വട്ടത്താണിയിലെ ഇന്നത്തെ ആർദ്രത ${humidity} ശതമാനം.`,
            `തിരൂർ വട്ടത്താണിയിലെ ഇന്നത്തെ കാറ്റിന്റെ വേഗത സെക്കൻഡിൽ ${windSpeed} മീറ്റർ.`
        ];

        if (rain1h > 0) {
            weatherChunks.push(`മഴയുടെ അളവ് ${rain1h} മില്ലിമീറ്റർ.`);
        }

        res.json({
            status: "success",
            location: "Tirur Vattathani",
            total_chunks: weatherChunks.length,
            chunks: weatherChunks
        });
    } catch (error: any) {
        console.error("Weather API Error:", error.message);
        res.status(500).json({ status: "error", chunks: ["കാലാവസ്ഥ വിവരങ്ങൾ ലഭ്യമല്ല."] });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
