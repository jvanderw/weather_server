/**
 * Copyright (c) 2020 Jess VanDerwalker
 *
 * weather_request_handler.js
 */

/**
 * Interface for a the weather request object type.
 */
export interface WeatherRequest {
    stationId: string;
    x: number;
    y: number;
    siUnits: boolean;
}

/**
 * Interface for the weather response object.
 */
export interface WeatherResponse {
    locationName: string;
    temperature: number;
    humidity: number;
}

const BASE_URL: string = 'https://api.weather.gov/stations/KPDX/observations/latest'
/**
 * Class that handles the a request for weather data from NOAA JSON
 * API.
 */
export class WeatherRequestHandler {
    request: WeatherRequest;

    /**
     * Create the request object.
     * @param {WeatherRequest} request The request.
     */
    constructor(request: WeatherRequest) {
        this.request = request;
    }

    getWeather(): WeatherResponse {
        let response: WeatherResponse;

        return response;
    }
}
