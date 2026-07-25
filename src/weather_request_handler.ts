/**
 * Copyright (c) 2020-2024 Jess VanDerwalker
 *
 * weather_request_handler.js
 */

import needle from 'needle';

/**
 * Interface for the weather response object.
 */
export interface WeatherResponse {
    station: string;
    temperature: number;
    relativeHumidity: number;
    textDescription: string;
}

export class WeatherRequestError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = 'WeatherRequestError';
        this.statusCode = statusCode;
    }
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
     * @param x {number} The grid x of the station.
     * @param y {number} The grid y of the station.
     * @param siUnits {boolean} Return values in SI units if true.
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
            return Promise.reject(new WeatherRequestError('stationId is required', 400));
        }
        const url = `https://api.weather.gov/stations/${this.stationId}/observations/latest`;
        return needle('get', url)
            .then((resp) => {
                const statusCode = typeof resp.statusCode === 'number' ? resp.statusCode : 500;
                if (statusCode >= 400) {
                    throw new WeatherRequestError(
                        `NOAA request failed with status ${statusCode}`,
                        statusCode
                    );
                }
                try {
                    return this._parseResponse(resp.body);
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : 'Invalid weather response';
                    throw new WeatherRequestError(message, 502);
                }
            })
            .catch((err: unknown) => {
                if (err instanceof WeatherRequestError) {
                    throw err;
                }
                const message =
                    err instanceof Error ? err.message : 'Unknown NOAA request error';
                throw new WeatherRequestError(`NOAA request failed: ${message}`, 502);
            });
    }

    /**
     * Parse the response and just get out the data that we need.
     * @param {unknown} body The body of the response from NOAA
     * @return {WeatherResponse} Response with parsed data.
     */
    private _parseResponse(body: unknown): WeatherResponse {
        let stationRes: unknown = body;
        if (typeof body === 'string') {
            stationRes = JSON.parse(body);
        }
        if (!stationRes || typeof stationRes !== 'object' || Array.isArray(stationRes)) {
            throw new Error('Invalid weather response: expected object payload');
        }
        const stationResRecord = stationRes as { properties?: {
            temperature?: { value?: unknown };
            relativeHumidity?: { value?: unknown };
            station?: unknown;
            textDescription?: unknown;
        } };
        const properties = stationResRecord.properties;
        const temperature = properties?.temperature?.value;
        const relativeHumidity = properties?.relativeHumidity?.value;
        const station = properties?.station;
        const textDescription = properties?.textDescription;

        if (typeof temperature !== 'number') {
            throw new Error('Invalid weather response: missing temperature');
        }
        if (typeof relativeHumidity !== 'number') {
            throw new Error('Invalid weather response: missing relativeHumidity');
        }
        if (typeof station !== 'string') {
            throw new Error('Invalid weather response: missing station');
        }
        if (typeof textDescription !== 'string') {
            throw new Error('Invalid weather response: missing textDescription');
        }

        const parsedRes: WeatherResponse = {
            temperature,
            relativeHumidity,
            station,
            textDescription
        };

        return parsedRes;
    }
}
