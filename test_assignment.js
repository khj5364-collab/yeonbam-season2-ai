// 48명 테스트 데이터 생성 (남 22명, 여 26명)
const participants = [];
let id = 1;

// MBTI 유형 배열
const mbtiTypes = ['ENFP', 'ENFJ', 'ENTP', 'ENTJ', 'ESFP', 'ESFJ', 'ESTP', 'ESTJ',
                   'INFP', 'INFJ', 'INTP', 'INTJ', 'ISFP', 'ISFJ', 'ISTP', 'ISTJ'];

// 남성 22명 생성
for (let i = 1; i <= 22; i++) {
  participants.push({
    id: id++,
    nickname: `남성${i}`,
    gender: 'male',
    mbti: mbtiTypes[Math.floor(Math.random() * mbtiTypes.length)],
    old_team_number: null
  });
}

// 여성 26명 생성
for (let i = 1; i <= 26; i++) {
  participants.push({
    id: id++,
    nickname: `여성${i}`,
    gender: 'female',
    mbti: mbtiTypes[Math.floor(Math.random() * mbtiTypes.length)],
    old_team_number: null
  });
}

console.log('=== 테스트 데이터 ===');
console.log(`총 인원: ${participants.length}명`);
console.log(`남성: ${participants.filter(p => p.gender === 'male').length}명`);
console.log(`여성: ${participants.filter(p => p.gender === 'female').length}명`);

const eCount = participants.filter(p => p.mbti.startsWith('E')).length;
const iCount = participants.filter(p => p.mbti.startsWith('I')).length;
console.log(`E 타입: ${eCount}명, I 타입: ${iCount}명`);

// 성별별 MBTI 분포
const maleE = participants.filter(p => p.gender === 'male' && p.mbti.startsWith('E')).length;
const maleI = participants.filter(p => p.gender === 'male' && p.mbti.startsWith('I')).length;
const femaleE = participants.filter(p => p.gender === 'female' && p.mbti.startsWith('E')).length;
const femaleI = participants.filter(p => p.gender === 'female' && p.mbti.startsWith('I')).length;

console.log(`\n남성: E ${maleE}명, I ${maleI}명`);
console.log(`여성: E ${femaleE}명, I ${femaleI}명`);

// 팀 배정 시뮬레이션
console.log('\n=== 팀 배정 시작 ===');

const shuffle = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// 성별과 MBTI로 분류
const maleEList = shuffle(participants.filter(p => p.gender === 'male' && p.mbti.startsWith('E')));
const maleIList = shuffle(participants.filter(p => p.gender === 'male' && p.mbti.startsWith('I')));
const femaleEList = shuffle(participants.filter(p => p.gender === 'female' && p.mbti.startsWith('E')));
const femaleIList = shuffle(participants.filter(p => p.gender === 'female' && p.mbti.startsWith('I')));

// 팀 배정
const teamAssignments = {
  1: [], 2: [], 3: [], 4: [], 5: [], 6: []
};

const teamICounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

// 팀당 목표 인원
const baseSize = Math.floor(participants.length / 6);
const extraMembers = participants.length % 6;
const teamSizeLimits = {};

for (let t = 1; t <= 6; t++) {
  teamSizeLimits[t] = t <= extraMembers ? baseSize + 1 : baseSize;
}

console.log(`\n팀당 목표 인원: baseSize=${baseSize}, extraMembers=${extraMembers}`);
for (let t = 1; t <= 6; t++) {
  console.log(`Team ${t}: ${teamSizeLimits[t]}명`);
}

// 성비 균형 체크
const checkGenderBalance = (team, newPerson) => {
  const maleCount = team.filter(p => p.gender === 'male').length + (newPerson.gender === 'male' ? 1 : 0);
  const femaleCount = team.filter(p => p.gender === 'female').length + (newPerson.gender === 'female' ? 1 : 0);
  
  if (maleCount - femaleCount >= 2) return false;
  if (femaleCount - maleCount >= 2) return false;
  
  return true;
};

