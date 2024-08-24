const axios = require('axios');
const { URLSearchParams } = require('url');

interface URLValidationResult {
    url: string;
    success: boolean;
    data: any;
    error?: any;
}

export function validateURLS(text: string): Promise<URLValidationResult[]> {
    const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/g;
    const urls = text.match(urlRegex);
    const results: URLValidationResult[] = [];

    if (urls) {
        // Create an array of promises for each URL request
        const requests = urls.map((url, index) => {
            console.log(`URL ${index + 1} is: "${url}"`);

            const base64URL: string = Buffer.from(url).toString('base64');
            const virusTotalURL: string = `https://www.virustotal.com/api/v3/urls/${base64URL}`;
            console.log(`Calling API ${virusTotalURL} to get scan results of ${url}`);
            const VIRUS_TOTAL_API_KEY = String(process.env.VIRUS_TOTAL_API_KEY);
            console.log(`VIRUS_TOTAL_API_KEY: ${VIRUS_TOTAL_API_KEY}`);
            const options = {
                method: 'GET',
                url: virusTotalURL,
                headers: {
                    accept: 'application/json',
                    'x-apikey': VIRUS_TOTAL_API_KEY
                }
            };

            return axios
                .request(options)
                .then((response: { data: any; }) => {
                    console.log(`Success calling ${virusTotalURL}`);
                    console.log(response.data);
                    results.push({
                        url,
                        success: true,
                        data: JSON.stringify(response.data),
                        error: null,
                    });
                })
                .catch((error: { response: { data: any; }; }) => {
                    console.log(`Error calling ${virusTotalURL}`);
                    console.error(error.response.data);
                    results.push({
                        url,
                        success: false,
                        data: null,
                        error: JSON.stringify(error.response.data),
                    });
                });
        });

        // Wait for all requests to complete and return results
        return Promise.all(requests).then(() => {
            console.log('All requests completed. Results:', results);
            return results;
        });
    } else {
        // If no URLs are found, return an empty array
        return Promise.resolve([]);
    }
}