import express, { Request, Response } from 'express';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

// API keys from Render Environment Variables
const AIRLABS_API_KEY = process.env.AIRLABS_API_KEY || "";
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || "";
const RAILRADAR_API_KEY = process.env.RAILRADAR_API_KEY || "";

const RAILRADAR_BASE = "https://api.railradar.in/v1";

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('Airport, Weather, Prayer & RailRadar Malayalam API is Live!');
});

// ============================================================
// EXISTING AIRPORT / WEATHER / PRAYER HELPERS
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

// Helper to translate Islamic Holiday names to Malayalam
function translateHolidayToMalayalam(holidayName: string): string {
    const nameLower = holidayName.toLowerCase();

    if (nameLower.includes("islamic new year") || nameLower.includes("hijri new year")) return "ഹിജ്‌റ പുതുവത്സരം";
    if (nameLower.includes("ashura")) return "ആഷൂറാ ദിനം";
    if (nameLower.includes("mawlid") || nameLower.includes("milad un-nabi")) return "നബിദിനം (മൗലിദ്)";
    if (nameLower.includes("isra") || nameLower.includes("mi'raj")) return "ഇസ്രാഅ് വ മിഅ്‌റാജ് രാവ്";
    if (nameLower.includes("bara'at") || nameLower.includes("sha'ban")) return "ബറാഅത്ത് രാവ്";
    if (nameLower.includes("ramadan")) return "റമദാൻ വ്രതാരംഭം";
    if (nameLower.includes("fitr")) return "ഈദുൽ ഫിത്ർ (ചെറിയ പെരുന്നാൾ)";
    if (nameLower.includes("arafah")) return "അറഫാ ദിനം";
    if (nameLower.includes("adha")) return "ഈദുൽ അദ്ഹാ (ബലിപെരുന്നാൾ)";

    return holidayName;
}

