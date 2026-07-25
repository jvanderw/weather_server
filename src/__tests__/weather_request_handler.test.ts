import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import needle from 'needle';
import { WeatherRequestError, WeatherRequestHandler } from '../weather_request_handler';

jest.mock('needle');

const mockedNeedle = needle as unknown as {
    mockReset: () => void;
    mockReturnValue: (value: Promise<unknown>) => void;
    mockRejectedValue: (value: unknown) => void;
};

describe('WeatherRequestHandler', () => {
    beforeEach(() => {
        mockedNeedle.mockReset();
    });

    it('rejects when stationId is missing', async () => {
        const wrh = new WeatherRequestHandler('', 0, 0, false);
        await expect(wrh.getResponse()).rejects.toThrow('stationId is required');
    });

    it('parses object response body', async () => {
        mockedNeedle.mockReturnValue(Promise.resolve({
            statusCode: 200,
            body: {
                properties: {
                    temperature: { value: 20 },
                    relativeHumidity: { value: 55 },
                    station: 'KPDX',
                    textDescription: 'Sunny'
                }
            }
        }));

        const wrh = new WeatherRequestHandler('KPDX', 0, 0, false);
        const response = await wrh.getResponse();

        expect(mockedNeedle).toHaveBeenCalledWith(
            'get',
            'https://api.weather.gov/stations/KPDX/observations/latest',
            {
                open_timeout: 5000,
                read_timeout: 8000,
                response_timeout: 8000
            }
        );
        expect(response).toEqual({
            temperature: 20,
            relativeHumidity: 55,
            station: 'KPDX',
            textDescription: 'Sunny'
        });
    });

    it('parses string response body', async () => {
        mockedNeedle.mockReturnValue(Promise.resolve({
            statusCode: 200,
            body: JSON.stringify({
                properties: {
                    temperature: { value: 10 },
                    relativeHumidity: { value: 80 },
                    station: 'KSEA',
                    textDescription: 'Cloudy'
                }
            })
        }));

        const wrh = new WeatherRequestHandler('KSEA', 0, 0, false);
        const response = await wrh.getResponse();

        expect(response).toEqual({
            temperature: 10,
            relativeHumidity: 80,
            station: 'KSEA',
            textDescription: 'Cloudy'
        });
    });

    it('rejects invalid NOAA payloads', async () => {
        mockedNeedle.mockReturnValue(Promise.resolve({
            statusCode: 200,
            body: { properties: {} }
        }));

        const wrh = new WeatherRequestHandler('KSEA', 0, 0, false);
        await expect(wrh.getResponse()).rejects.toBeInstanceOf(WeatherRequestError);
        await expect(wrh.getResponse()).rejects.toMatchObject({
            message: 'Invalid weather response: missing temperature',
            statusCode: 502
        });
    });

    it('rejects with status-aware error for non-2xx NOAA responses', async () => {
        mockedNeedle.mockReturnValue(Promise.resolve({
            statusCode: 404,
            body: { title: 'Not Found' }
        }));

        const wrh = new WeatherRequestHandler('KSEA', 0, 0, false);

        await expect(wrh.getResponse()).rejects.toBeInstanceOf(WeatherRequestError);
        await expect(wrh.getResponse()).rejects.toMatchObject({
            message: 'NOAA request failed with status 404',
            statusCode: 502
        });
    });

    it('rejects with 502 error for NOAA transport failures', async () => {
        mockedNeedle.mockRejectedValue(new Error('socket hang up'));

        const wrh = new WeatherRequestHandler('KSEA', 0, 0, false);

        await expect(wrh.getResponse()).rejects.toBeInstanceOf(WeatherRequestError);
        await expect(wrh.getResponse()).rejects.toMatchObject({
            message: 'NOAA request failed: socket hang up',
            statusCode: 502
        });
    });
});
