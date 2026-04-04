const baseURL = 'http://localhost:3000';

// MBTI 타입 목록
const mbtiTypes = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
                   'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];

// 한국 이름 생성
const lastNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
const maleNames = ['민준', '서준', '도윤', '예준', '시우', '주원', '하준', '지호', '준서', '준우',
                   '현우', '지훈', '건우', '우진', '선우', '연우', '유준', '정우', '승현', '승우',
                   '시윤', '준혁', '은우', '지환', '승민', '지우', '유찬', '민재', '현준', '민성'];
const femaleNames = ['서연', '지우', '서윤', '지아', '하은', '민서', '하윤', '채원', '지유', '수아',
                     '다은', '예은', '소율', '예린', '수빈', '윤서', '채은', '지민', '은서', '가은',
                     '지원', '서현', '수연', '유나', '예서', '하린', '서아', '다인', '민지', '소은'];

function generateName(gender, index) {
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    if (gender === 'male') {
        return lastName + maleNames[index % maleNames.length];
    } else {
        return lastName + femaleNames[index % femaleNames.length];
    }
}

function getRandomMBTI() {
    return mbtiTypes[Math.floor(Math.random() * mbtiTypes.length)];
}

async function createParticipants() {
    console.log('🚀 48명의 참가자 생성 시작...\n');
    
    const participants = [];
    
    // 24명 남성, 24명 여성
    for (let i = 0; i < 48; i++) {
        const gender = i < 24 ? 'male' : 'female';
        const nickname = generateName(gender, i);
        const mbti = getRandomMBTI();
        
        try {
            const response = await fetch(`${baseURL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nickname,
                    gender,
                    accessCode: '0000',
                    mbti,
                    teamNumber: null
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                participants.push({ nickname, gender, mbti, id: data.id });
                console.log(`✅ ${i + 1}/48: ${nickname} (${gender === 'male' ? '남' : '여'}, ${mbti})`);
            }
        } catch (error) {
            console.log(`❌ ${i + 1}/48: ${nickname} - 실패:`, error.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`\n✅ 참가자 생성 완료! 총 ${participants.length}명\n`);
    return participants;
}

async function assignTeams() {
    console.log('👥 팀 자동 배정 시작...\n');
    
    try {
        const response = await fetch(`${baseURL}/api/admin/assign-teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: '0000',
                adminPassword: 'qwer1234'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ 팀 배정 완료!');
            console.log(`📊 배정 결과: ${data.message}\n`);
        }
    } catch (error) {
        console.log('❌ 팀 배정 실패:', error.message);
    }
}

async function sendRandomMessages() {
    console.log('💌 랜덤 쪽지 생성 시작...\n');
    
    const response = await fetch(`${baseURL}/api/admin/code/0000/participants`);
    const data = await response.json();
    const participants = data.participants || [];
    
    if (participants.length < 10) {
        console.log('⚠️  참가자가 충분하지 않습니다.');
        return;
    }
    
    const messages = [
        '안녕하세요! 반갑습니다 😊',
        '오늘 좋은 하루 보내세요!',
        '팀 활동 재미있게 하시길 바랍니다',
        '함께 열심히 해봐요!',
        '궁금한 게 있어서 연락드렸어요',
        '다음에 커피 한잔 하실래요?',
        '프로젝트 화이팅입니다!',
        '만나서 반가웠어요',
        '좋은 인연이 되었으면 좋겠어요',
        '이야기 나눠서 즐거웠습니다'
    ];
    
    let messageCount = 0;
    
    for (let i = 0; i < 30; i++) {
        const sender = participants[Math.floor(Math.random() * participants.length)];
        let receiver = participants[Math.floor(Math.random() * participants.length)];
        
        while (receiver.id === sender.id) {
            receiver = participants[Math.floor(Math.random() * participants.length)];
        }
        
        const content = messages[Math.floor(Math.random() * messages.length)];
        
        try {
            const response = await fetch(`${baseURL}/api/messages/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderId: sender.id,
                    receiverNickname: receiver.nickname,
                    accessCode: '0000',
                    content
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                messageCount++;
                console.log(`✅ ${messageCount}/30: ${sender.nickname} → ${receiver.nickname}`);
            }
        } catch (error) {
            console.log(`❌ 쪽지 전송 실패: ${sender.nickname} → ${receiver.nickname}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`\n✅ 총 ${messageCount}개의 쪽지 전송 완료!\n`);
}

async function sendRandomVotes() {
    console.log('⭐ 랜덤 투표 생성 시작...\n');
    
    const response = await fetch(`${baseURL}/api/admin/code/0000/participants`);
    const data = await response.json();
    const participants = data.participants || [];
    
    if (participants.length < 10) {
        console.log('⚠️  참가자가 충분하지 않습니다.');
        return;
    }
    
    let voteCount = 0;
    const voters = participants.slice(0, 30);
    
    for (const voter of voters) {
        const numVotes = Math.floor(Math.random() * 3) + 1;
        const voteeNicknames = [];
        
        for (let i = 0; i < numVotes; i++) {
            let votee = participants[Math.floor(Math.random() * participants.length)];
            
            while (votee.id === voter.id || voteeNicknames.includes(votee.nickname)) {
                votee = participants[Math.floor(Math.random() * participants.length)];
            }
            
            voteeNicknames.push(votee.nickname);
        }
        
        try {
            const response = await fetch(`${baseURL}/api/votes/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    voterId: voter.id,
                    voteeNicknames,
                    accessCode: '0000'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                voteCount++;
                console.log(`✅ ${voteCount}/30: ${voter.nickname} → [${voteeNicknames.join(', ')}]`);
            }
        } catch (error) {
            console.log(`❌ 투표 실패: ${voter.nickname}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`\n✅ 총 ${voteCount}명이 투표 완료!\n`);
}

async function showStatistics() {
    console.log('📊 최종 통계 확인...\n');
    
    try {
        const statsResponse = await fetch(`${baseURL}/api/admin/stats?code=0000`);
        const stats = await statsResponse.json();
        
        console.log('=== 참가자 통계 ===');
        console.log(`총 참가자: ${stats.total}명`);
        console.log(`남성: ${stats.male}명, 여성: ${stats.female}명\n`);
        
        const teamsResponse = await fetch(`${baseURL}/api/admin/code/0000/participants`);
        const teamsData = await teamsResponse.json();
        const teamStats = teamsData.stats.teams;
        
        console.log('=== 팀별 구성 ===');
        for (let i = 1; i <= 6; i++) {
            const team = teamStats[i] || { male: 0, female: 0, total: 0 };
            console.log(`Team ${i}: ${team.total}명 (남${team.male}, 여${team.female})`);
        }
        
        const mutualResponse = await fetch(`${baseURL}/api/admin/messages/mutual?accessCode=0000&adminPassword=qwer1234`);
        const mutualData = await mutualResponse.json();
        const mutualPairs = mutualData.matches || [];
        
        console.log(`\n=== 쪽지 통계 ===`);
        console.log(`쌍방 쪽지: ${mutualPairs.length}쌍`);
        
        if (mutualPairs.length > 0 && mutualPairs.length <= 10) {
            console.log('쌍방 쪽지 목록:');
            mutualPairs.forEach((pair, idx) => {
                console.log(`  ${idx + 1}. ${pair.person1_nickname} ↔ ${pair.person2_nickname}`);
            });
        }
        
        const voteResponse = await fetch(`${baseURL}/api/admin/votes/stats?accessCode=0000&adminPassword=qwer1234`);
        const voteData = await voteResponse.json();
        const voteStats = voteData.stats;
        
        console.log(`\n=== 투표 통계 ===`);
        console.log(`전체 투표수: ${voteStats.totalVotes}표`);
        console.log(`투표한 사람: ${voteStats.totalVoters}명`);
        console.log(`득표한 사람: ${voteStats.totalVotees}명`);
        
        if (voteStats.topVotees && voteStats.topVotees.length > 0) {
            console.log('\nTOP 10 득표자:');
            voteStats.topVotees.slice(0, 10).forEach((votee, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}위`;
                console.log(`  ${medal} ${votee.nickname} (${votee.gender === 'male' ? '남' : '여'}, ${votee.mbti}): ${votee.vote_count}표`);
            });
        }
        
    } catch (error) {
        console.log('❌ 통계 조회 실패:', error.message);
    }
}

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 YEONBAM SEASON 2 AI - 테스트 데이터 생성 시작 (48명)');
    console.log('='.repeat(60) + '\n');
    
    try {
        await createParticipants();
        await assignTeams();
        await sendRandomMessages();
        await sendRandomVotes();
        await showStatistics();
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ 모든 테스트 데이터 생성 완료!');
        console.log('='.repeat(60) + '\n');
        
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
    }
}

main();
