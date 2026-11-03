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

// Comprehensive Global Mapping Database (US, UK, Europe, Gulf, Asia, Pilgrimage Hubs & Sri Lanka)
function getDestinationName(iata: string, isArrival: boolean): string {
    const database: { [key: string]: { from: string, to: string } } = {
        // --- UK, USA & Europe ---
        "LHR": { from: "ലണ്ടൻ ഹീത്രൂവിൽ നിന്നും", to: "ലണ്ടൻ ഹീത്രൂവിലേക്ക്" },
        "LGW": { from: "ലണ്ടൻ ഗാറ്റ്‌വിക്കിൽ നിന്നും", to: "ലണ്ടൻ ഗാറ്റ്‌വിക്കിലേക്ക്" },
        "STN": { from: "ലണ്ടൻ സ്റ്റാൻസ്റ്റെഡിൽ നിന്നും", to: "ലണ്ടൻ സ്റ്റാൻസ്റ്റെഡിലേക്ക്" },
        "MAN": { from: "മാഞ്ചസ്റ്ററിൽ നിന്നും", to: "മാഞ്ചസ്റ്ററിലേക്ക്" },
        "CDG": { from: "പാരീസ് ചാൾസ് ഡി ഗോളിൽ നിന്നും", to: "പാരീസിലേക്ക്" },
        "FRA": { from: "ഫ്രാങ്ക്ഫർട്ടിൽ നിന്നും", to: "ഫ്രാങ്ക്ഫർട്ടിലേക്ക്" },
        "AMS": { from: "ആംസ്റ്റർഡാമിൽ നിന്നും", to: "ആംസ്റ്റർഡാമിലേക്ക്" },
        "FCO": { from: "റോമിൽ നിന്നും", to: "റോമിലേക്ക്" },
        "ZRH": { from: "സൂറിച്ചിൽ നിന്നും", to: "സൂറിച്ചിലേക്ക്" },
        "JFK": { from: "ന്യൂയോർക്ക് ജെഎഫ്‌കെയിൽ നിന്നും", to: "ന്യൂയോർക്ക് ജെഎഫ്‌കെയിലേക്ക്" },
        "EWR": { from: "ന്യൂയോർക്ക് നെവാർക്കിൽ നിന്നും", to: "ന്യൂയോർക്ക് നെവാർക്കിലേക്ക്" },
        "ORD": { from: "ഷിക്കാഗോയിൽ നിന്നും", to: "ഷിക്കാഗോയിലേക്ക്" },
        "SFO": { from: "സാൻ ഫ്രാൻസിസ്കോയിൽ നിന്നും", to: "സാൻ ഫ്രാൻസിസ്കോയിലേക്ക്" },
        "LAX": { from: "ലോസ് ഏഞ്ചൽസിൽ നിന്നും", to: "ലോസ് ഏഞ്ചൽസിലേക്ക്" },
        "YYZ": { from: "ടൊറന്റോയിൽ നിന്നും", to: "ടൊറന്റോയിലേക്ക്" },

        // --- Hindu Pilgrimage & Sacred Sites Airports ---
        "VNS": { from: "വാരണാസി കാശിയിൽ നിന്നും", to: "വാരണാസി കാശിയിലേക്ക്" },
        "TIR": { from: "തിരുപ്പതിയിൽ നിന്നും", to: "തിരുപ്പതിയിലേക്ക്" },
        "AYJ": { from: "അയോധ്യയിൽ നിന്നും", to: "അയോധ്യയിലേക്ക്" },
        "IXM": { from: "മധുര മീനാക്ഷി ക്ഷേത്ര നഗരത്തിൽ നിന്നും", to: "മധുരയിലേക്ക്" },
        "DED": { from: "ഡെറാഡൂൺ ചാർധാം കവാടത്തിൽ നിന്നും", to: "ഡെറാഡൂണിലേക്ക്" },
        "IXJ": { from: "ജമ്മു വൈഷ്ണോ ദേവി നഗരത്തിൽ നിന്നും", to: "ജമ്മുവിയിലേക്ക്" },
        "IXD": { from: "പ്രയാഗ്‌രാജ് സംഗമത്തിൽ നിന്നും", to: "പ്രയാഗ്‌രാജിലേക്ക്" },
        "BBI": { from: "ഭുവനേശ്വർ പുരി ജഗന്നാഥ ക്ഷേത്ര നഗരത്തിൽ നിന്നും", to: "ഭുവനേശ്വറിലേക്ക്" },

        // --- International - Gulf & Middle East ---
        "DXB": { from: "ദുബായിൽ നിന്നും", to: "ദുബായിലേക്ക്" },
        "SHJ": { from: "ഷാർജയിൽ നിന്നും", to: "ഷാർജയിലേക്ക്" },
        "AUH": { from: "അബുദാബിയിൽ നിന്നും", to: "അബുദാബിയിലേക്ക്" },
        "DOH": { from: "ദോഹയിൽ നിന്നും", to: "ദോഹയിലേക്ക്" },
        "MCT": { from: "മസ്കറ്റിൽ നിന്നും", to: "മസ്കറ്റിലേക്ക്" },
        "BAH": { from: "ബഹ്റൈനിൽ നിന്നും", to: "ബഹ്റൈനിലേക്ക്" },
        "KWI": { from: "കുവൈറ്റിൽ നിന്നും", to: "കുവൈറ്റിലേക്ക്" },
        "JED": { from: "ജിദ്ദയിൽ നിന്നും", to: "ജിദ്ദയിലേക്ക്" },
        "RUH": { from: "റിയാദിൽ നിന്നും", to: "റിയാദിലേക്ക്" },
        "DMM": { from: "ദമ്മാമിൽ നിന്നും", to: "ദമ്മാമിലേക്ക്" },
        "MED": { from: "മദീനയിൽ നിന്നും", to: "മദീനയിലേക്ക്" },
        "ABH": { from: "അഭയിൽ നിന്നും", to: "അഭയിലേക്ക്" },
        "SAL": { from: "സലാലയിൽ നിന്നും", to: "സലാലയിലേക്ക്" },

        // --- International - Southeast Asia & Sri Lanka ---
        "SIN": { from: "സിംഗപ്പൂരിൽ നിന്നും", to: "സിംഗപ്പൂരിലേക്ക്" },
        "KUL": { from: "ക്വാലാലംபூരിൽ നിന്നും", to: "ക്വാലാലംപൂരിലേക്ക്" },
        "CMB": { from: "കൊളംബോ ശ്രീലങ്കയിൽ നിന്നും", to: "കൊളംബോ ശ്രീലങ്കയിലേക്ക്" },
        "MLE": { from: "മാലദ്വീപിൽ നിന്നും", to: "മാലദ്വീപിലേക്ക്" },

        // --- Domestic - India ---
        "BLR": { from: "ബെംഗളൂരുവിൽ നിന്നും", to: "ബെംഗളൂരുവിലേക്ക്" },
        "MAA": { from: "ചെന്നൈയിൽ നിന്നും", to: "ചെന്നൈയിലേക്ക്" },
        "BOM": { from: "മുംബൈയിൽ നിന്നും", to: "മുംബൈയിലേക്ക്" },
        "HYD": { from: "ഹൈദരാബാദിൽ നിന്നും", to: "ഹൈദരാബാദിലേക്ക്" },
        "GOI": { from: "ഗോവയിൽ നിന്നും", to: "ഗോവയിലേക്ക്" },
        "IXE": { from: "മംഗലാപുരത്തു നിന്നും", to: "മംഗലാപുരത്തേക്ക്" },
        "TRV": { from: "തിരുവനന്തപുരത്തു നിന്നും", to: "തിരുവനന്തപുരത്തേക്ക്" },
        "CCJ": { from: "കോഴിക്കോട്ടു നിന്നും", to: "കോഴിക്കോട്ടേക്ക്" },
        "COK": { from: "കൊച്ചിയിൽ നിന്നും", to: "കൊച്ചിയിലേക്ക്" },
        "CJB": { from: "കോയമ്പത്തൂരിൽ നിന്നും", to: "കോയമ്പത്തൂരിലേക്ക്" },
        "DEL": { from: "ഡൽഹിയിൽ നിന്നും", to: "ഡൽഹിയിലേക്ക്" },
        "CCU": { from: "കൊൽക്കത്തയിൽ നിന്നും", to: "കൊൽക്കത്തയിൽ നിന്നും" },
        "PNQ": { from: "പൂനെയിൽ നിന്നും", to: "പൂനെയിലേക്ക്" },
        "AMD": { from: "അഹമ്മദാബാദിൽ നിന്നും", to: "അഹമ്മദാബാദിലേക്ക്" }
    };

    if (database[iata]) {
        return isArrival ? database[iata].from : database[iata].to;
    }
    return isArrival ? `${iata}-ൽ നിന്നും` : `${iata}-ലേക്ക്`;
}

