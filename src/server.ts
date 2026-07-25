/**
 * Copyright (c) 2020-2024 Jess VanDerwalker
 */

import express from 'express';
import { Server } from 'http';
import {
    WeatherRequestError,
    WeatherRequestHandler,
    WeatherResponse
} from './weather_request_handler';

export function createApp(): express.Application {
    const app = express();

    app.get('/health', (_req, res) => {
        res.status(200).json({ status: 'ok' });
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
    startServer();
}
