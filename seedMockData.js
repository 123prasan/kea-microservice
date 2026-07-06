const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { getModelForStream } = require('./models/KCETCutoff');
const kcetConnection = require('./config/KCETdb');

// Map JSON filename prefixes to the correct stream name expected by KCETCutoff.js
const STREAM_MAP = {
    'Engineering': 'Engineering',
    'Agriculture': 'Agriculture',
    'Veterinary': 'Veterinary',
    'Nursing': 'B.Sc Nursing',
    'B.Sc._AHS': 'Allied Health Sciences',
    'BPT': 'BPT',
    'Food_Science': 'Agriculture', // Food Science usually falls under Agriculture/Farm Science
    'Agricultural_Engineering': 'Agriculture'
};

async function seedData() {
    const mockDataDir = path.join(__dirname, '../../fileupload2/DigitalMarketProject/DigitalMarketProject/kcet/dem/backend/mock_data');
    
    if (!fs.existsSync(mockDataDir)) {
        console.error("Mock data directory not found at", mockDataDir);
        process.exit(1);
    }
    
    const files = fs.readdirSync(mockDataDir).filter(f => f.endsWith('.json'));
    
    let totalInserted = 0;

    for (const file of files) {
        // e.g. "Engineering_Mock2026.json" or "Engineering_(HK)_Mock2026.json"
        let mappedStream = 'Engineering'; // default
        for (const [key, val] of Object.entries(STREAM_MAP)) {
            if (file.startsWith(key)) {
                mappedStream = val;
                break;
            }
        }
        
        console.log(`\nProcessing ${file} -> Stream: ${mappedStream}`);
        const streamModel = getModelForStream(mappedStream);
        
        const data = JSON.parse(fs.readFileSync(path.join(mockDataDir, file), 'utf-8'));
        
        if (data.length === 0) continue;
        
        // Find header row to map indices
        // Expected: [c_code, c_name, "Course Name", "1G", "1K", ...]
        let headerRow = null;
        let headerIndex = -1;
        
        for (let i = 0; i < Math.min(20, data.length); i++) {
            if (data[i] && data[i].length > 5 && (data[i][2] === 'Course Name' || data[i][2] === 'Course\nName')) {
                headerRow = data[i];
                headerIndex = i;
                break;
            }
        }
        
        if (!headerRow) {
            console.log("Could not find header row in", file);
            continue;
        }
        
        let batch = [];
        
        for (let i = headerIndex + 1; i < data.length; i++) {
            const row = data[i];
            
            // Skip rows that are repeats of the header
            if (row[2] === 'Course Name' || row[2] === 'Course\nName' || !row[2]) continue;
            
            const college_code = row[0];
            const college_name = (row[1] || "").replace(/\n/g, ' ').trim();
            const course_name = (row[2] || "").replace(/\n/g, ' ').trim();
            
            if (!college_code || college_code === 'UNKNOWN') continue;
            
            // Iterate over category columns
            for (let c = 3; c < headerRow.length; c++) {
                const categoryRaw = headerRow[c];
                if (!categoryRaw || categoryRaw.trim() === '') continue;
                
                const category = categoryRaw.replace(/\n/g, '').trim();
                const rankVal = row[c] ? row[c].replace(/\n/g, '').trim() : '--';
                
                if (rankVal && rankVal !== '--' && rankVal !== '') {
                    // Try to parse number, it might have decimals like 6493.5 in mock
                    const rankNum = parseFloat(rankVal);
                    if (!isNaN(rankNum)) {
                        batch.push({
                            college_code,
                            college_name,
                            course_name,
                            stream: mappedStream,
                            cutoff_rank_num: rankNum,
                            year: '2026',
                            round: 'Mock',
                            category
                        });
                    }
                }
            }
        }
        
        if (batch.length > 0) {
            // Delete old mock 2026 data for this stream to avoid duplicates
            await streamModel.deleteMany({ year: '2026', round: 'Mock' });
            
            await streamModel.insertMany(batch);
            totalInserted += batch.length;
            console.log(`Inserted ${batch.length} cutoff records into ${mappedStream}`);
        }
    }
    
    console.log(`\nDONE! Successfully inserted a total of ${totalInserted} records.`);
    process.exit(0);
}

// Wait for connection to open before seeding
kcetConnection.once('open', () => {
    seedData().catch(err => {
        console.error(err);
        process.exit(1);
    });
});