// ============================================================
// AIRPORT REQUEST HANDLER - ORIGINAL FUNCTIONALITY PRESERVED
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

        let textChunks: string[] = [
            `${airportMalayalamName} അനൗൺസ്മെന്റ്.`,
            `അടുത്ത നാല് മണിക്കൂറിലെ ഫ്ലൈറ്റ് വിവരങ്ങൾ.`
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
// AIRPORT ENDPOINTS
// ============================================================

app.get('/api/calicut', async (req: Request, res: Response) => {
    await handleAirportRequest(
        'CCJ',
        'കോഴിക്കോട് കരിപ്പൂർ അന്താരാഷ്ട്ര വിമാനത്താവളം',
        res
    );
});

app.get('/api/kochi', async (req: Request, res: Response) => {
    await handleAirportRequest(
        'COK',
        'കൊച്ചി നെടുമ്പാശ്ശേരി അന്താരാഷ്ട്ര വിമാനത്താവളം',
        res
    );
});

app.get('/api/trivandrum', async (req: Request, res: Response) => {
    await handleAirportRequest(
        'TRV',
        'തിരുവനന്തപുരം അന്താരാഷ്ട്ര വിമാനത്താവളം',
        res
    );
});

app.get('/api/coimbatore', async (req: Request, res: Response) => {
    await handleAirportRequest(
        'CJB',
        'കോയമ്പത്തൂർ വിമാനത്താവളം',
        res
    );
});

// ============================================================
// PRAYER TIMES ENDPOINT - ORIGINAL FUNCTIONALITY PRESERVED
// ============================================================

app.get('/api/prayer', async (req: Request, res: Response) => {
    try {
        const prayerUrl =
            `https://api.aladhan.com/v1/timings?latitude=10.9526&longitude=75.8989&method=2&utcOffset=+530`;

        const response = await axios.get(prayerUrl, {
            timeout: 15000
        });

        const data = response.data.data;
        const timings = data.timings;
        const hijri = data.date.hijri;
        const holidays = hijri.holidays || [];

        let prayerChunks: string[] = [
            "തിരൂർ വട്ടത്താണിയിലെ ഇന്നത്തെ ഇസ്ലാമിക കലണ്ടർ വിവരങ്ങളും നിസ്കാര സമയങ്ങളും.",
            `ഇന്നത്തെ ഹിജ്‌റ തീയതി: ${hijri.day}-ാം തീയതി, ${hijri.month.en} (${hijri.month.ar}) മാസം, ഹിജ്‌റ വർഷം ${hijri.year}.`
        ];

        if (holidays && holidays.length > 0) {
            const translatedHolidays = holidays.map(
                (h: string) => translateHolidayToMalayalam(h)
            );

            prayerChunks.push(
                `ഇന്നത്തെ പ്രത്യേക വിശേഷ ദിവസം: ${translatedHolidays.join(', ')}.`
            );
        }

        const prayerNames: { [key: string]: string } = {
            "Fajr": "സുബ്ഹി",
            "Dhuhr": "ദുഹ്ർ",
            "Asr": "അസർ",
            "Maghrib": "മഗ്രിബ്",
            "Isha": "ഇശാ",
            "Imsak": "ഇംസാക്"
        };

        for (const [key, malayalamName] of Object.entries(prayerNames)) {
            if (timings[key]) {
                prayerChunks.push(
                    `${malayalamName} നിസ്കാര സമയം ${timings[key]}.`
                );
            }
        }

        res.json({
            status: "success",
            location: "Tirur Vattathani",
            chunks: prayerChunks
        });

    } catch (error: any) {
        console.error("Prayer Error:", error.message);

        res.status(500).json({
            status: "error",
            chunks: ["പ്രാർത്ഥനാ സമയങ്ങൾ ലഭ്യമല്ല."]
        });
    }
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
// RAILRADAR TRAIN MODULE
// ============================================================

// Render memory cache.
// Schedule data is cached for 5 minutes.
// Individual live status is cached for 20 seconds.

interface CacheEntry {
    expiresAt: number;
    value: any;
}

const railCache = new Map<string, CacheEntry>();
const railInFlight = new Map<string, Promise<any>>();

const SCHEDULE_CACHE_MS = 5 * 60 * 1000;
const LIVE_CACHE_MS = 20 * 1000;

function getCache(key: string): any | null {
    const entry = railCache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
        railCache.delete(key);
        return null;
    }

    return entry.value;
}

function setCache(
    key: string,
    value: any,
    durationMs: number
): void {
    railCache.set(key, {
        value,
        expiresAt: Date.now() + durationMs
    });
}

async function cachedRequest(
    key: string,
    durationMs: number,
    requestFunction: () => Promise<any>
): Promise<any> {

    const cached = getCache(key);

    if (cached !== null) {
        return cached;
    }

    const existingRequest = railInFlight.get(key);

    if (existingRequest) {
        return existingRequest;
    }

    const requestPromise = (async () => {
        try {
            const result = await requestFunction();

            setCache(key, result, durationMs);

            return result;
        } finally {
            railInFlight.delete(key);
        }
    })();

    railInFlight.set(key, requestPromise);

    return requestPromise;
}

// ============================================================
// RAILRADAR API REQUEST CONTROL
// ============================================================

// Maximum 2 simultaneous RailRadar requests.

let activeRailRequests = 0;

const railRequestQueue: Array<{
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    task: () => Promise<any>;
}> = [];

function runRailRequest<T>(
    task: () => Promise<T>
): Promise<T> {

    return new Promise<T>((resolve, reject) => {

        railRequestQueue.push({
            resolve,
            reject,
            task
        });

        processRailQueue();
    });
}

function processRailQueue(): void {

    while (
        activeRailRequests < 2 &&
        railRequestQueue.length > 0
    ) {

        const job = railRequestQueue.shift();

        if (!job) return;

        activeRailRequests++;

        job.task()
            .then(job.resolve)
            .catch(job.reject)
            .finally(() => {
                activeRailRequests--;
                processRailQueue();
            });
    }
}

// ============================================================
// RAILRADAR HTTP REQUEST
// ============================================================

async function railRadarGet(path: string): Promise<any> {

    if (!RAILRADAR_API_KEY) {
        throw new Error("RAILRADAR_API_KEY is missing in Render environment");
    }

    return runRailRequest(async () => {

        const response = await axios.get(
            `${RAILRADAR_BASE}${path}`,
            {
                headers: {
                    Authorization: `Bearer ${RAILRADAR_API_KEY}`,
                    Accept: "application/json"
                },
                timeout: 15000
            }
        );

        if (!response.data || response.data.success !== true) {
            throw new Error(
                response.data?.error?.message ||
                "RailRadar returned an unsuccessful response"
            );
        }

        return response.data.data;
    });
}

// ============================================================
// STATION TIMETABLE CACHE
// ============================================================

async function getStationTimetable(
    stationCode: string
): Promise<any[]> {

    const cacheKey = `station-timetable-${stationCode}`;

    return cachedRequest(
        cacheKey,
        SCHEDULE_CACHE_MS,
        async () => {

            const data = await railRadarGet(
                `/stations/${encodeURIComponent(stationCode)}/trains?includeIntermediate=true`
            );

            if (!Array.isArray(data?.trains)) {
                throw new Error(
                    `Invalid timetable response for ${stationCode}`
                );
            }

            console.log(
                `RailRadar timetable cached: ${stationCode}, trains: ${data.trains.length}`
            );

            return data.trains;
        }
    );
}

// ============================================================
// IST DATE / TIME HELPERS
// ============================================================

function getISTParts(date: Date = new Date()): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    weekday: string;
} {

    const parts = new Intl.DateTimeFormat(
        "en-IN",
        {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
            weekday: "short"
        }
    ).formatToParts(date);

    const value = (type: string) =>
        parts.find(p => p.type === type)?.value || "";

    return {
        year: Number(value("year")),
        month: Number(value("month")),
        day: Number(value("day")),
        hour: Number(value("hour")),
        minute: Number(value("minute")),
        weekday: value("weekday").toLowerCase()
    };
}

function formatDateIST(date: Date): string {

    const p = getISTParts(date);

    return (
        `${p.year}-` +
        `${String(p.month).padStart(2, "0")}-` +
        `${String(p.day).padStart(2, "0")}`
    );
}

function addCalendarDays(dateString: string, days: number): string {

    const [year, month, day] = dateString.split("-").map(Number);

    const date = new Date(
        Date.UTC(year, month - 1, day + days)
    );

    return (
        `${date.getUTCFullYear()}-` +
        `${String(date.getUTCMonth() + 1).padStart(2, "0")}-` +
        `${String(date.getUTCDate()).padStart(2, "0")}`
    );
}

function dateWeekday(dateString: string): string {

    const [year, month, day] = dateString.split("-").map(Number);

    const date = new Date(
        Date.UTC(year, month - 1, day)
    );

    return [
        "sun",
        "mon",
        "tue",
        "wed",
        "thu",
        "fri",
        "sat"
    ][date.getUTCDay()];
}

function parseRailTime(
    dateString: string,
    timeString: string
): number | null {

    if (!dateString || !timeString) return null;

    const match = /^(\d{1,2}):(\d{2})$/.exec(timeString);

    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (
        hour < 0 || hour > 23 ||
        minute < 0 || minute > 59
    ) {
        return null;
    }

    const [year, month, day] = dateString.split("-").map(Number);

    // IST = UTC + 05:30.
    return Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute
    ) - (330 * 60 * 1000);
}

