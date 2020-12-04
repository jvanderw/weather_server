/**
 * Copyright (c) 2020 Jess VanDerwalker
 */

import express from 'express';
import { WeatherRequestHandler, WeatherResponse } from './weather_request_handler.js';

const app = express();
const port = 3030;

app.get('/:stationId', (req, res) => {
    // res.send('This is the web server');
    const wrh: WeatherRequestHandler =
        new WeatherRequestHandler(req.params.stationId, 0, 0, false);
    wrh.getResponse()
        .then((parsedRes) => {
            res.send(parsedRes);
        })
        .catch((err) => {
            res.send(err);
        })
});

app.listen(port, () => {
    console.log(`server is listening of ${port}`);
});
