const axios = require('axios');
const { URLSearchParams } = require('url');

interface URLValidationResult {
    url: string;
    success: boolean;
    data: any;
    error?: any;
}

export async function validateURLS(text: string): Promise<URLValidationResult[]> {
    const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/g;
    const urls = text.match(urlRegex);
    const results: URLValidationResult[] = [];

    if (urls) {
        urls.forEach((url, index) => {
            console.log(`URL ${index + 1} is: "${url}"`);

            const base64URL: string = Buffer.from(url).toString('base64');
            const virusTotalURL: string = `https://www.virustotal.com/api/v3/urls/${base64URL}`
            console.log(`Calling API ${virusTotalURL} to get scan results of ${url}`)
            const VIRUS_TOTAL_API_KEY = String(process.env.VIRUS_TOTAL_API_KEY)
            console.log(`VIRUS_TOTAL_API_KEY: ${VIRUS_TOTAL_API_KEY}`)
            const options = {
                method: 'GET',
                url: virusTotalURL,
                headers: {
                  accept: 'application/json',
                  'x-apikey': VIRUS_TOTAL_API_KEY
                }
              };

            axios
            .request(options)
            .then(function (response: { data: any; }) {
                console.log(`Success calling ${virusTotalURL}`)
                console.log(response.data);
                results.push({
                    url,
                    success: true,
                    data: response.data,
                    error: null,
                });
            })
            .catch(function (error: any) {
                console.log(`Error calling ${virusTotalURL}`)
                console.error(error.data);
                results.push({
                    url,
                    success: false,
                    data: null,
                    error: error.response,
                });
            });
        });
    }
    return results;
}