import express, { Request, Response } from 'express';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

// API keys from Render Environment Variables
const AIRLABS_API_KEY = process.env.AIRLABS_API_KEY || "";
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || "";
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('Airport & Weather Malayalam API is Live!');
});

// ============================================================
// EXISTING AIRPORT / WEATHER HELPERS
// ============================================================

// Helper: Get Current exact IST Minutes from UTC server time
function getCurrentISTMinutes(): number {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMins = now.getUTCMinutes();

    let istTotalMins = (utcHours * 60 + utcMins) + 330;
    istTotalMins = istTotalMins % (24 * 60);

    return istTotalMins;
}

// Convert AirLabs UTC time string to IST Minutes from midnight
function airLabsTimeToISTMinutes(dateTimeStr: string): number {
    if (!dateTimeStr) return -1;

    let timePart = "";

    if (dateTimeStr.includes('T')) {
        timePart = dateTimeStr.split('T')[1].substring(0, 5);
    } else if (dateTimeStr.includes(' ')) {
        timePart = dateTimeStr.split(' ')[1].substring(0, 5);
    } else {
        timePart = dateTimeStr.substring(0, 5);
    }

    if (!timePart || !timePart.includes(':')) return -1;

    const parts = timePart.split(':');
    const hours = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);

    if (isNaN(hours) || isNaN(mins)) return -1;

    let totalMins = (hours * 60 + mins) + 330;
    totalMins = totalMins % (24 * 60);

    return totalMins;
}

function isWithinNext4Hours(
    flightMins: number,
    currentMins: number
): boolean {
    if (flightMins === -1) return false;

    let endMins = currentMins + 240;

    if (endMins < 1440) {
        return flightMins >= currentMins && flightMins <= endMins;
    } else {
        let normalizedEnd = endMins - 1440;

        return (
            (flightMins >= currentMins && flightMins < 1440) ||
            (flightMins >= 0 && flightMins <= normalizedEnd)
        );
    }
}

