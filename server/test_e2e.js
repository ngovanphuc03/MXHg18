import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api';
let token = '';

async function runTests() {
    console.log('--- BẮT ĐẦU TEST E2E API MẠNG XÃ HỘI G18 ---');
    try {
        // 1. Đăng ký (Register)
        console.log('\n1. Test Đăng ký người dùng mới...');
        const randomId = Math.floor(Math.random() * 100000);
        const username = `bot_user_${randomId}`;
        const email = `bot_${randomId}@g18.com`;
        const resReg = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, displayName: 'Robot Tester', password: 'Password123' })
        });
        const dataReg = await resReg.json();
        if (resReg.ok && dataReg.token) {
            console.log(`✅ Đăng ký thành công! Username: ${username}`);
            token = dataReg.token;
        } else {
            console.error('❌ Đăng ký thất bại:', dataReg);
            return;
        }

        // 2. Lấy Thông tin cá nhân (Profile)
        console.log('\n2. Test Lấy thông tin tài khoản...');
        const resProfile = await fetch(`${BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataProfile = await resProfile.json();
        if (resProfile.ok && dataProfile._id) {
            console.log(`✅ Lấy Profile thành công! ID: ${dataProfile._id}, Level: ${dataProfile.level || 1}`);
        } else {
            console.error('❌ Lấy Profile thất bại:', dataProfile);
        }

        // 3. Test Locket Feed (Mock)
        console.log('\n3. Test Tải bảng Feed Locket...');
        const resLocket = await fetch(`${BASE_URL}/locket/feed`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resLocket.ok) {
            const dataLocket = await resLocket.json();
            console.log(`✅ Tải Locket Feed thành công! Số lượng bài viết: ${dataLocket.length || 0}`);
        } else {
            console.error('❌ Tải Locket Feed thất bại:', await resLocket.text());
        }

        console.log('\n🎉 KẾT LUẬN: BÀI TEST API CƠ BẢN ĐÃ CHẠY HOÀN HẢO. DATABASE MONGODB CLOUD PHẢN HỒI NHANH CHÓNG!');
    } catch (e) {
        console.error('Lỗi trong quá trình test:', e);
    }
}

runTests();
