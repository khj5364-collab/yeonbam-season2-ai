import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './' }))

// ============================================
// API Routes
// ============================================

// 1. 입장 코드 검증 API
app.post('/api/verify-code', async (c) => {
  try {
    const { code } = await c.req.json()
    
    if (!code) {
      return c.json({ success: false, message: '코드를 입력해주세요.' }, 400)
    }

    const result = await c.env.DB.prepare(`
      SELECT * FROM daily_codes 
      WHERE code = ? AND valid_date = date('now') AND is_active = 1
    `).bind(code).first()

    if (!result) {
      return c.json({ success: false, message: '유효하지 않은 코드입니다.' }, 400)
    }

    return c.json({ success: true, message: '입장 코드가 확인되었습니다.', code })
  } catch (error) {
    console.error('Error verifying code:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 2. 닉네임 중복 확인 API
app.post('/api/check-nickname', async (c) => {
  try {
    const { nickname } = await c.req.json()
    
    if (!nickname || nickname.trim().length === 0) {
      return c.json({ success: false, message: '닉네임을 입력해주세요.' }, 400)
    }

    const result = await c.env.DB.prepare(`
      SELECT id FROM participants WHERE nickname = ?
    `).bind(nickname.trim()).first()

    if (result) {
      return c.json({ success: false, message: '이미 사용중인 닉네임입니다.' }, 400)
    }

    return c.json({ success: true, message: '사용 가능한 닉네임입니다.' })
  } catch (error) {
    console.error('Error checking nickname:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 3. 설문 질문 조회 API
app.get('/api/survey-questions', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM survey_questions ORDER BY question_order
    `).all()

    return c.json({ success: true, questions: results })
  } catch (error) {
    console.error('Error fetching questions:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 4. 참가자 등록 및 팀 배정 API
app.post('/api/register', async (c) => {
  try {
    const { nickname, gender, accessCode, mbti, teamNumber } = await c.req.json()

    // 입력값 검증
    if (!nickname || !gender || !accessCode || !mbti) {
      return c.json({ success: false, message: '모든 정보를 입력해주세요.' }, 400)
    }

    if (!['male', 'female'].includes(gender)) {
      return c.json({ success: false, message: '성별 정보가 올바르지 않습니다.' }, 400)
    }

    // MBTI 유효성 검사
    if (mbti.length !== 4 || !/^[A-Z]{4}$/.test(mbti)) {
      return c.json({ success: false, message: 'MBTI 형식이 올바르지 않습니다.' }, 400)
    }

    // 팀 번호 유효성 검사 (선택사항)
    if (teamNumber !== null && teamNumber !== undefined) {
      if (![1, 2, 3, 4, 5, 6].includes(teamNumber)) {
        return c.json({ success: false, message: '팀 번호는 1~6 사이여야 합니다.' }, 400)
      }
    }

    // 닉네임 중복 체크
    const existingNickname = await c.env.DB.prepare(`
      SELECT id FROM participants WHERE nickname = ?
    `).bind(nickname).first()

    if (existingNickname) {
      return c.json({ success: false, message: '이미 사용중인 닉네임입니다.' }, 400)
    }

    // 참가자 등록 (팀 번호를 직접 입력하거나 NULL)
    const finalTeamNumber = teamNumber !== null && teamNumber !== undefined ? teamNumber : null
    
    const insertResult = await c.env.DB.prepare(`
      INSERT INTO participants (nickname, gender, access_code, team_number, mbti)
      VALUES (?, ?, ?, ?, ?)
    `).bind(nickname, gender, accessCode, finalTeamNumber, mbti).run()

    const participantId = insertResult.meta.last_row_id

    // 팀이 배정된 경우 teams 테이블 업데이트
    if (finalTeamNumber) {
      const genderColumn = gender === 'male' ? 'male_count' : 'female_count'
      await c.env.DB.prepare(`
        UPDATE teams 
        SET ${genderColumn} = ${genderColumn} + 1,
            total_count = total_count + 1
        WHERE team_number = ?
      `).bind(finalTeamNumber).run()
    }

    const message = finalTeamNumber 
      ? `등록이 완료되었습니다! Team ${finalTeamNumber}에 배정되었습니다.`
      : '등록이 완료되었습니다! 관리자가 팀을 배정할 때까지 기다려주세요.'

    return c.json({ 
      success: true, 
      message,
      teamNumber: finalTeamNumber,
      participantId 
    })
  } catch (error) {
    console.error('Error registering participant:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 5. 팀 정보 조회 API
app.get('/api/teams', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT team_number, male_count, female_count, total_count 
      FROM teams 
      ORDER BY team_number
    `).all()

    return c.json({ success: true, teams: results })
  } catch (error) {
    console.error('Error fetching teams:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 6. 특정 팀 멤버 조회 API
app.get('/api/team/:teamNumber', async (c) => {
  try {
    const teamNumber = c.req.param('teamNumber')
    
    const { results } = await c.env.DB.prepare(`
      SELECT id, nickname, gender, created_at 
      FROM participants 
      WHERE team_number = ?
      ORDER BY created_at
    `).bind(teamNumber).all()

    return c.json({ success: true, members: results })
  } catch (error) {
    console.error('Error fetching team members:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 6-1. 재입장자 확인 API
app.post('/api/reentry-check', async (c) => {
  try {
    const { code, nickname } = await c.req.json()
    
    if (!code || !nickname) {
      return c.json({ success: false, message: '코드와 닉네임을 입력해주세요.' }, 400)
    }

    // 코드 유효성 확인
    const validCode = await c.env.DB.prepare(`
      SELECT * FROM daily_codes 
      WHERE code = ? AND valid_date = date('now') AND is_active = 1
    `).bind(code).first()

    if (!validCode) {
      return c.json({ success: false, message: '유효하지 않은 코드입니다.' }, 400)
    }

    // 참가자 확인
    const participant = await c.env.DB.prepare(`
      SELECT id, nickname, gender, team_number, access_code, created_at
      FROM participants 
      WHERE nickname = ? AND access_code = ?
    `).bind(nickname, code).first()

    if (!participant) {
      return c.json({ success: false, message: '해당 닉네임으로 등록된 참가자를 찾을 수 없습니다.' }, 404)
    }

    return c.json({ 
      success: true, 
      message: '재입장이 확인되었습니다.', 
      participant: {
        nickname: participant.nickname,
        teamNumber: participant.team_number
      }
    })
  } catch (error) {
    console.error('Error checking reentry:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 7. 관리자 - 일일 코드 생성 API
app.post('/api/admin/generate-code', async (c) => {
  try {
    const { code, validDate, adminPassword } = await c.req.json()
    
    // 간단한 관리자 비밀번호 검증 (실제 환경에서는 더 강력한 인증 필요)
    if (adminPassword !== 'qwer1234') {
      return c.json({ success: false, message: '관리자 권한이 없습니다.' }, 403)
    }

    if (!code || !validDate) {
      return c.json({ success: false, message: '코드와 날짜를 입력해주세요.' }, 400)
    }

    // 중복 코드 확인
    const existing = await c.env.DB.prepare(`
      SELECT id FROM daily_codes WHERE code = ?
    `).bind(code).first()

    if (existing) {
      return c.json({ success: false, message: '이미 존재하는 코드입니다.' }, 400)
    }

    // 새 코드 생성 (기본적으로 비활성 상태로 생성)
    await c.env.DB.prepare(`
      INSERT INTO daily_codes (code, valid_date, is_active)
      VALUES (?, ?, 0)
    `).bind(code, validDate).run()

    return c.json({ success: true, message: '일일 코드가 생성되었습니다.', code, validDate })
  } catch (error) {
    console.error('Error generating code:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 7-1. 관리자 - 코드 활성화/비활성화 API
app.post('/api/admin/toggle-code', async (c) => {
  try {
    const { code, adminPassword } = await c.req.json()
    
    if (adminPassword !== 'qwer1234') {
      return c.json({ success: false, message: '관리자 권한이 없습니다.' }, 403)
    }

    if (!code) {
      return c.json({ success: false, message: '코드를 입력해주세요.' }, 400)
    }

    // 현재 상태 조회
    const current = await c.env.DB.prepare(`
      SELECT is_active FROM daily_codes WHERE code = ?
    `).bind(code).first()

    if (!current) {
      return c.json({ success: false, message: '코드를 찾을 수 없습니다.' }, 404)
    }

    // 상태 토글
    const newStatus = current.is_active === 1 ? 0 : 1
    await c.env.DB.prepare(`
      UPDATE daily_codes SET is_active = ? WHERE code = ?
    `).bind(newStatus, code).run()

    return c.json({ 
      success: true, 
      message: newStatus === 1 ? '코드가 활성화되었습니다.' : '코드가 비활성화되었습니다.',
      code,
      isActive: newStatus
    })
  } catch (error) {
    console.error('Error toggling code:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 7-2. 관리자 - 코드 삭제 API
app.post('/api/admin/delete-code', async (c) => {
  try {
    const { code, adminPassword } = await c.req.json()
    
    if (adminPassword !== 'qwer1234') {
      return c.json({ success: false, message: '관리자 권한이 없습니다.' }, 403)
    }

    if (!code) {
      return c.json({ success: false, message: '코드를 입력해주세요.' }, 400)
    }

    // 참가자가 있는지 확인
    const participantCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM participants WHERE access_code = ?
    `).bind(code).first()

    // 참가자가 있으면 함께 삭제
    if (participantCount && participantCount.count > 0) {
      // 설문 응답 삭제 (있을 경우)
      await c.env.DB.prepare(`
        DELETE FROM survey_responses 
        WHERE participant_id IN (
          SELECT id FROM participants WHERE access_code = ?
        )
      `).bind(code).run()

      // 참가자 삭제
      await c.env.DB.prepare(`
        DELETE FROM participants WHERE access_code = ?
      `).bind(code).run()
    }

    // 코드 삭제
    await c.env.DB.prepare(`
      DELETE FROM daily_codes WHERE code = ?
    `).bind(code).run()

    const message = participantCount && participantCount.count > 0 
      ? `코드 '${code}'와 ${participantCount.count}명의 참가자 정보가 삭제되었습니다.`
      : `코드 '${code}'가 삭제되었습니다.`
    
    return c.json({ success: true, message, code, deletedParticipants: participantCount?.count || 0 })
  } catch (error) {
    console.error('Error deleting code:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 8. 관리자 - 팀 설정 조회 API
app.get('/api/admin/team-settings', async (c) => {
  try {
    const settings = await c.env.DB.prepare(`
      SELECT max_team_size FROM team_settings WHERE id = 1
    `).first()

    return c.json({ 
      success: true, 
      maxTeamSize: settings?.max_team_size || 8 
    })
  } catch (error) {
    console.error('Error fetching team settings:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 8-1. 관리자 - 팀 설정 업데이트 API
app.post('/api/admin/team-settings', async (c) => {
  try {
    const { maxTeamSize, adminPassword } = await c.req.json()
    
    if (adminPassword !== 'qwer1234') {
      return c.json({ success: false, message: '관리자 권한이 없습니다.' }, 403)
    }

    if (![6, 7, 8].includes(maxTeamSize)) {
      return c.json({ success: false, message: '팀당 인원은 6, 7, 8명 중 선택해주세요.' }, 400)
    }

    await c.env.DB.prepare(`
      UPDATE team_settings 
      SET max_team_size = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).bind(maxTeamSize).run()

    return c.json({ 
      success: true, 
      message: `팀당 최대 인원이 ${maxTeamSize}명으로 설정되었습니다.`,
      maxTeamSize 
    })
  } catch (error) {
    console.error('Error updating team settings:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 9. 관리자 - 통계 조회 API
app.get('/api/admin/stats', async (c) => {
  try {
    const statsCode = c.req.query('statsCode') || '';
    const teamStatsCode = c.req.query('teamStatsCode') || '';
    
    // 현황 통계 (참가자 수)
    let totalParticipants, maleCount, femaleCount;
    
    if (statsCode) {
      // 특정 코드의 참가자만
      totalParticipants = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM participants WHERE access_code = ?
      `).bind(statsCode).first()

      maleCount = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM participants WHERE access_code = ? AND gender = 'male'
      `).bind(statsCode).first()

      femaleCount = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM participants WHERE access_code = ? AND gender = 'female'
      `).bind(statsCode).first()
    } else {
      // 전체 코드의 참가자
      totalParticipants = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM participants
      `).first()

      maleCount = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM participants WHERE gender = 'male'
      `).first()

      femaleCount = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM participants WHERE gender = 'female'
      `).first()
    }

    // 팀별 통계
    let teams;
    
    if (teamStatsCode) {
      // 특정 코드의 팀별 참가자 수 계산
      const { results: teamData } = await c.env.DB.prepare(`
        SELECT 
          team_number,
          COUNT(*) as total_count,
          SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) as male_count,
          SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) as female_count
        FROM participants 
        WHERE access_code = ? AND team_number IS NOT NULL
        GROUP BY team_number
        ORDER BY team_number
      `).bind(teamStatsCode).all()
      
      // 6개 팀 모두 표시 (참가자가 없으면 0으로)
      teams = [];
      for (let i = 1; i <= 6; i++) {
        const teamInfo = teamData.find(t => t.team_number === i);
        teams.push({
          team_number: i,
          total_count: teamInfo?.total_count || 0,
          male_count: teamInfo?.male_count || 0,
          female_count: teamInfo?.female_count || 0
        });
      }
    } else {
      // 전체 코드의 팀별 통계 (기존 teams 테이블 사용)
      const teamsResult = await c.env.DB.prepare(`
        SELECT team_number, male_count, female_count, total_count 
        FROM teams 
        ORDER BY team_number
      `).all()
      teams = teamsResult.results;
    }

    return c.json({
      success: true,
      stats: {
        total: totalParticipants?.count || 0,
        male: maleCount?.count || 0,
        female: femaleCount?.count || 0,
        teams: teams
      }
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 10. 관리자 - 팀 랜덤 배정 API (모든 참가자 재배정)
app.post('/api/admin/assign-teams', async (c) => {
  try {
    const { code, adminPassword } = await c.req.json()
    
    if (adminPassword !== 'qwer1234') {
      return c.json({ success: false, message: '관리자 권한이 없습니다.' }, 403)
    }

    if (!code) {
      return c.json({ success: false, message: '코드를 입력해주세요.' }, 400)
    }

    // 팀 설정 조회
    const settings = await c.env.DB.prepare(`
      SELECT max_team_size FROM team_settings WHERE id = 1
    `).first()
    const maxTeamSize = settings?.max_team_size || 8

    // 해당 코드의 모든 참가자 조회 (이전 팀 번호 포함)
    const { results: participants } = await c.env.DB.prepare(`
      SELECT id, nickname, gender, mbti, team_number as old_team_number
      FROM participants 
      WHERE access_code = ?
      ORDER BY created_at
    `).bind(code).all()

    if (participants.length === 0) {
      return c.json({ success: false, message: '해당 코드로 등록된 참가자가 없습니다.' }, 400)
    }

    // 참가자 수 검증
    const requiredTeams = Math.ceil(participants.length / maxTeamSize)
    if (requiredTeams > 6) {
      return c.json({ 
        success: false, 
        message: `참가자가 ${participants.length}명으로 팀당 ${maxTeamSize}명 기준 ${requiredTeams}개 팀이 필요합니다. 최대 6개 팀까지만 지원됩니다.` 
      }, 400)
    }

    // 이전 팀별로 그룹화 (이전 팀원 추적용)
    const oldTeamGroups: any = {}
    participants.forEach((p: any) => {
      if (p.old_team_number) {
        if (!oldTeamGroups[p.old_team_number]) {
          oldTeamGroups[p.old_team_number] = []
        }
        oldTeamGroups[p.old_team_number].push(p.id)
      }
    })

    // 기존 팀 카운트 초기화
    await c.env.DB.prepare(`
      UPDATE teams 
      SET male_count = 0, female_count = 0, total_count = 0
    `).run()

    // 랜덤 셔플 함수
    const shuffle = (array: any[]) => {
      const shuffled = [...array]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      return shuffled
    }

    // 이전 팀원이 3명 이상 겹치는지 확인하는 함수
    const countOldTeammates = (newTeamMembers: any[], personOldTeam: number) => {
      if (!personOldTeam || !oldTeamGroups[personOldTeam]) return 0
      const oldTeammateIds = oldTeamGroups[personOldTeam]
      return newTeamMembers.filter((m: any) => 
        oldTeammateIds.includes(m.id) && m.id !== newTeamMembers[newTeamMembers.length - 1]?.id
      ).length
    }

    // 성별과 MBTI E/I로 분류
    const maleE = shuffle(participants.filter((p: any) => p.gender === 'male' && p.mbti?.toUpperCase().startsWith('E')))
    const maleI = shuffle(participants.filter((p: any) => p.gender === 'male' && p.mbti?.toUpperCase().startsWith('I')))
    const femaleE = shuffle(participants.filter((p: any) => p.gender === 'female' && p.mbti?.toUpperCase().startsWith('E')))
    const femaleI = shuffle(participants.filter((p: any) => p.gender === 'female' && p.mbti?.toUpperCase().startsWith('I')))

    // 6팀에 배정
    const teamAssignments: any = {
      1: [], 2: [], 3: [], 4: [], 5: [], 6: []
    }

    // 각 팀의 I 카운트 추적
    const teamICounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }

    // 팀당 목표 인원 계산 (균등 분배)
    const baseSize = Math.floor(participants.length / 6)  // 기본 인원
    const extraMembers = participants.length % 6          // 추가로 1명씩 들어갈 팀 수
    const teamSizeLimits: any = {}
    
    for (let t = 1; t <= 6; t++) {
      // 처음 extraMembers개 팀은 baseSize + 1명, 나머지는 baseSize명
      teamSizeLimits[t] = t <= extraMembers ? baseSize + 1 : baseSize
    }

    // 성비 균형 체크 함수
    // 기본 팀 구성: 6명 (남3, 여3)
    // 차단: 남4여2 (남성이 2명 이상 많음)
    // 허용: 남3여3, 남2여4 (여성이 많은 것은 허용)
    const checkGenderBalance = (team: any[], newPerson: any) => {
      const maleCount = team.filter((p: any) => p.gender === 'male').length + (newPerson.gender === 'male' ? 1 : 0)
      const femaleCount = team.filter((p: any) => p.gender === 'female').length + (newPerson.gender === 'female' ? 1 : 0)
      
      // 남성이 여성보다 2명 이상 많으면 차단
      // 예: 남4여2 ❌, 남5여3 ❌, 남3여2 ✅
      if (maleCount - femaleCount >= 2) {
        return false
      }
      
      // 여성이 많은 것은 허용
      // 예: 남2여4 ✅, 남3여3 ✅
      return true
    }

    // MBTI 우선순위 배정 함수 (성비 균형 + 이전 팀원 겹침 체크 + 인원 균등 분배)
    const assignToTeam = (person: any, preferMbtiBalance: boolean) => {
      const isIntrovert = person.mbti?.toUpperCase().startsWith('I')
      let bestTeam = 1
      let bestScore = -1

      for (let t = 1; t <= 6; t++) {
        // 팀 인원이 이미 목표치에 도달했으면 제외
        if (teamAssignments[t].length >= teamSizeLimits[t]) {
          continue
        }

        // 성비 균형 체크
        if (!checkGenderBalance(teamAssignments[t], person)) {
          continue // 성비가 불균형하면 이 팀은 제외
        }

        // 이전 팀원이 2명 이상인지 확인
        const oldTeammateCount = countOldTeammates(teamAssignments[t], person.old_team_number)
        if (oldTeammateCount >= 2) {
          continue // 이미 2명 이상이면 이 팀은 제외
        }

        let score = 0

        // 인원 균등 분배 점수 (최우선)
        const remainingSlots = teamSizeLimits[t] - teamAssignments[t].length
        score += remainingSlots * 2000  // 빈 자리가 많을수록 높은 점수

        if (preferMbtiBalance) {
          // MBTI 균형 고려
          if (isIntrovert) {
            // I는 I가 적은 팀 선호
            score += (1000 - teamICounts[t as keyof typeof teamICounts] * 100)
          } else {
            // E는 I가 많은 팀 선호
            score += (teamICounts[t as keyof typeof teamICounts] * 100)
          }
        }

        // 이전 팀원이 적을수록 보너스 점수
        score += (2 - oldTeammateCount) * 500

        if (score > bestScore) {
          bestScore = score
          bestTeam = t
        }
      }

      // 모든 적합한 팀이 없는 경우, 제약 완화하여 배정
      if (bestScore === -1) {
        // 성비 제약은 반드시 지키면서 인원이 적은 팀 찾기
        let minSize = 100
        for (let t = 1; t <= 6; t++) {
          if (teamAssignments[t].length < teamSizeLimits[t] && checkGenderBalance(teamAssignments[t], person)) {
            if (teamAssignments[t].length < minSize) {
              minSize = teamAssignments[t].length
              bestTeam = t
            }
          }
        }
        
        // 성비 제약을 만족하는 팀이 없으면, 이전 팀원 겹침만 무시하고 재시도
        if (minSize === 100) {
          for (let t = 1; t <= 6; t++) {
            // 팀 크기와 성비 제약은 반드시 지킴
            if (teamAssignments[t].length < teamSizeLimits[t] && checkGenderBalance(teamAssignments[t], person)) {
              minSize = teamAssignments[t].length
              bestTeam = t
              break
            }
          }
        }
      }

      teamAssignments[bestTeam].push(person)
      if (isIntrovert) {
        teamICounts[bestTeam as keyof typeof teamICounts]++
      }
    }

    // 성비 균형을 위해 성별 교차 배정
    // I 타입 먼저, 남/여 교차로 배정
    const maxILength = Math.max(maleI.length, femaleI.length)
    for (let i = 0; i < maxILength; i++) {
      if (i < maleI.length) assignToTeam(maleI[i], true)
      if (i < femaleI.length) assignToTeam(femaleI[i], true)
    }

    // E 타입도 남/여 교차로 배정
    const maxELength = Math.max(maleE.length, femaleE.length)
    for (let i = 0; i < maxELength; i++) {
      if (i < maleE.length) assignToTeam(maleE[i], true)
      if (i < femaleE.length) assignToTeam(femaleE[i], true)
    }

    // 데이터베이스 업데이트 - 모든 참가자의 팀 번호 새로 배정
    for (const teamNumber in teamAssignments) {
      const members = teamAssignments[teamNumber]
      for (const member of members) {
        await c.env.DB.prepare(`
          UPDATE participants 
          SET team_number = ? 
          WHERE id = ?
        `).bind(parseInt(teamNumber), member.id).run()
      }
    }

    // 팀 카운트 업데이트
    for (let i = 1; i <= 6; i++) {
      const teamMembers = teamAssignments[i]
      const maleCount = teamMembers.filter((m: any) => m.gender === 'male').length
      const femaleCount = teamMembers.filter((m: any) => m.gender === 'female').length
      
      await c.env.DB.prepare(`
        UPDATE teams 
        SET male_count = ?,
            female_count = ?,
            total_count = ?
        WHERE team_number = ?
      `).bind(maleCount, femaleCount, teamMembers.length, i).run()
    }

    // E/I 통계
    const eCount = participants.filter((p: any) => p.mbti?.toUpperCase().startsWith('E')).length
    const iCount = participants.filter((p: any) => p.mbti?.toUpperCase().startsWith('I')).length
    
    return c.json({ 
      success: true, 
      message: `${participants.length}명의 참가자가 6개 팀에 MBTI 균형을 고려하여 재배정되었습니다.`,
      assignedCount: participants.length,
      maleCount: participants.filter((p: any) => p.gender === 'male').length,
      femaleCount: participants.filter((p: any) => p.gender === 'female').length,
      eCount: eCount,
      iCount: iCount
    })
  } catch (error) {
    console.error('Error assigning teams:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 9. 관리자 - 모든 입장 코드 목록 조회 API
app.get('/api/admin/codes', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        code,
        valid_date,
        is_active,
        created_at,
        (SELECT COUNT(*) FROM participants WHERE access_code = daily_codes.code) as participant_count
      FROM daily_codes 
      ORDER BY valid_date DESC, created_at DESC
    `).all()

    return c.json({ success: true, codes: results })
  } catch (error) {
    console.error('Error fetching codes:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 10. 관리자 - 특정 코드의 참가자 목록 조회 API
app.get('/api/admin/code/:code/participants', async (c) => {
  try {
    const code = c.req.param('code')
    
    // 참가자 목록
    const { results: participants } = await c.env.DB.prepare(`
      SELECT 
        p.id,
        p.nickname,
        p.gender,
        p.mbti,
        p.team_number,
        p.created_at
      FROM participants p
      WHERE p.access_code = ?
      ORDER BY p.team_number, p.created_at
    `).bind(code).all()

    // 코드 정보
    const codeInfo = await c.env.DB.prepare(`
      SELECT code, valid_date, is_active, created_at 
      FROM daily_codes 
      WHERE code = ?
    `).bind(code).first()

    // 통계
    const maleCount = participants.filter((p: any) => p.gender === 'male').length
    const femaleCount = participants.filter((p: any) => p.gender === 'female').length

    // 팀별 통계
    const teamStats: any = {}
    participants.forEach((p: any) => {
      if (!teamStats[p.team_number]) {
        teamStats[p.team_number] = { male: 0, female: 0, total: 0 }
      }
      teamStats[p.team_number][p.gender]++
      teamStats[p.team_number].total++
    })

    return c.json({
      success: true,
      codeInfo,
      participants,
      stats: {
        total: participants.length,
        male: maleCount,
        female: femaleCount,
        teams: teamStats
      }
    })
  } catch (error) {
    console.error('Error fetching code participants:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// ============================================
// Frontend Routes
// ============================================

// 메인 페이지
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>YEONBAM SEASON 2 AI</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div class="container mx-auto px-4 py-8">
            <div class="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
                <div class="text-center mb-8">
                    <i class="fas fa-users text-indigo-600 text-6xl mb-4"></i>
                    <h1 class="text-3xl font-bold text-gray-800 mb-2">YEONBAM SEASON 2 AI</h1>
                </div>

                <!-- 신규/재입장 선택 -->
                <div id="step0" class="step">
                    <div class="mb-6">
                        <label class="block text-gray-700 font-semibold mb-4 text-center">
                            <i class="fas fa-user-plus mr-2"></i>입장 유형을 선택하세요
                        </label>
                        <div class="grid grid-cols-2 gap-4">
                            <button onclick="selectEntryType('new')" 
                                    class="entry-type-btn py-8 border-2 border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition duration-200">
                                <i class="fas fa-user-plus text-indigo-600 text-4xl mb-3"></i>
                                <div class="font-bold text-lg">신규 입장자</div>
                                <div class="text-sm text-gray-600 mt-1">처음 방문하시는 분</div>
                            </button>
                            <button onclick="selectEntryType('reentry')" 
                                    class="entry-type-btn py-8 border-2 border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition duration-200">
                                <i class="fas fa-user-check text-green-600 text-4xl mb-3"></i>
                                <div class="font-bold text-lg">재입장자</div>
                                <div class="text-sm text-gray-600 mt-1">이미 등록하신 분</div>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 신규 입장자 - 입장 코드 입력 -->
                <div id="step1-new" class="step hidden">
                    <div class="mb-6">
                        <label class="block text-gray-700 font-semibold mb-2">
                            <i class="fas fa-key mr-2"></i>입장 코드
                        </label>
                        <input type="text" id="accessCodeNew" 
                               class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none" 
                               placeholder="입장 코드를 입력하세요">
                    </div>
                    <button onclick="verifyCodeNew()" 
                            class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200">
                        <i class="fas fa-arrow-right mr-2"></i>다음
                    </button>
                    <button onclick="backToStep(0)" 
                            class="w-full mt-3 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 transition duration-200">
                        <i class="fas fa-arrow-left mr-2"></i>돌아가기
                    </button>
                </div>

                <!-- 재입장자 - 코드와 닉네임 입력 -->
                <div id="step1-reentry" class="step hidden">
                    <div class="mb-6">
                        <label class="block text-gray-700 font-semibold mb-2">
                            <i class="fas fa-key mr-2"></i>입장 코드
                        </label>
                        <input type="text" id="accessCodeReentry" 
                               class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none" 
                               placeholder="입장 코드를 입력하세요">
                    </div>
                    <div class="mb-6">
                        <label class="block text-gray-700 font-semibold mb-2">
                            <i class="fas fa-user mr-2"></i>닉네임
                        </label>
                        <input type="text" id="nicknameReentry" 
                               class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none" 
                               placeholder="등록하신 닉네임을 입력하세요">
                    </div>
                    <button onclick="verifyReentry()" 
                            class="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200">
                        <i class="fas fa-sign-in-alt mr-2"></i>재입장
                    </button>
                    <button onclick="backToStep(0)" 
                            class="w-full mt-3 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 transition duration-200">
                        <i class="fas fa-arrow-left mr-2"></i>돌아가기
                    </button>
                </div>

                <!-- 닉네임, 성별, MBTI 입력 -->
                <div id="step2" class="step hidden">
                    <div class="mb-6">
                        <label class="block text-gray-700 font-semibold mb-2">
                            <i class="fas fa-user mr-2"></i>닉네임
                        </label>
                        <input type="text" id="nickname" 
                               class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none" 
                               placeholder="사용하실 닉네임을 입력하세요">
                    </div>
                    <div class="mb-6">
                        <label class="block text-gray-700 font-semibold mb-2">
                            <i class="fas fa-venus-mars mr-2"></i>성별
                        </label>
                        <div class="flex gap-4">
                            <button onclick="selectGender('male')" 
                                    class="gender-btn flex-1 py-3 border-2 border-gray-300 rounded-lg hover:border-blue-500 transition duration-200">
                                <i class="fas fa-mars text-blue-500 text-2xl"></i>
                                <div class="mt-1 font-semibold">남성</div>
                            </button>
                            <button onclick="selectGender('female')" 
                                    class="gender-btn flex-1 py-3 border-2 border-gray-300 rounded-lg hover:border-pink-500 transition duration-200">
                                <i class="fas fa-venus text-pink-500 text-2xl"></i>
                                <div class="mt-1 font-semibold">여성</div>
                            </button>
                        </div>
                    </div>
                    <div class="mb-6">
                        <label class="block text-gray-700 font-semibold mb-2">
                            <i class="fas fa-brain mr-2"></i>MBTI
                        </label>
                        <input type="text" id="mbti" 
                               class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none uppercase" 
                               placeholder="예: ENFP, ISTJ" 
                               maxlength="4"
                               oninput="this.value = this.value.toUpperCase()">
                        <p class="text-xs text-gray-500 mt-1">
                            <i class="fas fa-info-circle mr-1"></i>4자리 MBTI 유형을 입력하세요
                        </p>
                    </div>
                    <div class="mb-6">
                        <label class="block text-gray-700 font-semibold mb-2">
                            <i class="fas fa-users mr-2"></i>팀 번호
                        </label>
                        <select id="teamNumber" 
                                class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none">
                            <option value="">팀을 선택하세요 (선택사항)</option>
                            <option value="1">Team 1</option>
                            <option value="2">Team 2</option>
                            <option value="3">Team 3</option>
                            <option value="4">Team 4</option>
                            <option value="5">Team 5</option>
                            <option value="6">Team 6</option>
                        </select>
                        <p class="text-xs text-gray-500 mt-1">
                            <i class="fas fa-info-circle mr-1"></i>처음 입장 시 팀을 지정하거나, 나중에 관리자가 배정할 수 있습니다
                        </p>
                    </div>
                    <button onclick="submitRegistration()" 
                            class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200">
                        <i class="fas fa-check mr-2"></i>등록 완료
                    </button>
                </div>



                <!-- 완료 (신규 입장자) -->
                <div id="step4-new" class="step hidden text-center">
                    <i class="fas fa-check-circle text-green-500 text-6xl mb-4"></i>
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">등록 완료!</h2>
                    <div id="newUserTeamInfo" class="mb-6">
                        <!-- 팀 정보 또는 대기 메시지가 여기 표시됨 -->
                    </div>
                    <a href="/" class="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200">
                        <i class="fas fa-home mr-2"></i>홈으로
                    </a>
                </div>

                <!-- 완료 (재입장자) -->
                <div id="step4-reentry" class="step hidden text-center">
                    <i class="fas fa-user-check text-green-500 text-6xl mb-4"></i>
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">재입장 완료!</h2>
                    <div id="reentryTeamInfo" class="bg-indigo-50 rounded-lg p-6 mb-6">
                        <!-- 팀 정보가 여기 표시됨 -->
                    </div>
                    <a href="/teams" class="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200">
                        <i class="fas fa-users mr-2"></i>전체 팀 보기
                    </a>
                </div>
            </div>

            <!-- 관리자 버튼 -->
            <div class="text-center mt-4">
                <a href="/admin" class="text-gray-600 hover:text-indigo-600 text-sm">
                    <i class="fas fa-cog mr-1"></i>관리자
                </a>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            let currentStep = 0;
            let entryType = null;
            let selectedGender = null;
            let verifiedCode = null;
            let questions = [];

            function selectEntryType(type) {
                entryType = type;
                if (type === 'new') {
                    showStep('1-new');
                } else {
                    showStep('1-reentry');
                }
            }

            function backToStep(step) {
                showStep(step);
            }

            async function verifyCodeNew() {
                const code = document.getElementById('accessCodeNew').value.trim();
                if (!code) {
                    alert('입장 코드를 입력해주세요.');
                    return;
                }

                try {
                    const response = await axios.post('/api/verify-code', { code });
                    if (response.data.success) {
                        verifiedCode = code;
                        showStep(2);
                    }
                } catch (error) {
                    alert(error.response?.data?.message || '코드 검증 실패');
                }
            }

            async function verifyReentry() {
                const code = document.getElementById('accessCodeReentry').value.trim();
                const nickname = document.getElementById('nicknameReentry').value.trim();
                
                if (!code || !nickname) {
                    alert('입장 코드와 닉네임을 모두 입력해주세요.');
                    return;
                }

                try {
                    const response = await axios.post('/api/reentry-check', { code, nickname });
                    if (response.data.success) {
                        const participant = response.data.participant;
                        const teamInfoDiv = document.getElementById('reentryTeamInfo');
                        
                        if (participant.teamNumber) {
                            teamInfoDiv.innerHTML = \`
                                <p class="text-gray-700 mb-2">환영합니다, <strong>\${participant.nickname}</strong>님!</p>
                                <p class="text-gray-700 mb-2">당신의 팀은</p>
                                <p class="text-5xl font-bold text-indigo-600">\${participant.teamNumber}</p>
                                <p class="text-gray-700 mt-2">팀 입니다</p>
                            \`;
                        } else {
                            teamInfoDiv.innerHTML = \`
                                <p class="text-gray-700 mb-2">환영합니다, <strong>\${participant.nickname}</strong>님!</p>
                                <div class="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mt-4">
                                    <i class="fas fa-clock text-yellow-600 text-3xl mb-2"></i>
                                    <p class="text-gray-800 font-semibold">팀 배정 대기중</p>
                                    <p class="text-gray-600 text-sm mt-2">관리자가 팀을 배정할 때까지 기다려주세요.</p>
                                </div>
                            \`;
                        }
                        
                        showStep('4-reentry');
                    }
                } catch (error) {
                    alert(error.response?.data?.message || '재입장 확인 실패');
                }
            }

            function selectGender(gender) {
                selectedGender = gender;
                document.querySelectorAll('.gender-btn').forEach(btn => {
                    btn.classList.remove('border-indigo-500', 'bg-indigo-50');
                });
                event.target.closest('.gender-btn').classList.add('border-indigo-500', 'bg-indigo-50');
            }

            async function submitRegistration() {
                const nickname = document.getElementById('nickname').value.trim();
                const mbti = document.getElementById('mbti').value.trim().toUpperCase();
                const teamNumber = document.getElementById('teamNumber').value;
                
                if (!nickname) {
                    alert('닉네임을 입력해주세요.');
                    return;
                }

                if (!selectedGender) {
                    alert('성별을 선택해주세요.');
                    return;
                }

                if (!mbti) {
                    alert('MBTI를 입력해주세요.');
                    return;
                }

                // MBTI 유효성 검사 (4자리 영문)
                if (mbti.length !== 4 || !/^[A-Z]{4}$/.test(mbti)) {
                    alert('올바른 MBTI 형식을 입력해주세요. (예: ENFP, ISTJ)');
                    return;
                }

                try {
                    const response = await axios.post('/api/register', {
                        nickname,
                        gender: selectedGender,
                        accessCode: verifiedCode,
                        mbti,
                        teamNumber: teamNumber ? parseInt(teamNumber) : null
                    });

                    if (response.data.success) {
                        const teamInfoDiv = document.getElementById('newUserTeamInfo');
                        
                        if (response.data.teamNumber) {
                            // 팀이 배정된 경우
                            teamInfoDiv.innerHTML = \`
                                <div class="bg-indigo-50 border-2 border-indigo-500 rounded-lg p-6">
                                    <i class="fas fa-users text-indigo-600 text-4xl mb-3"></i>
                                    <p class="text-gray-800 font-semibold mb-2">팀 배정 완료</p>
                                    <div class="bg-white rounded-lg p-4 mt-3">
                                        <p class="text-2xl font-bold text-indigo-600">Team \${response.data.teamNumber}</p>
                                    </div>
                                    <p class="text-gray-600 text-sm mt-3">재입장하면 팀원을 확인할 수 있습니다.</p>
                                </div>
                            \`;
                        } else {
                            // 팀이 배정되지 않은 경우
                            teamInfoDiv.innerHTML = \`
                                <div class="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6">
                                    <i class="fas fa-clock text-yellow-600 text-4xl mb-3"></i>
                                    <p class="text-gray-800 font-semibold mb-2">팀 배정 대기중</p>
                                    <p class="text-gray-600 text-sm">관리자가 팀을 배정할 때까지 기다려주세요.</p>
                                    <p class="text-gray-600 text-sm mt-2">배정 완료 후 재입장하면 팀 번호를 확인할 수 있습니다.</p>
                                </div>
                            \`;
                        }
                        
                        showStep('4-new');
                    }
                } catch (error) {
                    alert(error.response?.data?.message || '등록 실패');
                }
            }

            function showStep(step) {
                document.querySelectorAll('.step').forEach(el => el.classList.add('hidden'));
                document.getElementById(\`step\${step}\`).classList.remove('hidden');
                currentStep = step;
            }
        </script>
    </body>
    </html>
  `)
})

// 팀 목록 페이지
app.get('/teams', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>전체 팀 현황</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div class="container mx-auto px-4 py-8">
            <div class="max-w-4xl mx-auto">
                <div class="text-center mb-8">
                    <h1 class="text-4xl font-bold text-gray-800 mb-2">
                        <i class="fas fa-users text-indigo-600 mr-2"></i>전체 팀 현황
                    </h1>
                    <p class="text-gray-600">6개 팀의 구성원을 확인하세요</p>
                </div>

                <div id="teamsContainer" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Teams will be loaded here -->
                </div>

                <div class="text-center mt-8">
                    <a href="/" class="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200">
                        <i class="fas fa-home mr-2"></i>홈으로
                    </a>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            async function loadTeams() {
                try {
                    const response = await axios.get('/api/teams');
                    const teams = response.data.teams;
                    
                    const container = document.getElementById('teamsContainer');
                    container.innerHTML = teams.map(team => \`
                        <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition duration-200">
                            <div class="flex items-center justify-between mb-4">
                                <h2 class="text-2xl font-bold text-indigo-600">Team \${team.team_number}</h2>
                                <span class="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-semibold">
                                    \${team.total_count}명
                                </span>
                            </div>
                            <div class="flex justify-between text-sm text-gray-600">
                                <div class="flex items-center">
                                    <i class="fas fa-mars text-blue-500 mr-1"></i>
                                    남성: <span class="font-semibold ml-1">\${team.male_count}명</span>
                                </div>
                                <div class="flex items-center">
                                    <i class="fas fa-venus text-pink-500 mr-1"></i>
                                    여성: <span class="font-semibold ml-1">\${team.female_count}명</span>
                                </div>
                            </div>
                            <button onclick="viewTeamMembers(\${team.team_number})" 
                                    class="w-full mt-4 bg-indigo-50 text-indigo-600 py-2 rounded-lg font-semibold hover:bg-indigo-100 transition duration-200">
                                <i class="fas fa-list mr-2"></i>멤버 보기
                            </button>
                        </div>
                    \`).join('');
                } catch (error) {
                    alert('팀 정보를 불러오는데 실패했습니다.');
                }
            }

            async function viewTeamMembers(teamNumber) {
                try {
                    const response = await axios.get(\`/api/team/\${teamNumber}\`);
                    const members = response.data.members;
                    
                    const membersList = members.length > 0 
                        ? members.map(m => \`
                            <div class="flex items-center justify-between py-2 border-b">
                                <span class="font-semibold">\${m.nickname}</span>
                                <span class="text-sm">
                                    <i class="fas fa-\${m.gender === 'male' ? 'mars text-blue-500' : 'venus text-pink-500'}"></i>
                                </span>
                            </div>
                        \`).join('')
                        : '<p class="text-gray-500 text-center py-4">아직 멤버가 없습니다.</p>';
                    
                    alert(\`Team \${teamNumber} 멤버 목록\\n\\n\` + members.map(m => m.nickname).join(', '));
                } catch (error) {
                    alert('멤버 정보를 불러오는데 실패했습니다.');
                }
            }

            loadTeams();
        </script>
    </body>
    </html>
  `)
})

// 관리자 페이지
app.get('/admin', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>관리자 페이지</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
        <!-- 로그인 화면 -->
        <div id="loginScreen" class="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
            <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                <div class="text-center mb-8">
                    <i class="fas fa-lock text-indigo-600 text-6xl mb-4"></i>
                    <h1 class="text-3xl font-bold text-gray-800 mb-2">관리자 인증</h1>
                    <p class="text-gray-600">관리자 페이지 접근을 위해 비밀번호를 입력하세요</p>
                </div>
                <div class="mb-6">
                    <label class="block text-gray-700 font-semibold mb-2">
                        <i class="fas fa-key mr-2"></i>관리자 비밀번호
                    </label>
                    <input type="password" id="adminLoginPassword" 
                           class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none" 
                           placeholder="비밀번호를 입력하세요"
                           onkeypress="if(event.key === 'Enter') adminLogin()">
                </div>
                <button onclick="adminLogin()" 
                        class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200">
                    <i class="fas fa-sign-in-alt mr-2"></i>로그인
                </button>
                <div class="text-center mt-6">
                    <a href="/" class="text-gray-600 hover:text-indigo-600 text-sm">
                        <i class="fas fa-home mr-1"></i>홈으로 돌아가기
                    </a>
                </div>
            </div>
        </div>

        <!-- 관리자 페이지 (로그인 후 표시) -->
        <div id="adminContent" class="container mx-auto px-4 py-8 hidden">
            <div class="max-w-4xl mx-auto">
                <div class="flex items-center justify-between mb-8">
                    <h1 class="text-4xl font-bold text-gray-800">
                        <i class="fas fa-cog text-indigo-600 mr-2"></i>관리자 페이지
                    </h1>
                    <button onclick="adminLogout()" 
                            class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition duration-200">
                        <i class="fas fa-sign-out-alt mr-2"></i>로그아웃
                    </button>
                </div>

                <!-- 통계 -->
                <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-chart-bar mr-2"></i>현황 통계
                    </h2>
                    <div class="mb-4">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-filter mr-2"></i>코드 선택
                        </label>
                        <select id="statsCodeSelect" 
                                onchange="loadStats()" 
                                class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none">
                            <option value="">전체 코드</option>
                        </select>
                    </div>
                    <div id="stats" class="grid grid-cols-3 gap-4">
                        <div class="text-center p-4 bg-indigo-50 rounded-lg">
                            <div class="text-3xl font-bold text-indigo-600" id="totalCount">0</div>
                            <div class="text-sm text-gray-600">전체 참가자</div>
                        </div>
                        <div class="text-center p-4 bg-blue-50 rounded-lg">
                            <div class="text-3xl font-bold text-blue-600" id="maleCount">0</div>
                            <div class="text-sm text-gray-600">남성</div>
                        </div>
                        <div class="text-center p-4 bg-pink-50 rounded-lg">
                            <div class="text-3xl font-bold text-pink-600" id="femaleCount">0</div>
                            <div class="text-sm text-gray-600">여성</div>
                        </div>
                    </div>
                </div>

                <!-- 일일 코드 생성 -->
                <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-key mr-2"></i>일일 코드 생성
                    </h2>
                    <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                        <p class="text-sm text-blue-800">
                            <i class="fas fa-info-circle mr-2"></i>
                            새로운 코드는 <strong>비활성 상태</strong>로 생성됩니다. 
                            아래 '입장 코드별 현황'에서 활성화 버튼을 클릭하여 사용 시작하세요.
                        </p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <input type="text" id="newCode" 
                               class="px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none" 
                               placeholder="코드 (예: 0000, 1234)">
                        <input type="date" id="validDate" 
                               class="px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none">
                    </div>
                    <button onclick="generateCode()" 
                            class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200">
                        <i class="fas fa-plus mr-2"></i>코드 생성 (비활성 상태로)
                    </button>
                </div>

                <!-- 입장 코드 목록 -->
                <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-list mr-2"></i>입장 코드별 현황 및 관리
                    </h2>
                    <div class="bg-gray-50 rounded-lg p-4 mb-4 text-sm text-gray-700">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div><i class="fas fa-toggle-on text-green-500 mr-2"></i><strong>활성화:</strong> 참가자가 이 코드로 입장 가능</div>
                            <div><i class="fas fa-toggle-off text-orange-500 mr-2"></i><strong>비활성화:</strong> 참가자 입장 차단</div>
                            <div><i class="fas fa-eye text-indigo-600 mr-2"></i><strong>상세보기:</strong> 코드별 참가자 및 팀 구성 확인</div>
                            <div><i class="fas fa-trash text-red-500 mr-2"></i><strong>삭제:</strong> 코드와 해당 코드의 모든 참가자 정보 삭제</div>
                        </div>
                    </div>
                    <div id="codesList" class="space-y-3">
                        <!-- Codes will be loaded here -->
                    </div>
                </div>

                <!-- 팀 설정 -->
                <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-cog mr-2"></i>팀 설정
                    </h2>
                    <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                        <p class="text-sm text-blue-800">
                            <i class="fas fa-info-circle mr-2"></i>
                            팀당 최대 인원을 설정합니다. 기본 설정은 8명(남4, 여4)입니다.
                        </p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-gray-700 font-semibold mb-2">
                                <i class="fas fa-users mr-2"></i>팀당 최대 인원
                            </label>
                            <select id="maxTeamSizeSelect" 
                                   class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none">
                                <option value="6">6명 (남3, 여3)</option>
                                <option value="7">7명</option>
                                <option value="8" selected>8명 (남4, 여4)</option>
                            </select>
                        </div>
                        <div class="flex items-end">
                            <button onclick="updateTeamSettings()" 
                                    class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition duration-200">
                                <i class="fas fa-save mr-2"></i>설정 저장
                            </button>
                        </div>
                    </div>
                    <div id="teamSettingsResult" class="mt-4"></div>
                </div>

                <!-- 팀 랜덤 배정 -->
                <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-random mr-2"></i>팀 랜덤 배정
                    </h2>
                    <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4">
                        <p class="text-sm text-yellow-800">
                            <i class="fas fa-exclamation-triangle mr-2"></i>
                            <strong>주의:</strong> 선택한 코드의 <strong>모든 참가자</strong>를 6개 팀에 랜덤으로 <strong>재배정</strong>합니다.
                            기존 팀 배정은 초기화되고, MBTI 균형과 이전 팀원 겹침 최소화를 고려하여 새로 배정됩니다.
                        </p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-gray-700 font-semibold mb-2">
                                <i class="fas fa-key mr-2"></i>입장 코드 선택
                            </label>
                            <select id="assignCodeSelect" 
                                   class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none">
                                <option value="">코드를 선택하세요</option>
                            </select>
                        </div>
                        <div class="flex items-end">
                            <button onclick="assignTeamsRandomly()" 
                                    class="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition duration-200">
                                <i class="fas fa-random mr-2"></i>팀 랜덤 배정 실행
                            </button>
                        </div>
                    </div>
                    <div id="assignResult" class="mt-4"></div>
                </div>

                <!-- 팀별 현황 -->
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-users mr-2"></i>전체 팀별 현황
                    </h2>
                    <div class="mb-4">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-filter mr-2"></i>코드 선택
                        </label>
                        <select id="teamStatsCodeSelect" 
                                onchange="loadStats()" 
                                class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none">
                            <option value="">전체 코드</option>
                        </select>
                    </div>
                    <div id="teamStats" class="space-y-3"></div>
                </div>

                <div class="text-center mt-8">
                    <a href="/" class="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition duration-200">
                        <i class="fas fa-home mr-2"></i>홈으로
                    </a>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            const ADMIN_PASSWORD = 'qwer1234';
            let adminToken = sessionStorage.getItem('adminToken');

            // 페이지 로드 시 인증 확인
            if (adminToken === ADMIN_PASSWORD) {
                showAdminContent();
            } else {
                showLoginScreen();
            }

            function showLoginScreen() {
                document.getElementById('loginScreen').classList.remove('hidden');
                document.getElementById('adminContent').classList.add('hidden');
            }

            function showAdminContent() {
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('adminContent').classList.remove('hidden');
                initializeAdminPage();
            }

            function adminLogin() {
                const password = document.getElementById('adminLoginPassword').value;
                if (password === ADMIN_PASSWORD) {
                    sessionStorage.setItem('adminToken', password);
                    adminToken = password;
                    showAdminContent();
                } else {
                    alert('비밀번호가 올바르지 않습니다.');
                    document.getElementById('adminLoginPassword').value = '';
                }
            }

            function adminLogout() {
                if (confirm('로그아웃 하시겠습니까?')) {
                    sessionStorage.removeItem('adminToken');
                    adminToken = null;
                    showLoginScreen();
                }
            }

            function initializeAdminPage() {
                // Set today's date as default
                document.getElementById('validDate').valueAsDate = new Date();
                loadTeamSettings();
                loadStats();
                loadCodes();
                setInterval(() => {
                    loadStats();
                    loadCodes();
                }, 5000);
            }

            async function loadTeamSettings() {
                try {
                    const response = await axios.get('/api/admin/team-settings');
                    if (response.data.success) {
                        document.getElementById('maxTeamSizeSelect').value = response.data.maxTeamSize;
                    }
                } catch (error) {
                    console.error('Error loading team settings:', error);
                }
            }

            async function updateTeamSettings() {
                const maxTeamSize = parseInt(document.getElementById('maxTeamSizeSelect').value);
                const resultDiv = document.getElementById('teamSettingsResult');

                try {
                    const response = await axios.post('/api/admin/team-settings', {
                        maxTeamSize,
                        adminPassword: ADMIN_PASSWORD
                    });

                    if (response.data.success) {
                        resultDiv.innerHTML = \`
                            <div class="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                                <i class="fas fa-check-circle text-green-600 text-xl mr-2"></i>
                                <span class="text-green-800 font-semibold">\${response.data.message}</span>
                            </div>
                        \`;
                        setTimeout(() => {
                            resultDiv.innerHTML = '';
                        }, 3000);
                    }
                } catch (error) {
                    resultDiv.innerHTML = \`
                        <div class="bg-red-50 border-2 border-red-500 rounded-lg p-4">
                            <i class="fas fa-exclamation-circle text-red-600 text-xl mr-2"></i>
                            <span class="text-red-800 font-semibold">\${error.response?.data?.message || '설정 저장 실패'}</span>
                        </div>
                    \`;
                }
            }

            async function loadStats() {
                try {
                    const statsCode = document.getElementById('statsCodeSelect')?.value || '';
                    const teamStatsCode = document.getElementById('teamStatsCodeSelect')?.value || '';
                    
                    const response = await axios.get('/api/admin/stats', {
                        params: { 
                            statsCode: statsCode,
                            teamStatsCode: teamStatsCode
                        }
                    });
                    const stats = response.data.stats;
                    
                    document.getElementById('totalCount').textContent = stats.total;
                    document.getElementById('maleCount').textContent = stats.male;
                    document.getElementById('femaleCount').textContent = stats.female;
                    
                    const teamStatsContainer = document.getElementById('teamStats');
                    teamStatsContainer.innerHTML = stats.teams.map(team => \`
                        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div class="flex items-center gap-4">
                                <div class="bg-indigo-600 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold">
                                    \${team.team_number}
                                </div>
                                <div>
                                    <div class="font-semibold">Team \${team.team_number}</div>
                                    <div class="text-sm text-gray-600">
                                        <i class="fas fa-mars text-blue-500"></i> \${team.male_count}명 
                                        <i class="fas fa-venus text-pink-500 ml-2"></i> \${team.female_count}명
                                    </div>
                                </div>
                            </div>
                            <div class="text-2xl font-bold text-indigo-600">
                                \${team.total_count}명
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    alert('통계를 불러오는데 실패했습니다.');
                }
            }

            async function loadCodes() {
                try {
                    const response = await axios.get('/api/admin/codes');
                    const codes = response.data.codes;
                    
                    const container = document.getElementById('codesList');
                    if (codes.length === 0) {
                        container.innerHTML = '<p class="text-gray-500 text-center py-4">아직 생성된 코드가 없습니다.</p>';
                        return;
                    }
                    
                    container.innerHTML = codes.map(code => \`
                        <div class="border-2 \${code.is_active ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'} rounded-lg p-4">
                            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div class="flex items-center gap-3">
                                    <div class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-lg">
                                        \${code.code}
                                    </div>
                                    <div>
                                        <div class="font-semibold text-gray-800">\${code.valid_date}</div>
                                        <div class="text-sm text-gray-600">
                                            <i class="fas fa-users mr-1"></i>\${code.participant_count}명 참가
                                        </div>
                                    </div>
                                </div>
                                <div class="flex flex-wrap items-center gap-2">
                                    \${code.is_active 
                                        ? '<span class="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold"><i class="fas fa-check mr-1"></i>활성</span>' 
                                        : '<span class="bg-gray-400 text-white px-3 py-1 rounded-full text-sm font-semibold"><i class="fas fa-times mr-1"></i>비활성</span>'
                                    }
                                    <button onclick="toggleCode('\${code.code}')" 
                                            class="\${code.is_active ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'} text-white px-4 py-2 rounded-lg transition duration-200 text-sm font-semibold">
                                        <i class="fas fa-\${code.is_active ? 'toggle-off' : 'toggle-on'} mr-1"></i>\${code.is_active ? '비활성화' : '활성화'}
                                    </button>
                                    <button onclick="viewCodeParticipants('\${code.code}')" 
                                            class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition duration-200 text-sm font-semibold">
                                        <i class="fas fa-eye mr-1"></i>상세보기
                                    </button>
                                    <button onclick="deleteCode('\${code.code}', \${code.participant_count})" 
                                            class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition duration-200 text-sm font-semibold">
                                        <i class="fas fa-trash mr-1"></i>삭제
                                    </button>
                                </div>
                            </div>
                        </div>
                    \`).join('');

                    // 팀 배정 select 옵션 업데이트
                    const selectElement = document.getElementById('assignCodeSelect');
                    selectElement.innerHTML = '<option value="">코드를 선택하세요</option>' +
                        codes.map(code => \`<option value="\${code.code}">\${code.code} (\${code.valid_date}) - \${code.participant_count}명</option>\`).join('');
                    
                    // 통계 코드 select 옵션 업데이트
                    const statsCodeSelect = document.getElementById('statsCodeSelect');
                    if (statsCodeSelect) {
                        const currentValue = statsCodeSelect.value;
                        statsCodeSelect.innerHTML = '<option value="">전체 코드</option>' +
                            codes.map(code => \`<option value="\${code.code}">\${code.code} (\${code.valid_date}) - \${code.participant_count}명</option>\`).join('');
                        statsCodeSelect.value = currentValue;
                    }
                    
                    // 팀별 통계 코드 select 옵션 업데이트
                    const teamStatsCodeSelect = document.getElementById('teamStatsCodeSelect');
                    if (teamStatsCodeSelect) {
                        const currentValue = teamStatsCodeSelect.value;
                        teamStatsCodeSelect.innerHTML = '<option value="">전체 코드</option>' +
                            codes.map(code => \`<option value="\${code.code}">\${code.code} (\${code.valid_date}) - \${code.participant_count}명</option>\`).join('');
                        teamStatsCodeSelect.value = currentValue;
                    }
                } catch (error) {
                    console.error('Error loading codes:', error);
                }
            }

            async function assignTeamsRandomly() {
                const code = document.getElementById('assignCodeSelect').value;
                
                if (!code) {
                    alert('코드를 선택해주세요.');
                    return;
                }

                if (!confirm(\`코드 '\${code}'의 모든 참가자를 6개 팀에 랜덤 재배정하시겠습니까?\\n\\n⚠️ 주의: 기존 팀 배정은 모두 초기화되고 새로 배정됩니다.\`)) {
                    return;
                }

                const resultDiv = document.getElementById('assignResult');
                resultDiv.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin text-indigo-600 text-2xl"></i><p class="mt-2 text-gray-600">팀 배정 중...</p></div>';

                try {
                    const response = await axios.post('/api/admin/assign-teams', {
                        code,
                        adminPassword: ADMIN_PASSWORD
                    });

                    if (response.data.success) {
                        resultDiv.innerHTML = \`
                            <div class="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                                <i class="fas fa-check-circle text-green-600 text-2xl mb-2"></i>
                                <p class="text-green-800 font-semibold">\${response.data.message}</p>
                            </div>
                        \`;
                        loadStats();
                        loadCodes();
                        setTimeout(() => {
                            resultDiv.innerHTML = '';
                        }, 5000);
                    }
                } catch (error) {
                    resultDiv.innerHTML = \`
                        <div class="bg-red-50 border-2 border-red-500 rounded-lg p-4">
                            <i class="fas fa-exclamation-circle text-red-600 text-2xl mb-2"></i>
                            <p class="text-red-800 font-semibold">\${error.response?.data?.message || '팀 배정 실패'}</p>
                        </div>
                    \`;
                }
            }

            async function toggleCode(code) {
                if (!confirm(\`코드 '\${code}'의 상태를 변경하시겠습니까?\`)) {
                    return;
                }

                try {
                    const response = await axios.post('/api/admin/toggle-code', {
                        code,
                        adminPassword: ADMIN_PASSWORD
                    });

                    if (response.data.success) {
                        alert(response.data.message);
                        loadCodes(); // 코드 목록 새로고침
                    }
                } catch (error) {
                    alert(error.response?.data?.message || '코드 상태 변경 실패');
                }
            }

            async function deleteCode(code, participantCount) {
                let message = \`코드 '\${code}'\를 정말로 삭제하시겠습니까?\`;
                
                if (participantCount > 0) {
                    message += \`\\n\\n⚠️ 경고: 이 코드에는 \${participantCount}명의 참가자가 등록되어 있습니다.\`;
                    message += \`\\n코드를 삭제하면 모든 참가자 정보도 함께 삭제됩니다.\`;
                }
                
                message += \`\\n\\n⚠️ 이 작업은 되돌릴 수 없습니다.\`;
                
                if (!confirm(message)) {
                    return;
                }

                try {
                    const response = await axios.post('/api/admin/delete-code', {
                        code,
                        adminPassword: ADMIN_PASSWORD
                    });

                    if (response.data.success) {
                        alert(response.data.message);
                        loadCodes(); // 코드 목록 새로고침
                        loadStats(); // 통계 새로고침
                    }
                } catch (error) {
                    alert(error.response?.data?.message || '코드 삭제 실패');
                }
            }

            async function viewCodeParticipants(code) {
                try {
                    const response = await axios.get(\`/api/admin/code/\${code}/participants\`);
                    const data = response.data;
                    
                    // 팀별로 참가자 그룹화
                    const teamGroups = {};
                    data.participants.forEach(p => {
                        if (!teamGroups[p.team_number]) {
                            teamGroups[p.team_number] = [];
                        }
                        teamGroups[p.team_number].push(p);
                    });

                    // 모달 생성
                    const modal = document.createElement('div');
                    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
                    modal.onclick = (e) => {
                        if (e.target === modal) modal.remove();
                    };

                    const teamList = Object.keys(teamGroups).sort((a, b) => a - b).map(teamNum => {
                        const members = teamGroups[teamNum];
                        const males = members.filter(m => m.gender === 'male').length;
                        const females = members.filter(m => m.gender === 'female').length;
                        const eCount = members.filter(m => m.mbti?.toUpperCase().startsWith('E')).length;
                        const iCount = members.filter(m => m.mbti?.toUpperCase().startsWith('I')).length;
                        
                        return \`
                            <div class="bg-gray-50 rounded-lg p-4 mb-3">
                                <div class="flex items-center justify-between mb-3">
                                    <h4 class="font-bold text-lg text-indigo-600">Team \${teamNum}</h4>
                                    <div class="flex gap-3 text-sm text-gray-600">
                                        <div>
                                            <i class="fas fa-mars text-blue-500"></i> \${males}명
                                            <i class="fas fa-venus text-pink-500 ml-1"></i> \${females}명
                                        </div>
                                        <div class="border-l pl-3">
                                            <span class="font-semibold text-green-600">E</span> \${eCount}명
                                            <span class="font-semibold text-purple-600 ml-1">I</span> \${iCount}명
                                        </div>
                                    </div>
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    \${members.map(m => \`
                                        <div class="flex items-center justify-between gap-2 bg-white p-2 rounded">
                                            <div class="flex items-center gap-2">
                                                <i class="fas fa-\${m.gender === 'male' ? 'mars text-blue-500' : 'venus text-pink-500'}"></i>
                                                <span class="font-semibold">\${m.nickname}</span>
                                            </div>
                                            <span class="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">\${m.mbti || 'N/A'}</span>
                                        </div>
                                    \`).join('')}
                                </div>
                            </div>
                        \`;
                    }).join('');

                    modal.innerHTML = \`
                        <div class="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                            <div class="sticky top-0 bg-white border-b p-6">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h3 class="text-2xl font-bold text-gray-800">
                                            코드: <span class="text-indigo-600">\${code}</span>
                                        </h3>
                                        <p class="text-gray-600">날짜: \${data.codeInfo.valid_date}</p>
                                    </div>
                                    <button onclick="this.closest('.fixed').remove()" 
                                            class="text-gray-500 hover:text-gray-700">
                                        <i class="fas fa-times text-2xl"></i>
                                    </button>
                                </div>
                                <div class="grid grid-cols-3 gap-4 mt-4">
                                    <div class="text-center p-3 bg-indigo-50 rounded-lg">
                                        <div class="text-2xl font-bold text-indigo-600">\${data.stats.total}</div>
                                        <div class="text-sm text-gray-600">전체</div>
                                    </div>
                                    <div class="text-center p-3 bg-blue-50 rounded-lg">
                                        <div class="text-2xl font-bold text-blue-600">\${data.stats.male}</div>
                                        <div class="text-sm text-gray-600">남성</div>
                                    </div>
                                    <div class="text-center p-3 bg-pink-50 rounded-lg">
                                        <div class="text-2xl font-bold text-pink-600">\${data.stats.female}</div>
                                        <div class="text-sm text-gray-600">여성</div>
                                    </div>
                                </div>
                            </div>
                            <div class="p-6">
                                <h4 class="text-xl font-bold text-gray-800 mb-4">
                                    <i class="fas fa-users mr-2"></i>팀별 참가자
                                </h4>
                                \${teamList || '<p class="text-gray-500 text-center py-8">참가자가 없습니다.</p>'}
                            </div>
                        </div>
                    \`;

                    document.body.appendChild(modal);
                } catch (error) {
                    alert('참가자 목록을 불러오는데 실패했습니다.');
                    console.error(error);
                }
            }

            async function generateCode() {
                const code = document.getElementById('newCode').value.trim();
                const validDate = document.getElementById('validDate').value;

                if (!code || !validDate) {
                    alert('코드와 날짜를 입력해주세요.');
                    return;
                }

                try {
                    const response = await axios.post('/api/admin/generate-code', {
                        code,
                        validDate,
                        adminPassword: ADMIN_PASSWORD
                    });

                    if (response.data.success) {
                        alert(\`일일 코드가 생성되었습니다!\\n코드: \${code}\\n날짜: \${validDate}\`);
                        document.getElementById('newCode').value = '';
                        loadCodes(); // 코드 목록 새로고침
                    }
                } catch (error) {
                    alert(error.response?.data?.message || '코드 생성 실패');
                }
            }
        </script>
    </body>
    </html>
  `)
})

export default app