function formatISTTime(timestamp: number | null): string {

    if (timestamp === null) return "സമയം ലഭ്യമല്ല";

    return new Intl.DateTimeFormat(
        "en-GB",
        {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
        }
    ).format(new Date(timestamp));
}

// ============================================================
// MALAYALAM TRAIN CHUNK SPLITTER
// Maximum 150 UTF-8 bytes per chunk.
// Splits only at sentence / word boundaries.
// ============================================================

function utf8Bytes(text: string): number {
    return Buffer.byteLength(text, "utf8");
}

function splitTrainTextIntoChunks(
    input: string,
    maxBytes: number = 150
): string[] {

    const cleaned = input
        .replace(/\s+/g, " ")
        .trim();

    if (!cleaned) return [];

    const sentences = cleaned
        .split(/(?<=[.!?])\s+/u)
        .filter(Boolean);

    const chunks: string[] = [];
    let current = "";

    function pushCurrent(): void {
        if (current.trim()) {
            chunks.push(current.trim());
        }

        current = "";
    }

    for (const sentence of sentences) {

        if (utf8Bytes(sentence) <= maxBytes) {

            const candidate = current
                ? `${current} ${sentence}`
                : sentence;

            if (utf8Bytes(candidate) <= maxBytes) {
                current = candidate;
            } else {
                pushCurrent();
                current = sentence;
            }

            continue;
        }

        // Long sentence: split at spaces only.
        const words = sentence.split(/\s+/u);

        for (const word of words) {

            const candidate = current
                ? `${current} ${word}`
                : word;

            if (utf8Bytes(candidate) <= maxBytes) {
                current = candidate;
            } else {

                pushCurrent();

                if (utf8Bytes(word) <= maxBytes) {
                    current = word;
                } else {
                    // A single unusually long token cannot be
                    // split safely without risking a broken word.
                    console.error(
                        "Train TTS token exceeds 150 bytes; omitted:",
                        word
                    );
                }
            }
        }
    }

    pushCurrent();

    return chunks;
}

