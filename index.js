const localtunnel = require('localtunnel');
const express = require('express');
const firebase = require('firebase');
const low = require('lowdb');
const cors = require('cors');
const bodyParser = require('body-parser')
const FileSync = require('lowdb/adapters/FileSync')
const config = require('./config');

const { getWebhooksSettings, updateWebhooksSettings } = require('./api');
const { addUsersToSettings, getUsersFromMatch } = require('./utils');

const app = express()
app.use(cors({ origin: true }));
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const adapter = new FileSync('db.json')
const db = low(adapter)
firebase.initializeApp(process.env.FIREBASE_CONFIG);

let matches = [];

const init = async () => {
    const tunnel = await localtunnel({ port: config.PORT, subdomain: config.SUBDOMAIN });
  
    console.log(`Tunnel ready at ${tunnel.url}`);
  
    tunnel.on('close', () => {
        console.log("Tunnel closed")
    });

    const settings = await getWebhooksSettings();
    currentUsers = settings[0].restrictions.length
}

init();

const syncUsers = async () => {
    const matches = db.get('matches').value();
    const users = [].concat.apply([], matches.map(match => getUsersFromMatch(match)))
    let settings = await getWebhooksSettings();
    const savedUsers = settings[0].restrictions.map(user => user.value)
    const mergedUsers = [...new Set([ ...users, ...savedUsers ])];
    settings = addUsersToSettings(mergedUsers, settings[0])
    return await updateWebhooksSettings(settings);
}

const checkMatches = async () => {
    if (matches.length >= config.MATCHES_BATCH){
        const batch = firebase.firestore().batch();
        matches.forEach(match => { batch.set(firebase.firestore().collection('raw-matches').doc(match.id), match) })
        await batch.commit();
        console.log(`Saved ${config.MATCHES_BATCH} matches`);
        matches = [];
    }
}

app.post('/webhooks/add', async (req, res) => {
    const { event, payload } = req.body;
    
    
    if (event === 'match_status_finished'){
        matches.push(payload)
        console.log("Match")
        await checkMatches();
    }
    return res.status(200).json();
})

app.post('/webhooks/addusers', async (req, res) => {
    const { users } = req.body;
    if(!users) return res.status(400).json();
    let settings = await getWebhooksSettings();
    const before = settings[0].restrictions.length
    settings = addUsersToSettings(users, settings[0]);
    const newSettings = await updateWebhooksSettings(settings);
    return res.status(200).json({ requested: users.length, before, after: newSettings.restrictions.length });
})

app.get('/webhooks/settings', async (req, res) => {
    const settings = await getWebhooksSettings();
    return res.status(200).json(settings);
})

app.post('/sync', async (req, res) => {
    const response = await syncUsers();
    return res.status(200).json(response);
})

app.listen(config.PORT, () => { console.log(`Running on port: ${config.PORT}`) })