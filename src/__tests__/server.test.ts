import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createApp, logWeatherResponse } from '../server';
import {
    WeatherRequestError,
    WeatherRequestHandler,
    WeatherResponse
} from '../weather_request_handler';
import request from 'supertest';
import { Application } from 'express';

let getResponseSpy: jest.SpiedFunction<WeatherRequestHandler['getResponse']>;

function mockGetResponse(result: WeatherResponse | unknown, shouldReject = false): void {
    if (shouldReject || result instanceof Error) {
        getResponseSpy.mockRejectedValue(result);
    } else {
        getResponseSpy.mockResolvedValue(result as WeatherResponse);
    }
}

describe('logWeatherResponse', () => {
    beforeEach(() => {
        getResponseSpy = jest.spyOn(WeatherRequestHandler.prototype, 'getResponse');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should log the weather response', async () => {
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const mockResponse: WeatherResponse = {
            station: 'station123',
            temperature: 25,
            relativeHumidity: 60,
            textDescription: 'Sunny'
        };
        mockGetResponse(mockResponse);

        await logWeatherResponse('station123');

        expect(consoleLogSpy).toHaveBeenCalledWith('Weather Response:', JSON.stringify(mockResponse, null, 2));
        consoleLogSpy.mockRestore();
    });

    it('should log an error if fetching weather response fails', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const mockError = new Error('Network error');
        mockGetResponse(mockError, true);

        await logWeatherResponse('station123');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching weather response:', mockError);
        consoleErrorSpy.mockRestore();
    });
});

describe('Express server', () => {
    let app: Application;

    beforeAll(() => {
        app = createApp();
    });

    beforeEach(() => {
        getResponseSpy = jest.spyOn(WeatherRequestHandler.prototype, 'getResponse');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return weather response for valid stationId', async () => {
        const mockResponse: WeatherResponse = {
            station: 'station123',
            temperature: 25,
            relativeHumidity: 60,
            textDescription: 'Sunny'
        };
        mockGetResponse(mockResponse);

        const response = await request(app).get('/station123');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockResponse);
    });

    it('should return error for invalid stationId', async () => {
        const mockError = new WeatherRequestError('stationId is required', 400);
        mockGetResponse(mockError, true);

        const response = await request(app).get('/station123');

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: mockError.message });
    });

    it('should return NOAA status code for upstream errors', async () => {
        const upstreamError = new WeatherRequestError(
            'NOAA request failed with status 404',
            502
        );
        mockGetResponse(upstreamError, true);

        const response = await request(app).get('/station123');

        expect(response.status).toBe(502);
        expect(response.body).toEqual({ error: upstreamError.message });
    });

    it('should return healthy status from health endpoint', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok' });
    });
});