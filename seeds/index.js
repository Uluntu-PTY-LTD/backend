const mongoose = require('mongoose');
const names = require('./names');
const interval = require('./interval');
//const PoolFund = require('../models/poolFund');
const PoolFund = require('../models/pool_funds');
const User = require('../models/user');
const Transaction = require('../models/transaction');
const {faker} = require('@faker-js/faker');
const transaction_type = require('./transaction_type');

mongoose.connect('mongodb://localhost:27017/stokvel', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

//Helper functions 
const sample = array => array[Math.floor(Math.random() * array.length)]; // take random index fromarray
const getRandomSubset = (arr, num) => {
    const shuffled = arr.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, num);
};


const seedDB = async () => {
    await PoolFund.deleteMany({});
    await User.deleteMany({});
    await Transaction.deleteMany({});
    
    // Create 10 users
    const users = [];
    for (let i = 0; i < 10; i++) {
        let address = faker.finance.accountName().toLocaleLowerCase().replace(/\s+/g, '');
        const user = new User({
            name: faker.person.fullName(),
            email: faker.internet.email(),
            wallet_address: `http://ilp.rafiki.money/${address}`
        })
        await user.save();
        users.push(user); //keeping track of created users
    }
    console.log(users)

    // Create Pool Funds and assign them to users
    const poolFunds = [];
    for (let i = 0; i < 5; i++) {
        const randomUsers = getRandomSubset(users, 3);
        const random100 = Math.floor(Math.random() * 100); //generates a random number between 1 and 100 for names array
        const poolFund = new PoolFund({
            name: `${names[random100]} Society`,
            paymentInterval: `${sample(interval)}`,
            members: randomUsers.map(user => user._id)
        })
        await poolFund.save();
        //associate this poolFund with 3 random users
        for (const user of randomUsers){
            user.pool_funds.push(poolFund._id);
            await user.save();
        }
        poolFunds.push(poolFund); //Keep track of created pool funds
        
    }
    console.log(poolFunds);

    // Create Transactions
    for (let i = 0; i < 20; i++){
        const randomUser = sample(users);
        const randomPoolFund = sample(poolFunds);
        const transaction = new Transaction({
            user_id: randomUser._id,
            pool_fund_id: randomPoolFund._id,
            amount: parseFloat(faker.finance.amount({dec: 2})),
            trans_type: `${sample(transaction_type)}`
        })
        await transaction.save();
    }

}

seedDB().then(() => {
    mongoose.connection.close();
})