

const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const PoolFundSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    paymentInterval: {
        type: String, 
        enum: ['weekly', 'fortnightly', 'monthly'],
        required: true 
    },
    wallet_address: {
        type: String,
        required: true
    },
    members: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }]
});

module.exports = mongoose.model('PoolFund', PoolFundSchema);