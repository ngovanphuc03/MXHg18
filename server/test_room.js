require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');
        const Room = require('./src/models/Room').default || require('./src/models/Room');
        const r1 = await Room.findById('69ab20160d5c852aa0ab9334');
        console.log('Room by ID:', r1);
        const r2 = await Room.find();
        console.log('All rooms IDs and status:', r2.map(r => ({ id: r._id, isActive: r.isActive })));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
test();
