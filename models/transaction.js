const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TransactionSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    pool_fund_id: {
        type: Schema.Types.ObjectId,
        ref: 'PoolFund',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    trans_type: {
        type: String,
        enum: ['deposit', 'payout'],
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Transaction', TransactionSchema);