// Safe AirLabs API Request Handler for Dual Calls (Arrivals & Departures)
async function handleAirportRequest(iataCode: string, airportMalayalamName: string, res: Response) {
    try {
        const now = new Date();
        const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);

        const [arrResponse, depResponse] = await Promise.all([
            axios.get(`https://airlabs.co/api/v9/schedules`, {
                params: { api_key: AIRLABS_API_KEY, arr_iata: iataCode, limit: 10 }
            }).catch(() => ({ data: { response: [] } })),
            
            axios.get(`https://airlabs.co/api/v9/schedules`, {
                params: { api_key: AIRLABS_API_KEY, dep_iata: iataCode, limit: 10 }
            }).catch(() => ({ data: { response: [] } }))
        ]);

        const arrivals = arrResponse.data?.response || [];
        const departures = depResponse.data?.response || [];

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

        let textChunks: string[] = [
            `${airportMalayalamName} അനൗൺസ്മെന്റ്.`,
            `അടുത്ത നാല് മണിക്കൂറിലെ ഫ്ലൈറ്റ് വിവരങ്ങൾ.`
        ];

        if (upcomingArrivals.length > 0) {
            textChunks.push(`വന്നെത്തുന്ന ഫ്ലൈറ്റുകൾ.`);
            upcomingArrivals.forEach((f: any) => {
                const origin = getDestinationName(f.dep_iata || '', true);
                const timeStr = f.arr_time ? f.arr_time.split(' ')[1] : 'സമയം ലഭ്യമല്ല';
                const flightNo = f.flight_iata || f.flight_number || 'വിവരം';
                textChunks.push(`${origin} ഫ്ലൈറ്റ് നമ്പർ ${flightNo}, ${airportMalayalamName} എത്തിച്ചേരുന്ന സമയം ${timeStr}.`);
            });
        } else {
            textChunks.push(`വന്നെത്തുന്ന ഫ്ലൈറ്റുകൾ ഇല്ല.`);
        }

        if (upcomingDepartures.length > 0) {
            textChunks.push(`പുറപ്പെടുന്ന ഫ്ലൈറ്റുകൾ.`);
            upcomingDepartures.forEach((f: any) => {
                const destination = getDestinationName(f.arr_iata || '', false);
                const timeStr = f.dep_time ? f.dep_time.split(' ')[1] : 'സമയം ലഭ്യമല്ല';
                const flightNo = f.flight_iata || f.flight_number || 'വിവരം';
                textChunks.push(`${airportMalayalamName} നിന്നും ${destination} പുറപ്പെടുന്ന ഫ്ലൈറ്റ് നമ്പർ ${flightNo}, സമയം ${timeStr}.`);
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

function textchunks_push_safe(arr: string[], val: string) {
    arr.push(val);
}

// 5th Click: Calicut Airport (CCJ)
app.get('/api/calicut', async (req: Request, res: Response) => {
    await handleAirportRequest('CCJ', 'കോഴിക്കോട് കരിപ്പൂർ അന്താരാഷ്ട്ര വിമാനത്താവളം', res);
});

// 6th Click: Kochi Airport (COK)
app.get('/api/kochi', async (req: Request, res: Response) => {
    await handleAirportRequest('COK', 'കൊച്ചി നെടുമ്പാശ്ശേരി അന്താരാഷ്ട്ര വിമാനത്താവളം', res);
});

// 7th Click: Trivandrum Airport (TRV)
app.get('/api/trivandrum', async (req: Request, res: Response) => {
    await handleAirportRequest('TRV', 'തിരുവനന്തപുരം അന്താരാഷ്ട്ര വിമാനത്താവളം', res);
});

// 8th Click: Coimbatore Airport (CJB)
app.get('/api/coimbatore', async (req: Request, res: Response) => {
    await handleAirportRequest('CJB', 'കോയമ്പത്തൂർ വിമാനത്താവളം', res);
});

// 9th Click: Prayer Times API Endpoint (Aladhan - Direct Open Raw Endpoint for Tirur Vattathani)
app.get('/api/prayer', async (req: Request, res: Response) => {
    try {
        const prayerUrl = `https://api.aladhan.com/v1/timings?latitude=10.9526&longitude=75.8989&method=2&utcOffset=+530`;
        const response = await axios.get(prayerUrl);
        const timings = response.data.data.timings;

        let prayerChunks: string[] = [
            "തിരൂർ വട്ടത്താണി ഇന്നത്തെ നിസ്കാര സമയങ്ങൾ.",
            `സുബ്ഹി സമയം ${timings.Fajr}.`,
            `ദുഹ്ർ സമയം ${timings.Dhuhr}.`,
            `അസർ സമയം ${timings.Asr}.`,
            `മഗ്രിബ് സമയം ${timings.Maghrib}.`,
            `ഇശാ സമയം ${timings.Isha}.`
        ];

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

// 10th Click: Weather API Endpoint (Tirur Vattathani)
app.get('/api/weather', async (req: Request, res: Response) => {
    try {
        const lat = "10.9526"; 
        const lon = "75.8989";
        
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather`;
        const response = await axios.get(weatherUrl, {
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
