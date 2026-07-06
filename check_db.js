require('dns').setServers(['1.1.1.1', '8.8.8.8']);
const mongoose = require('mongoose');
const { getModelForStream } = require('./models/KCETCutoff');

async function main() {
    const Model = getModelForStream('Engineering');
    const mockData = await Model.find({ year: '2026' }).limit(5).lean();
    console.log(JSON.stringify(mockData, null, 2));
    process.exit(0);
}
main();
