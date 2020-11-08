"use strict";
/**
 * Copyright (c) 2020 Jess VanDerwalker
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = express_1.default();
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
//# sourceMappingURL=server.js.map