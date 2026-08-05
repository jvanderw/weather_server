/**
 * Copyright (c) 2020-2024 Jess VanDerwalker
 */

import express from 'express';
import needle from 'needle';
import { Server } from 'http';
import {
    WeatherRequestError,
    WeatherRequestHandler,
    WeatherResponse
} from './weather_request_handler';

const NOAA_REQUEST_OPTIONS = {
    open_timeout: 5000,
    read_timeout: 8000,
    response_timeout: 8000
};

function isValidCoordinates(coordinates: string): boolean {
    return /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(coordinates);
}

export async function getForecastUrl(coordinates: string): Promise<string> {
    if (!isValidCoordinates(coordinates)) {
        throw new WeatherRequestError(
            'Invalid coordinates. Use format latitude,longitude',
            400,
            'INVALID_COORDINATES'
        );
    }

    try {
        const resp = await needle('get', `https://api.weather.gov/points/${coordinates}`, NOAA_REQUEST_OPTIONS);
        const statusCode = typeof resp.statusCode === 'number' ? resp.statusCode : 500;
        if (statusCode >= 400) {
            throw new WeatherRequestError(
                `NOAA points request failed with status ${statusCode}`,
                502,
                'NOAA_UPSTREAM_ERROR'
            );
        }

        let pointsResponse: unknown = resp.body;
        if (typeof resp.body === 'string') {
            pointsResponse = JSON.parse(resp.body);
        }
        if (!pointsResponse || typeof pointsResponse !== 'object' || Array.isArray(pointsResponse)) {
            throw new WeatherRequestError(
                'Invalid forecast response: expected object payload',
                502,
                'NOAA_INVALID_RESPONSE'
            );
        }

        const forecast = (pointsResponse as {
            properties?: { forecast?: unknown };
        }).properties?.forecast;

        if (typeof forecast !== 'string') {
            throw new WeatherRequestError(
                'Invalid forecast response: missing forecast',
                502,
                'NOAA_INVALID_RESPONSE'
            );
        }

        return forecast;
    } catch (err: unknown) {
        if (err instanceof WeatherRequestError) {
            throw err;
        }
        const message = err instanceof Error ? err.message : 'Unknown NOAA request error';
        const isTimeout =
            (err instanceof Error && /timeout/i.test(err.message)) ||
            (typeof err === 'object' && err !== null &&
                'code' in err && (err as { code?: string }).code === 'ECONNRESET');
        throw new WeatherRequestError(
            `NOAA points request failed: ${message}`,
            isTimeout ? 504 : 502,
            isTimeout ? 'NOAA_TIMEOUT' : 'NOAA_NETWORK_ERROR'
        );
    }
}

export async function getForecastPeriods(coordinates: string): Promise<unknown[]> {
    const forecastUrl = await getForecastUrl(coordinates);

    try {
        const resp = await needle('get', forecastUrl, NOAA_REQUEST_OPTIONS);
        const statusCode = typeof resp.statusCode === 'number' ? resp.statusCode : 500;
        if (statusCode >= 400) {
            throw new WeatherRequestError(
                `NOAA forecast request failed with status ${statusCode}`,
                502,
                'NOAA_UPSTREAM_ERROR'
            );
        }

        let forecastResponse: unknown = resp.body;
        if (typeof resp.body === 'string') {
            forecastResponse = JSON.parse(resp.body);
        }

        if (!forecastResponse || typeof forecastResponse !== 'object' || Array.isArray(forecastResponse)) {
            throw new WeatherRequestError(
                'Invalid forecast response: expected object payload',
                502,
                'NOAA_INVALID_RESPONSE'
            );
        }

        const periods = (forecastResponse as {
            properties?: { periods?: unknown };
        }).properties?.periods;

        if (!Array.isArray(periods)) {
            throw new WeatherRequestError(
                'Invalid forecast response: missing periods',
                502,
                'NOAA_INVALID_RESPONSE'
            );
        }

        return periods.slice(0, 3);
    } catch (err: unknown) {
        if (err instanceof WeatherRequestError) {
            throw err;
        }
        const message = err instanceof Error ? err.message : 'Unknown NOAA request error';
        const isTimeout =
            (err instanceof Error && /timeout/i.test(err.message)) ||
            (typeof err === 'object' && err !== null &&
                'code' in err && (err as { code?: string }).code === 'ECONNRESET');
        throw new WeatherRequestError(
            `NOAA forecast request failed: ${message}`,
            isTimeout ? 504 : 502,
            isTimeout ? 'NOAA_TIMEOUT' : 'NOAA_NETWORK_ERROR'
        );
    }
}

export function createApp(): express.Application {
    const app = express();

    app.get('/health', (_req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    app.get('/forecast/:coordinates', async (req, res) => {
        try {
            const periods = await getForecastPeriods(req.params.coordinates);
            res.status(200).json({ periods });
        } catch (err: unknown) {
            if (err instanceof WeatherRequestError) {
                res.status(err.statusCode).json({ error: err.message });
                return;
            }
            const message = err instanceof Error ? err.message : 'Unknown error';
            res.status(500).json({ error: message });
        }
    });

    app.get('/:stationId', async (req, res) => {
        const wrh: WeatherRequestHandler =
            new WeatherRequestHandler(req.params.stationId, 0, 0, false);
        try {
            const parsedRes = await wrh.getResponse();
            res.status(200).json(parsedRes);
        } catch (err: unknown) {
            if (err instanceof WeatherRequestError) {
                res.status(err.statusCode).json({ error: err.message });
                return;
            }
            const message = err instanceof Error ? err.message : 'Unknown error';
            res.status(500).json({ error: message });
        }
    });

    return app;
}

export function startServer(port = 3030): Server {
    const app = createApp();
    return app.listen(port, () => {
        console.log(`server is listening of ${port}`);
    });
}

function resolvePort(defaultPort = 3030): number {
    const rawPort = process.env.PORT;
    if (!rawPort) {
        return defaultPort;
    }

    const parsed = Number(rawPort);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        throw new Error(`Invalid PORT value: ${rawPort}`);
    }

    return parsed;
}

/**
 * Calls WeatherRequestHandler.getResponse() and outputs the result to the console in a readable format.
 * @param {string} stationId - The ID of the weather station.
 * @returns {Promise<void>} - A promise that resolves when the response is received.
 */
export async function logWeatherResponse(stationId: string): Promise<void> {
    try {
        const wrh = new WeatherRequestHandler(stationId, 0, 0, false);
        const response: WeatherResponse = await wrh.getResponse();
        console.log('Weather Response:', JSON.stringify(response, null, 2));
    } catch (error) {
        console.error('Error fetching weather response:', error);
    }
}

if (require.main === module) {
    startServer(resolvePort());
}
