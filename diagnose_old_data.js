require('dns').setServers(['1.1.1.1', '8.8.8.8']);
const { getModelForStream } = require('./models/KCETCutoff');
const kcetConnection = require('./config/KCETdb');

async function diagnose() {
    const Model = getModelForStream('Engineering');

    // 1. Check what distinct round values exist in old data
    const rounds = await Model.distinct('round', { year: { $in: ['2023', '2024', '2025'] } });
    console.log('\n--- Distinct ROUND values in 2023-2025 data ---');
    console.log(rounds);

    // 2. Check what distinct year values exist
    const years = await Model.distinct('year');
    console.log('\n--- Distinct YEAR values in Engineering ---');
    console.log(years);

    // 3. Sample a few old records to see their structure
    console.log('\n--- Sample 2025 records ---');
    const samples = await Model.find({ year: '2025' }).limit(5).lean();
    samples.forEach(s => {
        console.log({
            college_code: s.college_code,
            course_name: s.course_name,
            category: s.category,
            year: s.year,
            round: s.round,
            cutoff_rank: s.cutoff_rank,
            cutoff_rank_num: s.cutoff_rank_num,
        });
    });

    // 4. Check how many old records have cutoff_rank_num vs cutoff_rank
    const withNum = await Model.countDocuments({ year: '2025', cutoff_rank_num: { $type: 'number' } });
    const withStr = await Model.countDocuments({ year: '2025', cutoff_rank: { $type: 'string' } });
    const total2025 = await Model.countDocuments({ year: '2025' });
    console.log(`\n--- 2025 Data Field Coverage ---`);
    console.log(`Total 2025: ${total2025}`);
    console.log(`Has cutoff_rank_num (number): ${withNum}`);
    console.log(`Has cutoff_rank (string): ${withStr}`);

    process.exit(0);
}

kcetConnection.once('open', () => {
    diagnose().catch(err => { console.error(err); process.exit(1); });
});