// 배정 함수
const assignToTeam = (person) => {
  const isIntrovert = person.mbti.startsWith('I');
  let bestTeam = 1;
  let bestScore = -1;

  for (let t = 1; t <= 6; t++) {
    if (teamAssignments[t].length >= teamSizeLimits[t]) continue;
    if (!checkGenderBalance(teamAssignments[t], person)) continue;

    let score = 0;
    const remainingSlots = teamSizeLimits[t] - teamAssignments[t].length;
    score += remainingSlots * 2000;

    if (isIntrovert) {
      score += (1000 - teamICounts[t] * 100);
    } else {
      score += (teamICounts[t] * 100);
    }

    if (score > bestScore) {
      bestScore = score;
      bestTeam = t;
    }
  }

  if (bestScore === -1) {
    let minSize = 100;
    for (let t = 1; t <= 6; t++) {
      if (teamAssignments[t].length < teamSizeLimits[t] && checkGenderBalance(teamAssignments[t], person)) {
        if (teamAssignments[t].length < minSize) {
          minSize = teamAssignments[t].length;
          bestTeam = t;
        }
      }
    }
    
    if (minSize === 100) {
      for (let t = 1; t <= 6; t++) {
        if (teamAssignments[t].length < minSize) {
          minSize = teamAssignments[t].length;
          bestTeam = t;
        }
      }
    }
  }

  teamAssignments[bestTeam].push(person);
  if (isIntrovert) {
    teamICounts[bestTeam]++;
  }
};

// I 타입 먼저 배정
const allI = [...maleIList, ...femaleIList];
allI.forEach(person => assignToTeam(person));

// E 타입 배정
const allE = [...maleEList, ...femaleEList];
allE.forEach(person => assignToTeam(person));

// 결과 출력
console.log('\n=== 팀 배정 결과 ===\n');

for (let t = 1; t <= 6; t++) {
  const team = teamAssignments[t];
  const males = team.filter(p => p.gender === 'male').length;
  const females = team.filter(p => p.gender === 'female').length;
  const eCount = team.filter(p => p.mbti.startsWith('E')).length;
  const iCount = team.filter(p => p.mbti.startsWith('I')).length;
  const genderDiff = Math.abs(males - females);
  
  console.log(`Team ${t}: ${team.length}명`);
  console.log(`  성별: 남 ${males}명, 여 ${females}명 (차이: ${genderDiff})`);
  console.log(`  MBTI: E ${eCount}명, I ${iCount}명`);
  
  // 성비 체크
  if (genderDiff >= 2) {
    console.log(`  ⚠️  성비 불균형 발생!`);
  } else {
    console.log(`  ✅ 성비 균형 유지`);
  }
  
  // 멤버 목록 (닉네임과 MBTI)
  console.log(`  멤버: ${team.map(p => `${p.nickname}(${p.mbti})`).join(', ')}`);
  console.log('');
}

// 전체 통계
console.log('=== 전체 통계 ===');
let totalAssigned = 0;
let totalMales = 0;
let totalFemales = 0;
let balancedTeams = 0;

for (let t = 1; t <= 6; t++) {
  const team = teamAssignments[t];
  totalAssigned += team.length;
  const males = team.filter(p => p.gender === 'male').length;
  const females = team.filter(p => p.gender === 'female').length;
  totalMales += males;
  totalFemales += females;
  
  if (Math.abs(males - females) < 2) {
    balancedTeams++;
  }
}

console.log(`배정된 인원: ${totalAssigned}명 / ${participants.length}명`);
console.log(`남성: ${totalMales}명, 여성: ${totalFemales}명`);
console.log(`성비 균형 팀: ${balancedTeams}/6`);
console.log(`팀 크기 차이: ${Math.max(...Object.values(teamAssignments).map(t => t.length)) - Math.min(...Object.values(teamAssignments).map(t => t.length))}명`);