// ============================================================
// TRAIN SCHEDULE TYPES
// ============================================================

interface RailStop {
    sequence?: number;
    arrival?: string | null;
    departure?: string | null;
    arrivalDay?: number | null;
    departureDay?: number | null;
    stopType?: string;
    distance?: number;
}

interface RailTrain {
    train?: {
        number?: string;
        name?: string;
        runDays?: string[];
    };
    stop?: RailStop;
}

interface TrainCandidate {
    number: string;
    name: string;
    sourceCode: string;
    destinationCode: string;
    sourceName: string;
    destinationName: string;
    sourceSequence: number;
    destinationSequence: number;
    sourceDeparture: string;
    destinationArrival: string;
    sourceDay: number;
    destinationDay: number;
    journeyStartDate: string;
    departureTimestamp: number;
    arrivalTimestamp: number | null;
}

// ============================================================
// CREATE TRAIN CANDIDATES FROM TWO CACHED STATION TIMETABLES
// ============================================================

function createTrainCandidates(
    sourceCode: string,
    destinationCode: string,
    sourceTrains: RailTrain[],
    destinationTrains: RailTrain[],
    now: Date
): TrainCandidate[] {

    const destinationMap = new Map<string, RailTrain>();

    for (const item of destinationTrains) {

        const number = String(item?.train?.number || "").trim();

        if (number) {
            destinationMap.set(number, item);
        }
    }

    const nowMs = now.getTime();

    const minimumTime = nowMs - (60 * 60 * 1000);
    const maximumTime = nowMs + (4 * 60 * 60 * 1000);

    const todayIST = formatDateIST(now);

    const candidates: TrainCandidate[] = [];

    for (const sourceItem of sourceTrains) {

        const train = sourceItem?.train;
        const sourceStop = sourceItem?.stop;

        const number = String(train?.number || "").trim();
        const name = String(train?.name || "").trim();

        if (!number || !sourceStop) continue;

        const destinationItem = destinationMap.get(number);

        if (!destinationItem) continue;

        const destinationStop = destinationItem.stop;

        if (!destinationStop) continue;

        const sourceSequence = Number(sourceStop.sequence);
        const destinationSequence = Number(destinationStop.sequence);

        if (
            !Number.isFinite(sourceSequence) ||
            !Number.isFinite(destinationSequence)
        ) {
            continue;
        }

        // Only trains that travel from source to destination.
        if (sourceSequence >= destinationSequence) continue;

        const departureTime =
            sourceStop.departure ||
            sourceStop.arrival;

        const arrivalTime =
            destinationStop.arrival ||
            destinationStop.departure;

        if (!departureTime) continue;

        const sourceDay = Number(
            sourceStop.departureDay ||
            sourceStop.arrivalDay ||
            1
        );

        const destinationDay = Number(
            destinationStop.arrivalDay ||
            destinationStop.departureDay ||
            sourceDay
        );

        if (
            !Number.isFinite(sourceDay) ||
            sourceDay < 1 ||
            sourceDay > 30
        ) {
            continue;
        }

        // Find the actual journey start date.
        // Station timetable day values are relative to train origin.
        let matchedCandidate: TrainCandidate | null = null;

        for (let offset = -2; offset <= 2; offset++) {

            const sourceServiceDate = addCalendarDays(
                todayIST,
                offset
            );

            const journeyStartDate = addCalendarDays(
                sourceServiceDate,
                -(sourceDay - 1)
            );

            const runDays = train?.runDays;

            if (
                Array.isArray(runDays) &&
                runDays.length > 0
            ) {

                const weekday = dateWeekday(journeyStartDate);

                if (
                    !runDays.some(
                        (day: string) =>
                            String(day).toLowerCase().startsWith(weekday)
                    )
                ) {
                    continue;
                }
            }

            const departureTimestamp = parseRailTime(
                sourceServiceDate,
                departureTime
            );

            if (departureTimestamp === null) continue;

            if (
                departureTimestamp < minimumTime ||
                departureTimestamp > maximumTime
            ) {
                continue;
            }

            const destinationServiceDate = addCalendarDays(
                journeyStartDate,
                destinationDay - 1
            );

            const arrivalTimestamp = arrivalTime
                ? parseRailTime(destinationServiceDate, arrivalTime)
                : null;

            matchedCandidate = {
                number,
                name: name || "പേര് ലഭ്യമല്ല",
                sourceCode,
                destinationCode,
                sourceName: sourceCode,
                destinationName: destinationCode,
                sourceSequence,
                destinationSequence,
                sourceDeparture: departureTime,
                destinationArrival: arrivalTime || "",
                sourceDay,
                destinationDay,
                journeyStartDate,
                departureTimestamp,
                arrivalTimestamp
            };

            break;
        }

        if (matchedCandidate) {
            candidates.push(matchedCandidate);
        }
    }

    // Remove duplicates and sort by source departure time.
    const unique = new Map<string, TrainCandidate>();

    for (const item of candidates) {
        const key = `${item.number}-${item.journeyStartDate}`;

        unique.set(key, item);
    }

    return Array.from(unique.values())
        .sort(
            (a, b) =>
                a.departureTimestamp - b.departureTimestamp
        );
}

