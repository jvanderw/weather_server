import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createApp, getForecastPeriods, getForecastUrl, startServer } from '../server';
import {
    WeatherRequestError,
    WeatherRequestHandler,
    WeatherResponse
} from '../weather_request_handler';
import request from 'supertest';
import { Application } from 'express';
import needle from 'needle';

jest.mock('needle');

const mockedNeedle = needle as unknown as jest.MockedFunction<typeof needle>;

let getResponseSpy: jest.SpiedFunction<WeatherRequestHandler['getResponse']>;

function mockGetResponse(result: WeatherResponse | unknown, shouldReject = false): void {
    if (shouldReject || result instanceof Error) {
        getResponseSpy.mockRejectedValue(result);
    } else {
        getResponseSpy.mockResolvedValue(result as WeatherResponse);
    }
}

describe('Express server', () => {
    let app: Application;

    beforeAll(() => {
        app = createApp();
    });

    beforeEach(() => {
        mockedNeedle.mockReset();
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

    it('should return 500 for an unexpected station error', async () => {
        mockGetResponse(new Error('Unexpected station failure'), true);

        const response = await request(app).get('/station123');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Unexpected station failure' });
    });

    it('should return first three forecast periods from NOAA forecast endpoint', async () => {
        const coordinates = '45.4838,-122.68';
        const forecastUrl = 'https://api.weather.gov/gridpoints/PQR/110,102/forecast';
        const periods = [
            { number: 1, name: 'Today' },
            { number: 2, name: 'Tonight' },
            { number: 3, name: 'Tuesday' },
            { number: 4, name: 'Tuesday Night' }
        ];

        mockedNeedle
            .mockResolvedValueOnce({
                statusCode: 200,
                body: {
                    properties: {
                        forecast: forecastUrl
                    }
                }
            } as never)
            .mockResolvedValueOnce({
                statusCode: 200,
                body: {
                    properties: {
                        periods
                    }
                }
            } as never);

        const response = await request(app).get(`/forecast/${coordinates}`);

        expect(mockedNeedle).toHaveBeenNthCalledWith(
            1,
            'get',
            `https://api.weather.gov/points/${coordinates}`,
            {
                open_timeout: 5000,
                read_timeout: 8000,
                response_timeout: 8000
            }
        );
        expect(mockedNeedle).toHaveBeenNthCalledWith(
            2,
            'get',
            forecastUrl,
            {
                open_timeout: 5000,
                read_timeout: 8000,
                response_timeout: 8000
            }
        );
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ periods: periods.slice(0, 3) });
    });

    it('should return 502 when NOAA points response is missing forecast', async () => {
        const coordinates = '45.4838,-122.68';
        mockedNeedle.mockResolvedValueOnce({
            statusCode: 200,
            body: {
                properties: {}
            }
        } as never);

        const response = await request(app).get(`/forecast/${coordinates}`);

        expect(response.status).toBe(502);
        expect(response.body).toEqual({ error: 'Invalid forecast response: missing forecast' });
    });

    it('should return 502 when NOAA forecast response is missing periods', async () => {
        const coordinates = '45.4838,-122.68';
        const forecastUrl = 'https://api.weather.gov/gridpoints/PQR/110,102/forecast';
        mockedNeedle
            .mockResolvedValueOnce({
                statusCode: 200,
                body: {
                    properties: {
                        forecast: forecastUrl
                    }
                }
            } as never)
            .mockResolvedValueOnce({
                statusCode: 200,
                body: {
                    properties: {}
                }
            } as never);

        const response = await request(app).get(`/forecast/${coordinates}`);

        expect(response.status).toBe(502);
        expect(response.body).toEqual({ error: 'Invalid forecast response: missing periods' });
    });

    it('parses a JSON string points response', async () => {
        const forecastUrl = 'https://api.weather.gov/gridpoints/PQR/110,102/forecast';
        mockedNeedle.mockResolvedValueOnce({
            statusCode: 200,
            body: JSON.stringify({ properties: { forecast: forecastUrl } })
        } as never);

        await expect(getForecastUrl('45.4838,-122.68')).resolves.toBe(forecastUrl);
    });

    it('rejects an invalid points payload and upstream points status', async () => {
        mockedNeedle.mockResolvedValueOnce({ statusCode: 200, body: [] } as never);
        await expect(getForecastUrl('45.4838,-122.68')).rejects.toMatchObject({
            statusCode: 502,
            code: 'NOAA_INVALID_RESPONSE'
        });

        mockedNeedle.mockResolvedValueOnce({ statusCode: 503, body: {} } as never);
        await expect(getForecastUrl('45.4838,-122.68')).rejects.toMatchObject({
            statusCode: 502,
            code: 'NOAA_UPSTREAM_ERROR'
        });
    });

    it('reports points request timeouts as gateway timeouts', async () => {
        mockedNeedle.mockRejectedValueOnce(new Error('request timeout'));

        await expect(getForecastUrl('45.4838,-122.68')).rejects.toMatchObject({
            statusCode: 504,
            code: 'NOAA_TIMEOUT'
        });
    });

    it('parses a JSON string forecast response', async () => {
        const forecastUrl = 'https://api.weather.gov/gridpoints/PQR/110,102/forecast';
        const periods = [{ number: 1 }, { number: 2 }];
        mockedNeedle
            .mockResolvedValueOnce({
                statusCode: 200,
                body: { properties: { forecast: forecastUrl } }
            } as never)
            .mockResolvedValueOnce({
                statusCode: 200,
                body: JSON.stringify({ properties: { periods } })
            } as never);

        await expect(getForecastPeriods('45.4838,-122.68')).resolves.toEqual(periods);
    });

    it('reports forecast request network errors', async () => {
        const forecastUrl = 'https://api.weather.gov/gridpoints/PQR/110,102/forecast';
        mockedNeedle
            .mockResolvedValueOnce({
                statusCode: 200,
                body: { properties: { forecast: forecastUrl } }
            } as never)
            .mockRejectedValueOnce({ code: 'ECONNRESET' });

        await expect(getForecastPeriods('45.4838,-122.68')).rejects.toMatchObject({
            statusCode: 504,
            code: 'NOAA_TIMEOUT'
        });
    });

    it('should return 400 for invalid forecast coordinates', async () => {
        const response = await request(app).get('/forecast/not-a-coordinate');

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'Invalid coordinates. Use format latitude,longitude'
        });
    });

    it('should return healthy status from health endpoint', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok' });
    });

    it('starts server listening on default port 4950', (done) => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const server = startServer();
        const address = server.address();
        if (address && typeof address === 'object') {
            expect(address.port).toBe(4950);
        }
        server.close(() => {
            consoleSpy.mockRestore();
            done();
        });
    });
});