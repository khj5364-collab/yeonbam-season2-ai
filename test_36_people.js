// 36명 테스트 (남18, 여18) - 6팀 × 6명 (남3, 여3)

const participants = [];

// 남성 18명 생성 (E 9명, I 9명)
const maleEMbtis = ['ENFP', 'ENTP', 'ESFP', 'ESTP', 'ENFJ', 'ENTJ', 'ESFJ', 'ESTJ', 'ENFP'];
const maleIMbtis = ['INFP', 'INTP', 'ISFP', 'ISTP', 'INFJ', 'INTJ', 'ISFJ', 'ISTJ', 'INFP'];

for (let i = 0; i < 9; i++) {
  participants.push({
    id: i * 2 + 1,
    nickname: `남성${i * 2 + 1}`,
    gender: 'male',
    mbti: maleEMbtis[i],
    old_team_number: null
  });
  participants.push({
    id: i * 2 + 2,
    nickname: `남성${i * 2 + 2}`,
    gender: 'male',
    mbti: maleIMbtis[i],
    old_team_number: null
  });
}

// 여성 18명 생성 (E 9명, I 9명)
const femaleEMbtis = ['ENFP', 'ENTP', 'ESFP', 'ESTP', 'ENFJ', 'ENTJ', 'ESFJ', 'ESTJ', 'ENFP'];
const femaleIMbtis = ['INFP', 'INTP', 'ISFP', 'ISTP', 'INFJ', 'INTJ', 'ISFJ', 'ISTJ', 'INFP'];

for (let i = 0; i < 9; i++) {
  participants.push({
    id: 20 + i * 2 + 1,
    nickname: `여성${i * 2 + 1}`,
    gender: 'female',
    mbti: femaleEMbtis[i],
    old_team_number: null
  });
  participants.push({
    id: 20 + i * 2 + 2,
    nickname: `여성${i * 2 + 2}`,
    gender: 'female',
    mbti: femaleIMbtis[i],
    old_team_number: null
  });
}

console.log('=== 테스트 데이터 ===');
console.log(`총 인원: ${participants.length}명`);
const maleCount = participants.filter(p => p.gender === 'male').length;
const femaleCount = participants.filter(p => p.gender === 'female').length;
console.log(`남성: ${maleCount}명`);
console.log(`여성: ${femaleCount}명`);

const eCount = participants.filter(p => p.mbti.startsWith('E')).length;
const iCount = participants.filter(p => p.mbti.startsWith('I')).length;
console.log(`E 타입: ${eCount}명, I 타입: ${iCount}명`);

const maleE = participants.filter(p => p.gender === 'male' && p.mbti.startsWith('E')).length;
const maleI = participants.filter(p => p.gender === 'male' && p.mbti.startsWith('I')).length;
const femaleE = participants.filter(p => p.gender === 'female' && p.mbti.startsWith('E')).length;
const femaleI = participants.filter(p => p.gender === 'female' && p.mbti.startsWith('I')).length;
console.log(`\n남성: E ${maleE}명, I ${maleI}명`);
console.log(`여성: E ${femaleE}명, I ${femaleI}명`);

// 팀 배정 시뮬레이션
const shuffle = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const maleEList = shuffle(participants.filter(p => p.gender === 'male' && p.mbti.startsWith('E')));
const maleIList = shuffle(participants.filter(p => p.gender === 'male' && p.mbti.startsWith('I')));
const femaleEList = shuffle(participants.filter(p => p.gender === 'female' && p.mbti.startsWith('E')));
const femaleIList = shuffle(participants.filter(p => p.gender === 'female' && p.mbti.startsWith('I')));

const teamAssignments = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
const teamICounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

const maxTeamSize = 6;
const baseSize = Math.floor(participants.length / 6);
const extraMembers = participants.length % 6;
const teamSizeLimits = {};

for (let t = 1; t <= 6; t++) {
  teamSizeLimits[t] = t <= extraMembers ? baseSize + 1 : baseSize;
}

console.log('\n=== 팀 배정 시작 ===');
console.log(`\n팀당 목표 인원: baseSize=${baseSize}, extraMembers=${extraMembers}`);
for (let t = 1; t <= 6; t++) {
  console.log(`Team ${t}: ${teamSizeLimits[t]}명`);
}

// 성비 균형 체크
const checkGenderBalance = (team, newPerson) => {
  const males = team.filter(p => p.gender === 'male').length + (newPerson.gender === 'male' ? 1 : 0);
  const females = team.filter(p => p.gender === 'female').length + (newPerson.gender === 'female' ? 1 : 0);
  
  // 남성이 여성보다 2명 이상 많으면 차단
  if (males - females >= 2) {
    return false;
  }
  
  return true;
};

