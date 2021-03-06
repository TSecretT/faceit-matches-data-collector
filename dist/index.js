"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const firebase_1 = __importDefault(require("firebase"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const config_1 = __importDefault(require("./config"));
const api_1 = require("./api");
const utils_1 = require("./utils");
const app = express_1.default();
app.use(cors_1.default({ origin: true }));
app.use(body_parser_1.default.urlencoded({ extended: false }));
app.use(body_parser_1.default.json());
firebase_1.default.initializeApp(config_1.default.FIREBASE_CONFIG);
let matches = [];
const init = () => __awaiter(void 0, void 0, void 0, function* () {
    // const tunnel = await localtunnel({ port: config.PORT, subdomain: config.SUBDOMAIN })
    // console.log(`Tunnel ready at ${tunnel.url}`);
    // tunnel.on('close', () => {
    //     console.log("Tunnel closed")
    // });
    // const settings = await getWebhooksSettings();
});
const checkMatches = () => __awaiter(void 0, void 0, void 0, function* () {
    if (matches.length >= config_1.default.MATCHES_BATCH) {
        const batch = firebase_1.default.firestore().batch();
        matches.forEach((match) => { batch.set(firebase_1.default.firestore().collection('raw-matches').doc(match.id), match); });
        yield batch.commit();
        console.log(`Saved ${config_1.default.MATCHES_BATCH} matches`);
        matches = [];
    }
});
// init();
app.get('/', (req, res) => {
    return res.status(200).json("ok");
});
app.post('/update/domain', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name } = req.body;
    const response = yield api_1.updateDomain(name);
    return res.status(200).json();
}));
app.post('/update/url', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { url } = req.body;
    const response = yield api_1.updateURL(url);
    return res.status(200).json();
}));
app.post('/webhooks/add', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { event, payload } = req.body;
    if (event !== 'match_status_finished')
        return res.status(401).json();
    matches.push(payload);
    console.log("Match", payload.id);
    yield checkMatches();
    return res.status(200).json();
}));
app.get('/stats', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const matches = yield firebase_1.default.firestore().collection('raw-matches').get()
            .then(snapshot => utils_1.getListFromFirestore(snapshot));
        const players = [];
        matches.forEach((match) => {
            const matchPlayers = utils_1.getUsersFromMatch(match);
            matchPlayers.forEach((player) => { if (!players.includes(player))
                players.push(player); });
        });
        return res.status(200).json({
            matches: matches.length,
            players: players.length
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json();
    }
}));
app.post('/sync', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const startTime = utils_1.now();
        const matches = yield firebase_1.default.firestore().collection('raw-matches').get()
            .then(snapshot => utils_1.getListFromFirestore(snapshot));
        const players = [];
        matches.forEach((match) => {
            const matchPlayers = utils_1.getUsersFromMatch(match);
            matchPlayers.forEach((player) => { if (!players.includes(player))
                players.push(player); });
        });
        let settings = yield api_1.getWebhooksSettings();
        const playersBefore = settings.restrictions.length;
        const savedUsers = settings.restrictions.map((user) => user.value);
        const mergedUsers = [...new Set([...players, ...savedUsers])];
        settings = utils_1.addUsersToSettings(mergedUsers, settings);
        const newSettings = yield api_1.updateWebhooksSettings(settings);
        return res.status(200).json({
            playersBefore,
            playersAfter: newSettings.restrictions.length,
            operationTime: utils_1.now() - startTime
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json();
    }
}));
app.listen(config_1.default.PORT, config_1.default.HOST, () => { console.log(`Running on port: ${config_1.default.PORT}`); });