function extractISTTimeString(dateTimeStr: string): string {
    const flightMins = airLabsTimeToISTMinutes(dateTimeStr);

    if (flightMins === -1) return 'സമയം ലഭ്യമല്ല';

    const h = Math.floor(flightMins / 60);
    const m = flightMins % 60;

    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Comprehensive Global Mapping Database
function getDestinationName(iata: string, isArrival: boolean): string {
    const database: {
        [key: string]: { from: string, to: string }
    } = {
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
        "KUL": { from: "ക്വാലാലംപൂരിൽ നിന്നും", to: "ക്വാലാലംപൂരിലേക്ക്" },
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

// ============================================================
// AIRPORT REQUEST HANDLER - UPDATED HEADER CHUNKS (NO REPETITION)
// ============================================================

async function handleAirportRequest(
    iataCode: string,
    airportMalayalamName: string,
    res: Response
) {
    try {
        const currentISTMins = getCurrentISTMinutes();

        const [arrResponse, depResponse] = await Promise.all([
            axios.get(`https://airlabs.co/api/v9/schedules`, {
                params: {
                    api_key: AIRLABS_API_KEY,
                    arr_iata: iataCode,
                    limit: 80
                },
                timeout: 15000
            }).catch(() => ({ data: { response: [] } })),

            axios.get(`https://airlabs.co/api/v9/schedules`, {
                params: {
                    api_key: AIRLABS_API_KEY,
                    dep_iata: iataCode,
                    limit: 80
                },
                timeout: 15000
            }).catch(() => ({ data: { response: [] } }))
        ]);

        const arrivals = arrResponse.data?.response || [];
        const departures = depResponse.data?.response || [];

        const upcomingArrivals = arrivals.filter((f: any) => {
            if (!f.arr_time) return false;

            const flightMins = airLabsTimeToISTMinutes(f.arr_time);

            return isWithinNext4Hours(flightMins, currentISTMins);
        });

        const upcomingDepartures = departures.filter((f: any) => {
            if (!f.dep_time) return false;

            const flightMins = airLabsTimeToISTMinutes(f.dep_time);

            return isWithinNext4Hours(flightMins, currentISTMins);
        });

        // വിമാനത്താവളത്തിന്റെ പേര് ആവർത്തിക്കാതെ ചെറിയ ചങ്കുകളായി ക്രമീകരിച്ചിരിക്കുന്നു
        let textChunks: string[] = [
            `അടുത്ത നാല് മണിക്കൂറിനുള്ളിലെ`,
            `ഫ്ലൈറ്റ് അറൈവൽ ഡിപ്പാർച്ചർ വിവരങ്ങൾ.`
        ];

        if (upcomingArrivals.length > 0) {
            upcomingArrivals.forEach((f: any) => {
                const originText = getDestinationName(f.dep_iata || '', true);
                const timeStr = extractISTTimeString(f.arr_time);
                const flightNo = f.flight_iata || f.flight_number || 'വിവരം';

                textChunks.push(
                    `${originText} ഫ്ലൈറ്റ് നമ്പർ ${flightNo}, ${airportMalayalamName} എത്തിച്ചേരുന്ന സമയം ${timeStr}.`
                );
            });
        }

        if (upcomingDepartures.length > 0) {
            upcomingDepartures.forEach((f: any) => {
                const destText = getDestinationName(f.arr_iata || '', false);
                const timeStr = extractISTTimeString(f.dep_time);
                const flightNo = f.flight_iata || f.flight_number || 'വിവരം';

                textChunks.push(
                    `${airportMalayalamName} നിന്നും ${destText} പുറപ്പെടുന്ന ഫ്ലൈറ്റ് നമ്പർ ${flightNo}, സമയം ${timeStr}.`
                );
            });
        }

        if (
            upcomingArrivals.length === 0 &&
            upcomingDepartures.length === 0
        ) {
            textChunks.push(
                `നിലവിൽ അടുത്ത നാല് മണിക്കൂറിനുള്ളിൽ ഷെഡ്യൂൾ ചെയ്ത ഫ്ലൈറ്റുകൾ ഒന്നും ലഭ്യമല്ല.`
            );
        }

        res.json({
            status: "success",
            airport: airportMalayalamName,
            chunks: textChunks
        });

    } catch (error: any) {
        console.error("AirLabs Error:", error.message);

        res.status(500).json({
            status: "error",
            chunks: ["വിവരങ്ങൾ ലഭ്യമല്ല."]
        });
    }
}

// ============================================================
// AIRPORT ENDPOINTS (ORDERED BY MASTER SWITCHES: 7, 8, 9, 10)
// ============================================================

// Switch 7: Calicut Airport
app.get('/api/calicut', async (req: Request, res: Response) => {
    await handleAirportRequest(
        'CCJ',
        'കോഴിക്കോട് കരിപ്പൂർ അന്താരാഷ്ട്ര വിമാനത്താവളം',
        res
    );
});

// Switch 8: Kochi Airport
app.get('/api/kochi', async (req: Request, res: Response) => {
    await handleAirportRequest(
        'COK',
        'കൊച്ചി നെടുമ്പാശ്ശേരി അന്താരാഷ്ട്ര വിമാനത്താവളം',
        res
    );
});

// Switch 9: Coimbatore Airport
app.get('/api/coimbatore', async (req: Request, res: Response) => {
    await handleAirportRequest(
        'CJB',
        'കോയമ്പത്തൂർ വിമാനത്താവളം',
        res
    );
});

// Switch 10: Trivandrum Airport
app.get('/api/trivandrum', async (req: Request, res: Response) => {
    await handleAirportRequest(
        'TRV',
        'തിരുവനന്തപുരം അന്താരാഷ്ട്ര വിമാനത്താവളം',
        res
    );
});

// ============================================================
// WEATHER ENDPOINT - ORIGINAL FUNCTIONALITY PRESERVED
// ============================================================

app.get('/api/weather', async (req: Request, res: Response) => {
    try {
        const lat = "10.9526";
        const lon = "75.8989";

        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather`,
            {
                params: {
                    lat,
                    lon,
                    units: 'metric',
                    appid: WEATHER_API_KEY
                },
                timeout: 15000
            }
        );

        const data = response.data;

        const temp = Math.round(data.main.temp);
        const feelsLike = Math.round(data.main.feels_like);
        const humidity = data.main.humidity;
        const windSpeed = data.wind.speed;
        const windDeg = data.wind.deg || 0;
        const pressure = data.main.pressure;
        const visibility = data.visibility
            ? (data.visibility / 1000)
            : 10;

        const weatherDesc = data.weather[0]?.description || "";
        const rain1h = data.rain && data.rain['1h']
            ? data.rain['1h']
            : 0;

        let windDirText = "ഉത്തര ദിശയിൽ നിന്നും";

        if (windDeg >= 338 || windDeg < 23) {
            windDirText = "വടക്കു ഭാഗത്തുനിന്നും";
        } else if (windDeg >= 23 && windDeg < 68) {
            windDirText = "വടക്കുകിഴക്ക് ഭാഗത്തുനിന്നും";
        } else if (windDeg >= 68 && windDeg < 113) {
            windDirText = "കിഴക്കു ഭാഗത്തുനിന്നും";
        } else if (windDeg >= 113 && windDeg < 158) {
            windDirText = "തെക്കുകിഴക്ക് ഭാഗത്തുനിന്നും";
        } else if (windDeg >= 158 && windDeg < 203) {
            windDirText = "തെക്കു ഭാഗത്തുനിന്നും";
        } else if (windDeg >= 203 && windDeg < 248) {
            windDirText = "തെക്കുപടിഞ്ഞാറ് ഭാഗത്തുനിന്നും";
        } else if (windDeg >= 248 && windDeg < 293) {
            windDirText = "പടിഞ്ഞാറു ഭാഗത്തുനിന്നും";
        } else if (windDeg >= 293 && windDeg < 338) {
            windDirText = "വടക്കുപടിഞ്ഞാറ് ഭാഗത്തുനിന്നും";
        }

        let malayalamWeather = "കാലാവസ്ഥ പൊതുവെ അനുകൂലമാണ്";

        const descLower = weatherDesc.toLowerCase();

        if (descLower.includes("broken clouds")) {
            malayalamWeather =
                "ആകാശം അങ്ങിങ്ങ് ചെറിയ തോതിൽ മേഘാവൃതമായിരിക്കുന്നു";
        } else if (descLower.includes("scattered clouds")) {
            malayalamWeather =
                "ആകാശത്ത് ചിതറിക്കിടക്കുന്ന മേഘങ്ങളെ കാണാം";
        } else if (descLower.includes("few clouds")) {
            malayalamWeather =
                "ആകാശത്ത് അപൂർവ്വമായി ചില മേഘക്കീറുകൾ കാണപ്പെടുന്നുണ്ട്";
        } else if (descLower.includes("overcast clouds")) {
            malayalamWeather =
                "ആകാശം പൂർണ്ണമായും കനത്ത മേഘങ്ങളാൽ മൂടപ്പെട്ടിരിക്കുന്നു";
        } else if (descLower.includes("clear sky")) {
            malayalamWeather =
                "ആകാശം പൂർണ്ണമായും തെളിഞ്ഞ നിലയിലാണ്";
        } else if (
            descLower.includes("rain") ||
            descLower.includes("drizzle")
        ) {
            malayalamWeather =
                "പ്രദേശത്ത് മഴ അനുഭവപ്പെടുന്നുണ്ട്";
        } else if (descLower.includes("thunderstorm")) {
            malayalamWeather =
                "ഇടിമിന്നലോട് കൂടിയ ശക്തമായ കാലാവസ്ഥയാണ്";
        } else if (
            descLower.includes("mist") ||
            descLower.includes("fog")
        ) {
            malayalamWeather =
                "പ്രദേശത്ത് മൂടൽമഞ്ഞ് അനുഭവപ്പെടുന്നുണ്ട്";
        }

        let weatherChunks: string[] = [
            "മലപ്പുറം ജില്ലയിലെ തിരൂർ വട്ടത്താണി പ്രദേശത്തെക്കുറിച്ചുള്ള കാലാവസ്ഥാ വിവരങ്ങൾ.",
            `ഇന്നത്തെ തിരൂർ വട്ടത്താണിയിലെ അന്തരീക്ഷ താപനില ${temp} ഡിഗ്രി സെൽഷ്യസ് ആണ്.`,
            `ശരീരത്തിന് അനുഭവപ്പെടുന്ന താപനില ${feelsLike} ഡിഗ്രി സെൽഷ്യസ് ആയി രേഖപ്പെടുത്തിയിരിക്കുന്നു.`,
            `കാലാവസ്ഥയുടെ അവസ്ഥ: ${malayalamWeather}.`,
            `അന്തരീക്ഷത്തിലെ ഈർപ്പം അഥവാ ആർദ്രത ${humidity} ശതമാനമാണ്.`,
            `കാറ്റിന്റെ വേഗതയും ദിശയും: ${windDirText} സെക്കൻഡിൽ ${windSpeed} മീറ്റർ വേഗതയിൽ കാറ്റ് വീശുന്നു.`,
            `അന്തരീക്ഷ മർദ്ദം ${pressure} ഹെക്ടോപാസ്കൽ ആണ്.`,
            `ദൂരക്കാഴ്ചയുടെ അളവ് ${visibility} കിലോമീറ്റർ ദൂരമുണ്ട്.`
        ];

        if (rain1h > 0) {
            weatherChunks.push(
                `കഴിഞ്ഞ ഒരു മണിക്കൂറിനിടയിലെ മഴയുടെ അളവ് ${rain1h} മില്ലിമീറ്റർ ആണ്.`
            );
        }

        res.json({
            status: "success",
            location: "Tirur Vattathani",
            chunks: weatherChunks
        });

    } catch (error: any) {
        console.error("Weather API Error:", error.message);

        res.status(500).json({
            status: "error",
            chunks: ["കാലാവസ്ഥ വിവരങ്ങൾ ലഭ്യമല്ല."]
        });
    }
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/health', (req: Request, res: Response) => {

    res.json({
        status: "ok",
        service: "Malayalam Airport & Weather API",
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// SERVER START
// ============================================================

app.listen(PORT, () => {

    console.log(`Server is running on port ${PORT}`);
});
