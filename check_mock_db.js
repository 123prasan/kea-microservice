require('dns').setServers(['1.1.1.1', '8.8.8.8']);
const { getModelForStream, CATEGORIES } = require('./models/KCETCutoff');
const kcetConnection = require('./config/KCETdb');

async function checkMockData() {
    console.log('\n=== Checking 2026 Mock Cutoff Records in MongoDB ===\n');
    for (const stream of CATEGORIES) {
        const Model = getModelForStream(stream);
        const mockCount = await Model.countDocuments({ year: '2026', round: 'Mock' });
        const totalCount = await Model.countDocuments({});
        console.log(`${stream.padEnd(25)} | Mock 2026: ${String(mockCount).padStart(6)} records | Total: ${totalCount}`);
    }
    console.log('\nDone.');
    process.exit(0);
}

kcetConnection.once('open', () => {
    checkMockData().catch(err => {
        console.error(err);
        process.exit(1);
    });
});
