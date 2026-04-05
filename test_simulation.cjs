const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const CODE = '1234';
const VALID_DATE = new Date().toISOString().split('T')[0];

const mbtiTypes = ['ENFP', 'INFP', 'ENFJ', 'INFJ', 'ENTP', 'INTP', 'ENTJ', 'INTJ', 
                   'ESFP', 'ISFP', 'ESFJ', 'ISFJ', 'ESTP', 'ISTP', 'ESTJ', 'ISTJ'];

function getRandomMBTI() {
    return mbtiTypes[Math.floor(Math.random() * mbtiTypes.length)];
}

async function runSimulation() {
    console.log('🚀 시뮬레이션 시작...\n');
    
    try {
        // 1-2. 코드 생성 및 활성화
        console.log('1️⃣ 일일 코드 생성 및 활성화 중...');
        await axios.post(`${BASE_URL}/api/admin/generate-code`, {
            code: CODE, validDate: VALID_DATE, adminPassword: 'qwer1234'
        });
        await axios.post(`${BASE_URL}/api/admin/toggle-code`, {
            code: CODE, adminPassword: 'qwer1234'
        });
        console.log(`✅ 코드 ${CODE} 생성 및 활성화 완료\n`);
        
        // 3. 남성 21명 등록
        console.log('2️⃣ 남성 참가자 등록 중 (21명)...');
        const maleParticipants = [];
        for (let i = 1; i <= 21; i++) {
            const response = await axios.post(`${BASE_URL}/api/register`, {
                nickname: `${i}`, gender: 'male', accessCode: CODE, mbti: getRandomMBTI()
            });
            maleParticipants.push({ id: response.data.userId, nickname: `${i}` });
            process.stdout.write(`   ${i}/21 등록 완료\r`);
        }
        console.log('\n✅ 남성 21명 등록 완료\n');
        
        // 4. 여성 14명 등록
        console.log('3️⃣ 여성 참가자 등록 중 (14명)...');
        const femaleParticipants = [];
        const femaleNames = 'abcdefghijklmn'.split('');
        for (let i = 0; i < 14; i++) {
            const response = await axios.post(`${BASE_URL}/api/register`, {
                nickname: femaleNames[i], gender: 'female', accessCode: CODE, mbti: getRandomMBTI()
            });
            femaleParticipants.push({ id: response.data.userId, nickname: femaleNames[i] });
            process.stdout.write(`   ${i + 1}/14 등록 완료\r`);
        }
        console.log('\n✅ 여성 14명 등록 완료\n');
        
        // 5. 팀 배정
        console.log('4️⃣ 팀 랜덤 배정 중...');
        const assignResponse = await axios.post(`${BASE_URL}/api/admin/assign-teams`, {
            code: CODE, adminPassword: 'qwer1234'
        });
        console.log(`✅ ${assignResponse.data.message}\n`);
        
        // 6. 통계 확인
        console.log('5️⃣ 통계 확인 중...');
        const statsResponse = await axios.get(`${BASE_URL}/api/admin/stats`, {
            params: { statsCode: CODE, teamStatsCode: CODE }
        });
        const stats = statsResponse.data.stats;
        console.log('📊 전체 통계:');
        console.log(`   전체: ${stats.total}명 (남 ${stats.male}, 여 ${stats.female})\n`);
        console.log('👥 팀별 현황:');
        stats.teams.forEach(team => {
            console.log(`   Team ${team.team_number}: ${team.total_count}명 (남 ${team.male_count}, 여 ${team.female_count})`);
        });
        console.log('');
        
        // 7. 투표 테스트
        console.log('6️⃣ 호감도 투표 테스트 중...');
        await axios.post(`${BASE_URL}/api/votes/submit`, {
            voterId: maleParticipants[0].id, accessCode: CODE,
            votedNicknames: [femaleParticipants[0].nickname, femaleParticipants[1].nickname]
        });
        await axios.post(`${BASE_URL}/api/votes/submit`, {
            voterId: maleParticipants[1].id, accessCode: CODE,
            votedNicknames: [femaleParticipants[0].nickname, femaleParticipants[2].nickname]
        });
        await axios.post(`${BASE_URL}/api/votes/submit`, {
            voterId: femaleParticipants[0].id, accessCode: CODE,
            votedNicknames: [maleParticipants[0].nickname, maleParticipants[1].nickname]
        });
        console.log('✅ 투표 3건 완료\n');
        
        // 8. 랭킹 확인
        console.log('7️⃣ 호감도 랭킹 확인 중...');
        const rankingResponse = await axios.get(`${BASE_URL}/api/votes/ranking`, {
            params: { accessCode: CODE }
        });
        console.log('🏆 남성 랭킹 TOP 3:');
        rankingResponse.data.maleRanking.slice(0, 3).forEach((rank, idx) => {
            const medal = ['🥇', '🥈', '🥉'][idx];
            console.log(`   ${medal} ${rank.nickname}: ${rank.vote_count}표`);
        });
        console.log('\n🏆 여성 랭킹 TOP 3:');
        rankingResponse.data.femaleRanking.slice(0, 3).forEach((rank, idx) => {
            const medal = ['🥇', '🥈', '🥉'][idx];
            console.log(`   ${medal} ${rank.nickname}: ${rank.vote_count}표`);
        });
        console.log('');
        
        // 최종 요약
        console.log('\n✨ 시뮬레이션 완료! ✨');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`코드: ${CODE}`);
        console.log(`참가자: ${stats.total}명 (남 ${stats.male}, 여 ${stats.female})`);
        console.log(`팀 구성: 6개 팀`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n✅ 모든 시스템 정상 작동!\n');
        
    } catch (error) {
        console.error('\n❌ 오류:', error.response?.data?.message || error.message);
        process.exit(1);
    }
}

runSimulation();
