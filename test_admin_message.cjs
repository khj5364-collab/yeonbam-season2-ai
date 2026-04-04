const axios = require('axios');

const baseURL = 'http://localhost:3000';

async function testAdminMessage() {
    try {
        // 1. 사용자 등록 (테스트용)
        console.log('1. Registering test user...');
        const registerRes = await axios.post(`${baseURL}/api/register`, {
            nickname: '테스트유저',
            gender: 'male',
            accessCode: '0000',
            mbti: 'ENFP',
            teamNumber: null
        });
        console.log('✓ User registered:', registerRes.data);

        // 2. 사용자 ID 가져오기
        console.log('\n2. Getting user ID...');
        const reentryRes = await axios.post(`${baseURL}/api/re-entry`, {
            accessCode: '0000',
            nickname: '테스트유저'
        });
        console.log('✓ User ID:', reentryRes.data.user.id);
        const userId = reentryRes.data.user.id;

        // 3. 관리자에게 메시지 전송
        console.log('\n3. Sending message to admin...');
        const messageRes = await axios.post(`${baseURL}/api/admin/send-message`, {
            senderId: userId,
            senderNickname: '테스트유저',
            accessCode: '0000',
            content: '테스트 문의: 팀 배정은 언제 하나요?'
        });
        console.log('✓ Message sent:', messageRes.data);

        // 4. 관리자 메시지 목록 조회
        console.log('\n4. Fetching admin messages...');
        const messagesRes = await axios.get(`${baseURL}/api/admin/messages?accessCode=0000`);
        console.log('✓ Admin messages:', messagesRes.data);
        
        console.log('\n✅ All tests passed!');
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testAdminMessage();