// 배정 함수
const assignToTeam = (person, preferMbtiBalance) => {
  const isIntrovert = person.mbti.startsWith('I');
  let bestTeam = 1;
  let bestScore = -1;

  for (let t = 1; t <= 6; t++) {
    if (teamAssignments[t].length >= teamSizeLimits[t]) {
      continue;
    }

    if (!checkGenderBalance(teamAssignments[t], person)) {
      continue;
    }

    let score = 0;
    const remainingSlots = teamSizeLimits[t] - teamAssignments[t].length;
    score += remainingSlots * 2000;

    if (preferMbtiBalance) {
      if (isIntrovert) {
        score += (1000 - teamICounts[t] * 100);
      } else {
        score += (teamICounts[t] * 100);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestTeam = t;
    }
  }

  if (bestScore === -1) {
    // 성비 제약은 반드시 지키면서 인원이 적은 팀 찾기
    let minSize = 100;
    for (let t = 1; t <= 6; t++) {
      if (teamAssignments[t].length < teamSizeLimits[t] && checkGenderBalance(teamAssignments[t], person)) {
        if (teamAssignments[t].length < minSize) {
          minSize = teamAssignments[t].length;
          bestTeam = t;
        }
      }
    }
    
    // 성비 제약을 만족하는 팀이 없으면, 이전 팀원 겹침만 무시하고 재시도
    if (minSize === 100) {
      for (let t = 1; t <= 6; t++) {
        // 팀 크기와 성비 제약은 반드시 지킴
        if (teamAssignments[t].length < teamSizeLimits[t] && checkGenderBalance(teamAssignments[t], person)) {
          minSize = teamAssignments[t].length;
          bestTeam = t;
          break;
        }
      }
    }
  }

  teamAssignments[bestTeam].push(person);
  if (isIntrovert) {
    teamICounts[bestTeam]++;
  }
};

// 성비 균형을 위해 성별 교차 배정
// I 타입 먼저, 남/여 교차로 배정
const maxILength = Math.max(maleIList.length, femaleIList.length);
for (let i = 0; i < maxILength; i++) {
  if (i < maleIList.length) assignToTeam(maleIList[i], true);
  if (i < femaleIList.length) assignToTeam(femaleIList[i], true);
}

// E 타입도 남/여 교차로 배정
const maxELength = Math.max(maleEList.length, femaleEList.length);
for (let i = 0; i < maxELength; i++) {
  if (i < maleEList.length) assignToTeam(maleEList[i], true);
  if (i < femaleEList.length) assignToTeam(femaleEList[i], true);
}

// 결과 출력
console.log('\n=== 팀 배정 결과 ===\n');

for (let t = 1; t <= 6; t++) {
  const team = teamAssignments[t];
  const males = team.filter(p => p.gender === 'male').length;
  const females = team.filter(p => p.gender === 'female').length;
  const eTypes = team.filter(p => p.mbti.startsWith('E')).length;
  const iTypes = team.filter(p => p.mbti.startsWith('I')).length;
  
  console.log(`Team ${t}: ${team.length}명`);
  console.log(`  성별: 남 ${males}명, 여 ${females}명 (차이: ${Math.abs(males - females)})`);
  console.log(`  MBTI: E ${eTypes}명, I ${iTypes}명`);
  
  // 성비 균형 체크
  if (Math.abs(males - females) === 0) {
    console.log(`  ✅ 성비 균형 유지`);
  } else if (males - females >= 2) {
    console.log(`  ❌ 남성 과다! (남${males} 여${females})`);
  } else {
    console.log(`  ⚠️  성비 불균형 발생!`);
  }
  
  console.log(`  멤버: ${team.map(p => `${p.nickname}(${p.mbti})`).join(', ')}`);
  console.log('');
}

// 전체 통계
const totalAssigned = Object.values(teamAssignments).flat().length;
const totalMales = Object.values(teamAssignments).flat().filter(p => p.gender === 'male').length;
const totalFemales = Object.values(teamAssignments).flat().filter(p => p.gender === 'female').length;
const balancedTeams = Object.values(teamAssignments).filter(team => {
  const m = team.filter(p => p.gender === 'male').length;
  const f = team.filter(p => p.gender === 'female').length;
  return Math.abs(m - f) < 2; // 차이 1명 이하
}).length;
const teamSizes = Object.values(teamAssignments).map(t => t.length);
const maxDiff = Math.max(...teamSizes) - Math.min(...teamSizes);

console.log('=== 전체 통계 ===');
console.log(`배정된 인원: ${totalAssigned}명 / ${participants.length}명`);
console.log(`남성: ${totalMales}명, 여성: ${totalFemales}명`);
console.log(`성비 균형 팀: ${balancedTeams}/6`);
console.log(`팀 크기 차이: ${maxDiff}명`);
