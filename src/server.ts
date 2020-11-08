/**
 * Copyright (c) 2020 Jess VanDerwalker
 */

import express from 'express';

const app = express();
const port = 3030;

app.get('/', (req, res) => {
    res.send('This is the web server');
});

app.listen(port, (err) => {
    if (err) {
        console.error(err);
    }
    console.log(`server is listening of ${port}`);
});
