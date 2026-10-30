import express, { Request, Response } from 'express';
import axios from 'axios';
const gTTS = require('gtts');

const app = express();
const PORT = process.env.PORT || 3000;
const AIRLABS_API_KEY = process.env.AIRLABS_API_KEY || "2675c679-9122-43ab-b5a4-62064b22ef2f";

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('Malayalam 4-Hour Multi-Airport Announcement API is Live!');
});

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
        return res.status(400).json({ error: "Invalid airport name. Use calicut, cochin, trivandrum, or coimbatore." });
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

        let malayalamSpeech = `${airportMalayalamName} തത്സമയ അനൗൺസ്മെന്റ്. അടുത്ത നാല് മണിക്കൂറിനുള്ളിലെ വിമാനങ്ങളുടെ വിവരങ്ങൾ. `;

        if (upcomingArrivals.length > 0) {
            malayalamSpeech += `വന്നെത്തുന്ന വിമാനങ്ങൾ: `;
            upcomingArrivals.forEach((f: any) => {
                const timeStr = f.arr_time ? f.arr_time.split(' ')[1] : '';
                malayalamSpeech += `ഫ്ലൈറ്റ് നമ്പർ ${f.flight_number}, സമയം ${timeStr}. `;
            });
        } else {
            malayalamSpeech += `അടുത്ത നാല് മണിക്കൂറിൽ വന്നെത്തുന്ന പുതിയ ഫ്ലൈറ്റുകൾ ഇല്ല. `;
        }

        if (upcomingDepartures.length > 0) {
            malayalamSpeech += `പുറപ്പെടുന്ന വിമാനങ്ങൾ: `;
            upcomingDepartures.forEach((f: any) => {
                const timeStr = f.dep_time ? f.dep_time.split(' ')[1] : '';
                malayalamSpeech += `ഫ്ലൈറ്റ് നമ്പർ ${f.flight_number}, സമയം ${timeStr}. `;
            });
        } else {
            malayalamSpeech += `അടുത്ത നാല് മണിക്കൂറിൽ പുറപ്പെടുന്ന പുതിയ ഫ്ലൈറ്റുകൾ ഇല്ല.`;
        }

        const gtts = new gTTS(malayalamSpeech, 'ml');
        res.setHeader('Content-Type', 'audio/mpeg');
        gtts.stream().pipe(res);

    } catch (error) {
        console.error("Error fetching airport data:", error);
        res.status(500).json({ error: "Failed to fetch airport flight schedules." });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});