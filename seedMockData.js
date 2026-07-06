/**
 * seedMockData.js
 * Seeds 2026 Mock cutoff data from scraped JSON files into MongoDB.
 * JSON files are produced by scripts/scrape_mock_cutoffs.py and contain
 * flat record objects: { college_code, college_name, course_name, category, cutoff_rank_num, year, round }
 */
require('dns').setServers(['1.1.1.1', '8.8.8.8']);
const fs = require('fs');
const path = require('path');
const { getModelForStream } = require('./models/KCETCutoff');
const kcetConnection = require('./config/KCETdb');

// Map JSON filename prefixes → stream collection name
const STREAM_MAP = {
    'Engineering_(HK)':                      'Engineering',
    'Engineering':                            'Engineering',
    'Agriculture_Theory_(HK)':               'Agriculture',
    'Agriculture_Theory':                    'Agriculture',
    'Agriculture_Practical_(HK)':            'Agriculture',
    'Agriculture_Practical':                 'Agriculture',
    'Agricultural_Engineering_Practical_(HK)': 'Agriculture',
    'Agricultural_Engineering_Practical':    'Agriculture',
    'Agricultural_Engineering_(HK)':         'Agriculture',
    'Agricultural_Engineering':              'Agriculture',
    'Food_Science_Theory_(HK)':              'Agriculture',
    'Food_Science_Theory':                   'Agriculture',
    'Food_Science_Practical_(HK)':           'Agriculture',
    'Food_Science_Practical':                'Agriculture',
    'Veterinary_Theory_(HK)':               'Veterinary',
    'Veterinary_Theory':                    'Veterinary',
    'Veterinary_Practical_(HK)':            'Veterinary',
    'Veterinary_Practical':                 'Veterinary',
    'Nursing_(HK)':                         'B.Sc Nursing',
    'Nursing':                              'B.Sc Nursing',
    'B.Sc._AHS_(HK)':                       'Allied Health Sciences',
    'B.Sc._AHS':                            'Allied Health Sciences',
    'BPT_(HK)':                             'BPT',
    'BPT':                                  'BPT',
};

function getStreamForFile(filename) {
    // Strip _Mock2026.json suffix
    const base = filename.replace('_Mock2026.json', '');
    // Try longest-prefix match first
    const keys = Object.keys(STREAM_MAP).sort((a, b) => b.length - a.length);
    for (const key of keys) {
        if (base === key || base.startsWith(key)) {
            return STREAM_MAP[key];
        }
    }
    return 'Engineering'; // fallback
}

async function seedData() {
    const mockDataDir = path.join(__dirname, '../../fileupload2/DigitalMarketProject/DigitalMarketProject/kcet/dem/backend/mock_data');

    if (!fs.existsSync(mockDataDir)) {
        console.error('Mock data directory not found at:', mockDataDir);
        process.exit(1);
    }

    const files = fs.readdirSync(mockDataDir).filter(f => f.endsWith('.json'));
    console.log(`\nFound ${files.length} JSON files to seed.\n`);

    // First: clear ALL existing 2026 Mock data from all streams
    const { CATEGORIES } = require('./models/KCETCutoff');
    console.log('Clearing old 2026 Mock data from all collections...');
    for (const stream of CATEGORIES) {
        const Model = getModelForStream(stream);
        const deleted = await Model.deleteMany({ year: '2026', round: 'Mock' });
        if (deleted.deletedCount > 0) {
            console.log(`  Deleted ${deleted.deletedCount} old records from ${stream}`);
        }
    }
    console.log('');

    // Accumulate records per stream across all files
    const streamBatches = {};

    for (const file of files) {
        const stream = getStreamForFile(file);
        const filePath = path.join(mockDataDir, file);
        let data;

        try {
            data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) {
            console.error(`  Failed to parse ${file}:`, e.message);
            continue;
        }

        if (!Array.isArray(data) || data.length === 0) {
            console.log(`  Skipping ${file}: empty or invalid`);
            continue;
        }

        if (!streamBatches[stream]) streamBatches[stream] = [];

        let added = 0;
        for (const record of data) {
            // Validate required fields
            if (!record.college_code || !record.college_name || !record.course_name || !record.category) continue;
            if (record.cutoff_rank_num == null || isNaN(record.cutoff_rank_num)) continue;

            streamBatches[stream].push({
                college_code: String(record.college_code).trim(),
                college_name: String(record.college_name).replace(/\n/g, ' ').trim(),
                course_name: String(record.course_name).replace(/\n/g, ' ').trim(),
                stream: stream,
                cutoff_rank_num: parseFloat(record.cutoff_rank_num),
                year: '2026',
                round: 'Mock',
                category: String(record.category).trim(),
            });
            added++;
        }
        console.log(`  ${file} → ${stream}: ${added} records queued`);
    }

    // Insert per stream
    let totalInserted = 0;
    for (const [stream, batch] of Object.entries(streamBatches)) {
        if (batch.length === 0) continue;
        const Model = getModelForStream(stream);
        await Model.insertMany(batch, { ordered: false });
        totalInserted += batch.length;
        console.log(`\n  ✓ Inserted ${batch.length} records into ${stream}`);
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`DONE! Successfully inserted ${totalInserted} total records.`);
    console.log(`${'='.repeat(50)}`);
    process.exit(0);
}

kcetConnection.once('open', () => {
    seedData().catch(err => {
        console.error('Seeding failed:', err);
        process.exit(1);
    });
});