// ============================================================
// INDIVIDUAL TRAIN LIVE STATUS CACHE
// ============================================================

async function getTrainLiveStatus(
    trainNumber: string,
    journeyDate: string
): Promise<any> {

    const cacheKey =
        `train-live-${trainNumber}-${journeyDate}`;

    return cachedRequest(
        cacheKey,
        LIVE_CACHE_MS,
        async () => {

            const path =
                `/trains/${encodeURIComponent(trainNumber)}/live` +
                `?date=${encodeURIComponent(journeyDate)}`;

            return await railRadarGet(path);
        }
    );
}

// ============================================================
// CHECK WHETHER TRAIN HAS REACHED DESTINATION
// ============================================================

function hasReachedDestination(
    live: any,
    destinationSequence: number,
    destinationCode: string
): boolean {

    const overallStatus = String(
        live?.status || ""
    ).toLowerCase();

    if (
        overallStatus === "completed" ||
        overallStatus === "arrived"
    ) {
        return true;
    }

    const current = live?.currentLocation;

    if (
        current &&
        String(current.stationCode || "").toUpperCase() ===
        destinationCode.toUpperCase()
    ) {
        return true;
    }

    const currentSequence = Number(current?.sequence);

    if (
        Number.isFinite(currentSequence) &&
        currentSequence >= destinationSequence
    ) {
        return true;
    }

    const route = Array.isArray(live?.route)
        ? live.route
        : [];

    const destinationStop = route.find(
        (stop: any) =>
            String(stop?.stationCode || "").toUpperCase() ===
            destinationCode.toUpperCase()
    );

    if (
        String(destinationStop?.status || "").toLowerCase() ===
        "arrived"
    ) {
        return true;
    }

    return false;
}

// ============================================================
// LIVE STATUS MALAYALAM DESCRIPTION
// ============================================================

function getMalayalamLiveDescription(live: any): string {

    const status = String(
        live?.status || ""
    ).toLowerCase();

    if (status === "cancelled") {
        return "ഈ ട്രെയിൻ റദ്ദാക്കിയതായി ലൈവ് വിവരത്തിൽ കാണിക്കുന്നു.";
    }

    if (status === "not-started") {
        return "ട്രെയിൻ ഇതുവരെ യാത്ര ആരംഭിച്ചിട്ടില്ല.";
    }

    const location = live?.currentLocation;
    const stationName = location?.stationName;

    if (stationName) {

        const locationStatus = String(
            location?.status || ""
        ).toLowerCase();

        if (locationStatus === "at-station") {
            return `ട്രെയിൻ നിലവിൽ ${stationName} സ്റ്റേഷനിൽ നിർത്തിയിട്ടിരിക്കുകയാണ്.`;
        }

        return `ട്രെയിൻ നിലവിൽ ${stationName} സ്റ്റേഷന് സമീപമാണ്.`;
    }

    if (live?.nextHalt?.stationName) {
        return `അടുത്ത സ്റ്റേഷൻ ${live.nextHalt.stationName} ആണ്.`;
    }

    return "നിലവിലെ സ്റ്റേഷൻ വിവരം ലഭ്യമല്ല.";
}

