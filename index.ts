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
    return holidayName; // Fallback to original if not matched
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
            upcomingArrivals.forEach((f: any) => {
                const originText = getDestinationName(f.dep_iata || '', true);
                const timeStr = extractTime(f.arr_time);
                const flightNo = f.flight_iata || f.flight_number || 'വിവരം';
                textChunks.push(`${originText} ഫ്ലൈറ്റ് നമ്പർ ${flightNo}, ${airportMalayalamName} എത്തിച്ചേരുന്ന സമയം ${timeStr}.`);
            });
        }

        if (upcomingDepartures.length > 0) {
            upcomingDepartures.forEach((f: any) => {
                const destText = getDestinationName(f.arr_iata || '', false);
                const timeStr = extractTime(f.dep_time);
                const flightNo = f.flight_iata || f.flight_number || 'വിവരം';
                textChunks.push(`${airportMalayalamName} നിന്നും ${destText} പുറപ്പെടുന്ന ഫ്ലൈറ്റ് നമ്പർ ${flightNo}, സമയം ${timeStr}.`);
            });
        }

        if (upcomingArrivals.length === 0 && upcomingDepartures.length === 0) {
            textChunks.push(`നിലവിൽ അടുത്ത നാല് മണിക്കൂറിനുള്ളിൽ ഷെഡ്യൂൾ ചെയ്ത ഫ്ലൈറ്റുകൾ ഒന്നും ലഭ്യമല്ല.`);
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

// Prayer Times & Cleaned Islamic (Hijri) Calendar Endpoint with Malayalam Holiday Translation
app.get('/api/prayer', async (req: Request, res: Response) => {
    try {
        const prayerUrl = `https://api.aladhan.com/v1/timings?latitude=10.9526&longitude=75.8989&method=2&utcOffset=+530`;
        const response = await axios.get(prayerUrl);
        const data = response.data.data;
        const timings = data.timings;
        const hijri = data.date.hijri;
        const holidays = hijri.holidays || [];

        let prayerChunks: string[] = [
            "തിരൂർ വട്ടത്താണിയിലെ ഇന്നത്തെ ഇസ്ലാമിക കലണ്ടർ വിവരങ്ങളും നിസ്കാര സമയങ്ങളും.",
            `ഇന്നത്തെ ഹിജ്‌റ തീയതി: ${hijri.day}-ാം തീയതി, ${hijri.month.en} (${hijri.month.ar}) മാസം, ഹിജ്‌റ വർഷം ${hijri.year}.`
        ];

        // Translate and append special holidays if reported by the API
        if (holidays && holidays.length > 0) {
            const translatedHolidays = holidays.map((h: string) => translateHolidayToMalayalam(h));
            prayerChunks.push(`ഇന്നത്തെ പ്രത്യേക വിശേഷ ദിവസം: ${translatedHolidays.join(', ')}.`);
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
                prayerChunks.push(`${malayalamName} നിസ്കാര സമയം ${timings[key]}.`);
            }
        }

        res.json({
            status: "success",
            location: "Tirur Vattathani",
            chunks: prayerChunks
        });
    } catch (error: any) {
        console.error("Prayer Error:", error.message);
        res.status(500).json({ status: "error", chunks: ["പ്രാർത്ഥനാ സമയങ്ങൾ ലഭ്യമല്ല."] });
    }
});

// Weather Endpoint (Tirur Vattathani) - Comprehensive, Elegant Malayalam Literary Translation
app.get('/api/weather', async (req: Request, res: Response) => {
    try {
        const lat = "10.9526"; 
        const lon = "75.8989";
        
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
            params: { lat, lon, units: 'metric', appid: WEATHER_API_KEY }
        });
        
        const data = response.data;
        const temp = Math.round(data.main.temp);
        const feelsLike = Math.round(data.main.feels_like);
        const humidity = data.main.humidity;
        const windSpeed = data.wind.speed;
        const windDeg = data.wind.deg || 0;
        const pressure = data.main.pressure;
        const visibility = data.visibility ? (data.visibility / 1000) : 10;
        const weatherDesc = data.weather[0]?.description || "";
        const rain1h = data.rain && data.rain['1h'] ? data.rain['1h'] : 0;

        let windDirText = "ഉത്തര ദിശയിൽ നിന്നും";
        if (windDeg >= 338 || windDeg < 23) windDirText = "വടക്കു ഭാഗത്തുനിന്നും";
        else if (windDeg >= 23 && windDeg < 68) windDirText = "വടക്കുകിഴക്ക് ഭാഗത്തുനിന്നും";
        else if (windDeg >= 68 && windDeg < 113) windDirText = "കിഴക്കു ഭാഗത്തുനിന്നും";
        else if (windDeg >= 113 && windDeg < 158) windDirText = "തെക്കുകിഴക്ക് ഭാഗത്തുനിന്നും";
        else if (windDeg >= 158 && windDeg < 203) windDirText = "തെക്കു ഭാഗത്തുനിന്നും";
        else if (windDeg >= 203 && windDeg < 248) windDirText = "തെക്കുപടിഞ്ഞാറ് ഭാഗത്തുനിന്നും";
        else if (windDeg >= 248 && windDeg < 293) windDirText = "പടിഞ്ഞാറു ഭാഗത്തുനിന്നും";
        else if (windDeg >= 293 && windDeg < 338) windDirText = "വടക്കുപടിഞ്ഞാറ് ഭാഗത്തുനിന്നും";

        let malayalamWeather = "കാലാവസ്ഥ പൊതുവെ അനുകൂലമാണ്";
        const descLower = weatherDesc.toLowerCase();

        if (descLower.includes("broken clouds")) {
            malayalamWeather = "ആകാശം അങ്ങിങ്ങ് ചെറിയ തോതിൽ മേഘാവൃതമായിരിക്കുന്നു";
        } else if (descLower.includes("scattered clouds")) {
            malayalamWeather = "ആകാശത്ത് ചിതറിക്കിടക്കുന്ന മേഘങ്ങളെ കാണാം";
        } else if (descLower.includes("few clouds")) {
            malayalamWeather = "ആകാശത്ത് അപൂർവ്വമായി ചില മേഘക്കീറുകൾ കാണപ്പെടുന്നുണ്ട്";
        } else if (descLower.includes("overcast clouds")) {
            malayalamWeather = "ആകാശം പൂർണ്ണമായും കനത്ത മേഘങ്ങളാൽ മൂടപ്പെട്ടിരിക്കുന്നു";
        } else if (descLower.includes("clear sky")) {
            malayalamWeather = "ആകാശം പൂർണ്ണമായും തെളിഞ്ഞ നിലയിലാണ്";
        } else if (descLower.includes("rain") || descLower.includes("drizzle")) {
            malayalamWeather = "പ്രദേശത്ത് മഴ അനുഭവപ്പെടുന്നുണ്ട്";
        } else if (descLower.includes("thunderstorm")) {
            malayalamWeather = "ഇടിമിന്നലോട് കൂടിയ ശക്തമായ കാലാവസ്ഥയാണ്";
        } else if (descLower.includes("mist") || descLower.includes("fog")) {
            malayalamWeather = "പ്രദേശത്ത് മൂടൽമഞ്ഞ് അനുഭവപ്പെടുന്നുണ്ട്";
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
            weatherChunks.push(`കഴിഞ്ഞ ഒരു മണിക്കൂറിനിടയിലെ മഴയുടെ അളവ് ${rain1h} മില്ലിമീറ്റർ ആണ്.`);
        }

        res.json({
            status: "success",
            location: "Tirur Vattathani",
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
