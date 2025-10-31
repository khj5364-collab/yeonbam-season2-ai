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
    const { nickname, gender, accessCode, surveyResponses } = await c.req.json()

    // 입력값 검증
    if (!nickname || !gender || !accessCode || !surveyResponses) {
      return c.json({ success: false, message: '모든 정보를 입력해주세요.' }, 400)
    }

    if (!['male', 'female'].includes(gender)) {
      return c.json({ success: false, message: '성별 정보가 올바르지 않습니다.' }, 400)
    }

    // 닉네임 중복 체크
    const existingNickname = await c.env.DB.prepare(`
      SELECT id FROM participants WHERE nickname = ?
    `).bind(nickname).first()

    if (existingNickname) {
      return c.json({ success: false, message: '이미 사용중인 닉네임입니다.' }, 400)
    }

    // 팀 배정 로직 (성비 균형)
    const teams = await c.env.DB.prepare(`
      SELECT team_number, male_count, female_count, total_count 
      FROM teams 
      ORDER BY total_count ASC, team_number ASC
    `).all()

    let assignedTeam = 1
    if (teams.results.length > 0) {
      // 성별에 따라 가장 적은 팀에 배정
      const sortedTeams = teams.results.sort((a: any, b: any) => {
        const genderCountA = gender === 'male' ? a.male_count : a.female_count
        const genderCountB = gender === 'male' ? b.male_count : b.female_count
        
        if (genderCountA !== genderCountB) {
          return genderCountA - genderCountB
        }
        return a.total_count - b.total_count
      })
      
      assignedTeam = sortedTeams[0].team_number
    }

    // 참가자 등록
    const insertResult = await c.env.DB.prepare(`
      INSERT INTO participants (nickname, gender, access_code, team_number)
      VALUES (?, ?, ?, ?)
    `).bind(nickname, gender, accessCode, assignedTeam).run()

    const participantId = insertResult.meta.last_row_id

    // 설문 응답 저장
    for (const response of surveyResponses) {
      await c.env.DB.prepare(`
        INSERT INTO survey_responses (participant_id, question_id, response_value)
        VALUES (?, ?, ?)
      `).bind(participantId, response.questionId, response.value).run()
    }

    // 팀 카운트 업데이트
    await c.env.DB.prepare(`
      UPDATE teams 
      SET ${gender === 'male' ? 'male_count = male_count + 1' : 'female_count = female_count + 1'},
          total_count = total_count + 1
      WHERE team_number = ?
    `).bind(assignedTeam).run()

    return c.json({ 
      success: true, 
      message: '등록이 완료되었습니다!', 
      teamNumber: assignedTeam,
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

// 7. 관리자 - 일일 코드 생성 API
app.post('/api/admin/generate-code', async (c) => {
  try {
    const { code, validDate, adminPassword } = await c.req.json()
    
    // 간단한 관리자 비밀번호 검증 (실제 환경에서는 더 강력한 인증 필요)
    if (adminPassword !== 'admin2024') {
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
    
    if (adminPassword !== 'admin2024') {
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
    
    if (adminPassword !== 'admin2024') {
      return c.json({ success: false, message: '관리자 권한이 없습니다.' }, 403)
    }

    if (!code) {
      return c.json({ success: false, message: '코드를 입력해주세요.' }, 400)
    }

    // 참가자가 있는지 확인
    const participantCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM participants WHERE access_code = ?
    `).bind(code).first()

    if (participantCount && participantCount.count > 0) {
      return c.json({ 
        success: false, 
        message: `이 코드로 ${participantCount.count}명의 참가자가 등록되어 있어 삭제할 수 없습니다.` 
      }, 400)
    }

    // 코드 삭제
    await c.env.DB.prepare(`
      DELETE FROM daily_codes WHERE code = ?
    `).bind(code).run()

    return c.json({ success: true, message: '코드가 삭제되었습니다.', code })
  } catch (error) {
    console.error('Error deleting code:', error)
    return c.json({ success: false, message: '서버 오류가 발생했습니다.' }, 500)
  }
})

// 8. 관리자 - 통계 조회 API
app.get('/api/admin/stats', async (c) => {
  try {
    const totalParticipants = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM participants
    `).first()

    const maleCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM participants WHERE gender = 'male'
    `).first()

    const femaleCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM participants WHERE gender = 'female'
    `).first()

    const teams = await c.env.DB.prepare(`
      SELECT team_number, male_count, female_count, total_count 
      FROM teams 
      ORDER BY team_number
    `).all()

    return c.json({
      success: true,
      stats: {
        total: totalParticipants?.count || 0,
        male: maleCount?.count || 0,
        female: femaleCount?.count || 0,
        teams: teams.results
      }
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
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
        <title>팀 빌딩 시스템</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div class="container mx-auto px-4 py-8">
            <div class="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
                <div class="text-center mb-8">
                    <i class="fas fa-users text-indigo-600 text-6xl mb-4"></i>
                    <h1 class="text-3xl font-bold text-gray-800 mb-2">팀 빌딩 시스템</h1>
                    <p class="text-gray-600">QR 코드를 스캔하여 입장하세요</p>
                </div>

                <!-- 입장 코드 입력 -->
                <div id="step1" class="step">
                    <div class="mb-6">
                        <label class="block text-gray-700 font-semibold mb-2">
                            <i class="fas fa-key mr-2"></i>입장 코드
                        </label>
                        <input type="text" id="accessCode" 
                               class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none" 
                               placeholder="입장 코드를 입력하세요">
                    </div>
                    <button onclick="verifyCode()" 
                            class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200">
                        <i class="fas fa-arrow-right mr-2"></i>다음
                    </button>
                </div>

                <!-- 닉네임 및 성별 입력 -->
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
                    <button onclick="nextToSurvey()" 
                            class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200">
                        <i class="fas fa-arrow-right mr-2"></i>다음
                    </button>
                </div>

                <!-- 설문조사 -->
                <div id="step3" class="step hidden">
                    <div class="mb-4">
                        <h2 class="text-xl font-bold text-gray-800 mb-2">
                            <i class="fas fa-clipboard-list mr-2"></i>간단한 성향 테스트
                        </h2>
                        <p class="text-sm text-gray-600">각 질문에 대해 가장 가까운 답변을 선택해주세요</p>
                    </div>
                    <div id="surveyQuestions" class="space-y-6 mb-6"></div>
                    <button onclick="submitRegistration()" 
                            class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200">
                        <i class="fas fa-check mr-2"></i>등록 완료
                    </button>
                </div>

                <!-- 완료 -->
                <div id="step4" class="step hidden text-center">
                    <i class="fas fa-check-circle text-green-500 text-6xl mb-4"></i>
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">등록 완료!</h2>
                    <div class="bg-indigo-50 rounded-lg p-6 mb-6">
                        <p class="text-gray-700 mb-2">당신의 팀은</p>
                        <p class="text-5xl font-bold text-indigo-600" id="teamNumber">-</p>
                        <p class="text-gray-700 mt-2">팀 입니다</p>
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
            let currentStep = 1;
            let selectedGender = null;
            let verifiedCode = null;
            let questions = [];

            async function verifyCode() {
                const code = document.getElementById('accessCode').value.trim();
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

            function selectGender(gender) {
                selectedGender = gender;
                document.querySelectorAll('.gender-btn').forEach(btn => {
                    btn.classList.remove('border-indigo-500', 'bg-indigo-50');
                });
                event.target.closest('.gender-btn').classList.add('border-indigo-500', 'bg-indigo-50');
            }

            async function nextToSurvey() {
                const nickname = document.getElementById('nickname').value.trim();
                
                if (!nickname) {
                    alert('닉네임을 입력해주세요.');
                    return;
                }

                if (!selectedGender) {
                    alert('성별을 선택해주세요.');
                    return;
                }

                try {
                    const response = await axios.post('/api/check-nickname', { nickname });
                    if (response.data.success) {
                        await loadSurveyQuestions();
                        showStep(3);
                    }
                } catch (error) {
                    alert(error.response?.data?.message || '닉네임 확인 실패');
                }
            }

            async function loadSurveyQuestions() {
                try {
                    const response = await axios.get('/api/survey-questions');
                    questions = response.data.questions;
                    
                    const container = document.getElementById('surveyQuestions');
                    container.innerHTML = questions.map((q, index) => \`
                        <div class="bg-gray-50 rounded-lg p-4">
                            <p class="font-semibold text-gray-800 mb-3">\${index + 1}. \${q.question_text}</p>
                            <div class="flex justify-between gap-2">
                                \${[1, 2, 3, 4, 5].map(value => \`
                                    <button onclick="selectAnswer(\${q.id}, \${value})" 
                                            data-question="\${q.id}"
                                            data-value="\${value}"
                                            class="answer-btn flex-1 py-2 border-2 border-gray-300 rounded hover:border-indigo-500 transition duration-200 text-sm">
                                        \${value}
                                    </button>
                                \`).join('')}
                            </div>
                            <div class="flex justify-between text-xs text-gray-500 mt-2">
                                <span>매우 아니다</span>
                                <span>매우 그렇다</span>
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    alert('설문 질문을 불러오는데 실패했습니다.');
                }
            }

            function selectAnswer(questionId, value) {
                const buttons = document.querySelectorAll(\`[data-question="\${questionId}"]\`);
                buttons.forEach(btn => {
                    btn.classList.remove('border-indigo-500', 'bg-indigo-50', 'font-bold');
                });
                event.target.classList.add('border-indigo-500', 'bg-indigo-50', 'font-bold');
            }

            async function submitRegistration() {
                const nickname = document.getElementById('nickname').value.trim();
                
                // 모든 질문에 답했는지 확인
                const selectedAnswers = document.querySelectorAll('.answer-btn.bg-indigo-50');
                if (selectedAnswers.length !== questions.length) {
                    alert('모든 질문에 답해주세요.');
                    return;
                }

                // 설문 응답 수집
                const surveyResponses = Array.from(selectedAnswers).map(btn => ({
                    questionId: parseInt(btn.dataset.question),
                    value: parseInt(btn.dataset.value)
                }));

                try {
                    const response = await axios.post('/api/register', {
                        nickname,
                        gender: selectedGender,
                        accessCode: verifiedCode,
                        surveyResponses
                    });

                    if (response.data.success) {
                        document.getElementById('teamNumber').textContent = response.data.teamNumber;
                        showStep(4);
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
        <div class="container mx-auto px-4 py-8">
            <div class="max-w-4xl mx-auto">
                <div class="text-center mb-8">
                    <h1 class="text-4xl font-bold text-gray-800 mb-2">
                        <i class="fas fa-cog text-indigo-600 mr-2"></i>관리자 페이지
                    </h1>
                </div>

                <!-- 통계 -->
                <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-chart-bar mr-2"></i>현황 통계
                    </h2>
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
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <input type="text" id="newCode" 
                               class="px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none" 
                               placeholder="코드 (예: 0000, 1234)">
                        <input type="date" id="validDate" 
                               class="px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none">
                        <input type="password" id="adminPassword" 
                               class="px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none" 
                               placeholder="관리자 비밀번호">
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
                            <div><i class="fas fa-trash text-red-500 mr-2"></i><strong>삭제:</strong> 참가자가 없는 코드만 삭제 가능</div>
                        </div>
                    </div>
                    <div id="codesList" class="space-y-3">
                        <!-- Codes will be loaded here -->
                    </div>
                </div>

                <!-- 팀별 현황 -->
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-users mr-2"></i>전체 팀별 현황
                    </h2>
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
            // Set today's date as default
            document.getElementById('validDate').valueAsDate = new Date();

            async function loadStats() {
                try {
                    const response = await axios.get('/api/admin/stats');
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
                                    \${code.participant_count === 0 
                                        ? \`<button onclick="deleteCode('\${code.code}')" 
                                                class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition duration-200 text-sm font-semibold">
                                            <i class="fas fa-trash mr-1"></i>삭제
                                        </button>\`
                                        : ''
                                    }
                                </div>
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Error loading codes:', error);
                }
            }

            async function toggleCode(code) {
                const password = prompt('관리자 비밀번호를 입력하세요:');
                if (!password) return;

                try {
                    const response = await axios.post('/api/admin/toggle-code', {
                        code,
                        adminPassword: password
                    });

                    if (response.data.success) {
                        alert(response.data.message);
                        loadCodes(); // 코드 목록 새로고침
                    }
                } catch (error) {
                    alert(error.response?.data?.message || '코드 상태 변경 실패');
                }
            }

            async function deleteCode(code) {
                if (!confirm(\`코드 '\${code}'를 정말로 삭제하시겠습니까?\\n\\n⚠️ 이 작업은 되돌릴 수 없습니다.\`)) {
                    return;
                }

                const password = prompt('관리자 비밀번호를 입력하세요:');
                if (!password) return;

                try {
                    const response = await axios.post('/api/admin/delete-code', {
                        code,
                        adminPassword: password
                    });

                    if (response.data.success) {
                        alert(response.data.message);
                        loadCodes(); // 코드 목록 새로고침
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
                        
                        return \`
                            <div class="bg-gray-50 rounded-lg p-4 mb-3">
                                <div class="flex items-center justify-between mb-3">
                                    <h4 class="font-bold text-lg text-indigo-600">Team \${teamNum}</h4>
                                    <div class="text-sm text-gray-600">
                                        <i class="fas fa-mars text-blue-500"></i> \${males}명
                                        <i class="fas fa-venus text-pink-500 ml-2"></i> \${females}명
                                    </div>
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    \${members.map(m => \`
                                        <div class="flex items-center gap-2 bg-white p-2 rounded">
                                            <i class="fas fa-\${m.gender === 'male' ? 'mars text-blue-500' : 'venus text-pink-500'}"></i>
                                            <span class="font-semibold">\${m.nickname}</span>
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
                const adminPassword = document.getElementById('adminPassword').value;

                if (!code || !validDate || !adminPassword) {
                    alert('모든 필드를 입력해주세요.');
                    return;
                }

                try {
                    const response = await axios.post('/api/admin/generate-code', {
                        code,
                        validDate,
                        adminPassword
                    });

                    if (response.data.success) {
                        alert(\`일일 코드가 생성되었습니다!\\n코드: \${code}\\n날짜: \${validDate}\`);
                        document.getElementById('newCode').value = '';
                        document.getElementById('adminPassword').value = '';
                        loadCodes(); // 코드 목록 새로고침
                    }
                } catch (error) {
                    alert(error.response?.data?.message || '코드 생성 실패');
                }
            }

            loadStats();
            loadCodes();
            setInterval(() => {
                loadStats();
                loadCodes();
            }, 5000); // 5초마다 통계 새로고침
        </script>
    </body>
    </html>
  `)
})

export default app