// ============================================================
// PROCESS ONE TRAIN
// ============================================================

async function processOneTrain(
    candidate: TrainCandidate
): Promise<{
    include: boolean;
    text: string;
}> {

    try {

        const live = await getTrainLiveStatus(
            candidate.number,
            candidate.journeyStartDate
        );

        if (!live) {
            return {
                include: false,
                text: ""
            };
        }

        const status = String(
            live.status || ""
        ).toLowerCase();

        if (status === "cancelled") {

            return {
                include: true,
                text:
                    `ട്രെയിൻ നമ്പർ ${candidate.number}, ${candidate.name}. ` +
                    `ഈ ട്രെയിൻ റദ്ദാക്കിയതായി ലൈവ് വിവരത്തിൽ കാണിക്കുന്നു.`
            };
        }

        const reached = hasReachedDestination(
            live,
            candidate.destinationSequence,
            candidate.destinationCode
        );

        // Do not announce a train that has already reached destination.
        if (reached) {
            return {
                include: false,
                text: ""
            };
        }

        const nowMs = Date.now();

        const isPastDeparture =
            candidate.departureTimestamp <= nowMs;

        // For trains whose scheduled departure was in the past,
        // only include them when live data confirms they have not
        // yet reached the destination.
        if (
            isPastDeparture &&
            !live.currentLocation &&
            status !== "running"
        ) {
            return {
                include: false,
                text: ""
            };
        }

        const departureTime = formatISTTime(
            candidate.departureTimestamp
        );

        const arrivalTime = candidate.arrivalTimestamp !== null
            ? formatISTTime(candidate.arrivalTimestamp)
            : "ലഭ്യമല്ല";

        const liveDescription =
            getMalayalamLiveDescription(live);

        const delay = Number(live.delayMinutes);

        let delayText = "";

        if (Number.isFinite(delay)) {

            if (delay > 0) {
                delayText = `നിലവിലെ കാലതാമസം ${delay} മിനിറ്റാണ്.`;
            } else if (delay < 0) {
                delayText = `ട്രെയിൻ ${Math.abs(delay)} മിനിറ്റ് നേരത്തെയാണ്.`;
            } else {
                delayText = "ട്രെയിൻ കൃത്യസമയത്താണ്.";
            }
        }

        const text =
            `ട്രെയിൻ നമ്പർ ${candidate.number}, ${candidate.name}. ` +
            `${candidate.sourceCode} സ്റ്റേഷനിൽനിന്നുള്ള ഷെഡ്യൂൾ പുറപ്പെടൽ സമയം ${departureTime}. ` +
            `${candidate.destinationCode} എത്തിച്ചേരേണ്ട ഷെഡ്യൂൾ സമയം ${arrivalTime}. ` +
            `${liveDescription} ${delayText}`;

        return {
            include: true,
            text
        };

    } catch (error: any) {

        console.error(
            `Train live status error ${candidate.number}:`,
            error.response?.status || error.message
        );

        // Never invent live information.
        // Upcoming trains may still be announced with timetable data.
        if (candidate.departureTimestamp > Date.now()) {

            return {
                include: true,
                text:
                    `ട്രെയിൻ നമ്പർ ${candidate.number}, ${candidate.name}. ` +
                    `ഷെഡ്യൂൾ പുറപ്പെടൽ സമയം ${formatISTTime(candidate.departureTimestamp)}. ` +
                    `ലൈവ് സ്റ്റാറ്റസ് ഇപ്പോൾ ലഭ്യമല്ല.`
            };
        }

        // For past departures, do not claim that the train is
        // still on the way when live status could not be checked.
        return {
            include: false,
            text: ""
        };
    }
}

