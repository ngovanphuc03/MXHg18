// removed fetch 
const BASE_URL = 'http://localhost:3001/api';
let token = '';
const userNo = Date.now().toString().slice(-4);
const username = `testuser${userNo}`;
const password = `Pass${userNo}`;

async function runTest() {
    console.log('--- BAST STARTING API INTEG TEST ---');

    try {
        // 1. Register
        console.log(`1. Dang ky tai khoan voi username: ${username}...`);
        const regRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                displayName: `Test User ${userNo}`,
                email: `test${userNo}@test.com`,
                password
            })
        });
        const regData = await regRes.json();
        if (!regRes.ok) throw new Error('[FAIL] Register ' + JSON.stringify(regData));
        console.log('[PASS] Register thanh cong:', regData.user.username);

        // 2. Login
        console.log('2. Dang nhap...');
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error('[FAIL] Login ' + JSON.stringify(loginData));
        token = loginData.token;
        console.log('[PASS] Login thanh cong. Da co token.');

        // 3. Get Members
        console.log('3. Lay danh sach hoi vien...');
        const membersRes = await fetch(`${BASE_URL}/auth/members`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const membersData = await membersRes.json();
        if (!membersRes.ok) throw new Error('[FAIL] Get members ' + JSON.stringify(membersData));
        console.log(`[PASS] Lay members thanh cong. Co ${membersData.length} nguoi dung.`);

        console.log('--- ALL TESTS PASSED ---');
    } catch (err) {
        console.error('Test error:', err.message);
    }
}

runTest();
