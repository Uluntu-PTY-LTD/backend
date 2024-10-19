

const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const UserSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    wallet_address: {
        type: String,
        required: true
    },
    pool_funds: [{
        type: Schema.Types.ObjectId,
        ref: 'PoolFund',
        required: true
    }]
});

module.exports = mongoose.model('User', UserSchema);