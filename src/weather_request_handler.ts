/**
 * Copyright (c) 2020 Jess VanDerwalker
 *
 * weather_request_handler.js
 */

import needle from 'needle';

/**
 * Interface for the weather response object.
 */
export interface WeatherResponse {
    locationName: string;
    temperature: number;
    relativeHumidity: number;
}

/**
 * Class that handles the a request for weather data from NOAA JSON
 * API.
 */
export class WeatherRequestHandler {
    stationId: string;
    x: number;
    y: number;
    siUnits: boolean;

    /**
     * Create the request object.
     * @param stationId {String} The weather station id.
     * @param x {Number} The grid x of the station.
     * @param y {Number} The grid y of the station.
     * @param siUnits {Boolean} Return values in SI units if true.
     */
    constructor(stationId: string, x: number, y: number, siUnits: boolean) {
        this.stationId = stationId;
        this.x = x;
        this.y = y;
        this.siUnits = siUnits;
    }

    /**
     * Get the response from with the weather.
     * @return {Promise} Promise that resolves when data is retrieved
     * and parsed.
     */
    getResponse(): Promise<WeatherResponse> {
        if (!this.stationId) {
            return null;
        }
        let url = 'https://api.weather.gov/stations/' +
            this.stationId + '/observations/latest';
        const respPromise: Promise<WeatherResponse> =
            new Promise((resolve, reject) => {
                needle('get', url)
                    .then((resp) => {
                        resolve(this._parseResponse(resp.body));
                    })
                    .catch((err) => {
                        reject(err);
                    });
            });
        return  respPromise;
    }

    /**
     * Parse the response and just get out the data that we need.
     * @param body The body of the response from NOAA
     * @return {WeatherResponse} Response with parsed data.
     */
    private _parseResponse(body: string): WeatherResponse {
        let stationRes = JSON.parse(body);
        let parsedRes: WeatherResponse = {
            temperature: stationRes.properties.temperature.value,
            relativeHumidity: stationRes.properties.relativeHumidity.value,
            locationName: stationRes.properties.textDescription
        };

        return parsedRes;
    }
}