// ============================================================
// MAIN TRAIN ANNOUNCEMENT HANDLER
// ============================================================

async function handleTrainRequest(
    destinationCode: string,
    destinationMalayalamName: string,
    res: Response
): Promise<void> {

    try {

        if (!RAILRADAR_API_KEY) {

            res.status(503).json({
                status: "error",
                message: "RAILRADAR_API_KEY is not configured",
                chunks: ["ട്രെയിൻ വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമല്ല."]
            });

            return;
        }

        const now = new Date();

        // Fetch source and destination timetables.
        // Cached timetables are reused across P5 and P6.
        const [tirurTrains, destinationTrains] =
            await Promise.all([
                getStationTimetable("TIR"),
                getStationTimetable(destinationCode)
            ]);

        const candidates = createTrainCandidates(
            "TIR",
            destinationCode,
            tirurTrains,
            destinationTrains,
            now
        );

        const heading =
            `തിരൂർ മുതൽ ${destinationMalayalamName} വരെയും തിരിച്ചുമുള്ള ട്രെയിൻ വിവരങ്ങൾ.`;

        if (candidates.length === 0) {

            const chunks = splitTrainTextIntoChunks(
                `${heading} അടുത്ത നാല് മണിക്കൂറിനുള്ളിലും കഴിഞ്ഞ ഒരു മണിക്കൂറിനുള്ളിലും ഈ റൂട്ടിൽ ഷെഡ്യൂൾ ചെയ്ത ട്രെയിനുകൾ ലഭ്യമല്ല.`
            );

            res.json({
                status: "success",
                route: `TIR-${destinationCode}`,
                count: 0,
                chunks
            });

            return;
        }

        // Individual live status calls.
        // Maximum two simultaneous requests are allowed.
        const liveResults = await Promise.all(
            candidates.map(candidate =>
                processOneTrain(candidate)
            )
        );

        const announcements = liveResults
            .filter(result => result.include && result.text)
            .map(result => result.text);

        let fullText = heading;

        if (announcements.length > 0) {

            fullText += announcements.join(" ");

        } else {

            fullText +=
                "നിലവിൽ ഈ റൂട്ടിൽ ലക്ഷ്യസ്ഥാനത്ത് എത്താത്ത ട്രെയിനുകളുടെ സ്ഥിരീകരിച്ച ലൈവ് വിവരങ്ങൾ ലഭ്യമല്ല.";
        }

        // Maximum 150 UTF-8 bytes per chunk.
        // Malayalam words are not split in the middle.
        const chunks = splitTrainTextIntoChunks(
            fullText,
            150
        );

        res.json({
            status: "success",
            route: `TIR-${destinationCode}`,
            count: announcements.length,
            chunks
        });

    } catch (error: any) {

        console.error(
            "Train announcement handler error:",
            error.response?.status || error.message
        );

        const statusCode =
            error.response?.status === 429
                ? 503
                : 502;

        res.status(statusCode).json({
            status: "error",
            route: `TIR-${destinationCode}`,
            message: "Train data could not be fetched",
            chunks: ["ട്രെയിൻ വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമല്ല."]
        });
    }
}

// ============================================================
// P5 - TIRUR <-> SHORANUR
// ============================================================

app.get(
    '/api/trains/tirur-shoranur',
    async (req: Request, res: Response) => {

        await handleTrainRequest(
            "SRR",
            "ഷൊർണൂർ",
            res
        );
    }
);

// ============================================================
// P6 - TIRUR <-> KOZHIKODE
// ============================================================

app.get(
    '/api/trains/tirur-kozhikode',
    async (req: Request, res: Response) => {

        await handleTrainRequest(
            "CLT",
            "കോഴിക്കോട്",
            res
        );
    }
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/health', (req: Request, res: Response) => {

    res.json({
        status: "ok",
        service: "Malayalam Airport Weather Prayer Train API",
        railRadarConfigured: Boolean(RAILRADAR_API_KEY),
        cacheEntries: railCache.size,
        activeRailRequests,
        queuedRailRequests: railRequestQueue.length,
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// SERVER START
// ============================================================

app.listen(PORT, () => {

    console.log(`Server is running on port ${PORT}`);

    console.log(
        `RailRadar API key configured: ${Boolean(RAILRADAR_API_KEY)}`
    );
});
