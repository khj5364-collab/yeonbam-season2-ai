const axios = require('axios');
const BASE_URL = 'http://localhost:3000';

async function checkSystem() {
    console.log('\n🔍 시스템 점검 시작...\n');
    
    // 통계 확인
    const stats = await axios.get(`${BASE_URL}/api/admin/stats`, {
        params: { statsCode: '1234', teamStatsCode: '1234' }
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 최종 시스템 현황');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ 코드: 1234`);
    console.log(`✅ 전체 참가자: ${stats.data.stats.total}명`);
    console.log(`   - 남성: ${stats.data.stats.male}명 (1~21)`);
    console.log(`   - 여성: ${stats.data.stats.female}명 (a~n)`);
    console.log('');
    console.log('👥 팀별 배정 현황:');
    stats.data.stats.teams.forEach(team => {
        const bar = '█'.repeat(team.total_count);
        console.log(`   Team ${team.team_number}: ${bar} ${team.total_count}명 (남${team.male_count}/여${team.female_count})`);
    });
    console.log('');
    
    // MBTI 통계
    const mbti = await axios.get(`${BASE_URL}/api/admin/mbti-stats`);
    console.log('📈 MBTI 분포:');
    mbti.data.mbti.slice(0, 8).forEach(m => {
        console.log(`   ${m.mbti}: ${m.count}명`);
    });
    console.log('');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 시스템 정상 작동 확인 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🌐 접속 URL:');
    console.log(`   메인: http://localhost:3000`);
    console.log(`   관리자: http://localhost:3000/admin (비밀번호: qwer1234)`);
    console.log('');
}

checkSystem().catch(err => console.error('오류:', err.message));
