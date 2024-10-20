if (process.env.NODE_ENV !== 'production'){
    require('dotenv').config();
}

const express = require('express');
const ejs = require(`ejs-mate`);
const mongoose = require('mongoose');
const path = require('path')
const methodOverride = require('method-override')
const PoolFund = require('./models/pool_funds');
const User = require('./models/user');
const Transaction = require('./models/transaction')
const PORT = 3000; 

const app = express();

app.engine('ejs', ejs);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));


mongoose.connect('mongodb://localhost:27017/stokvel', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

//get all poolfunds in the system
app.get('/poolfunds', async (req, res) =>{
    const poolfunds = await PoolFund.find({});
    const alltransactions = await Transaction.find({});
    res.render('pool_funds/index', {poolfunds}, {alltransactions});
})

// Create new poolfund get page
app.get('/poolfunds/new', (req, res) => {
    // Retrieve enum values directly from the schema
    const paymentIntervals = PoolFund.schema.path('paymentInterval').enumValues; 
    res.render('pool_funds/new', {paymentIntervals});
})

//get specific poolfund information
app.get('/poolfunds/:id', async (req, res) =>{
    const poolfund = await PoolFund.findById(req.params.id).populate('members');
    res.render('pool_funds/show', {poolfund});
})

// create new poolfund post route
app.post('/poolfunds', async (req, res, next) => {
    const poolfund = new PoolFund(req.body.pool_fund);
    console.log(poolfund);
    await poolfund.save();
    res.redirect(`/poolfunds/${poolfund._id}`)
})

//get all stokvel members
app.get('/stokvelmembers', async (req, res) =>{
    const members = await User.find({});
    res.send(members);
})

//get all transactions
app.get('/transactions', async (req, res) =>{
    const transactions = await Transaction.find({});
    res.send(transactions);
})



//get specific poolfund information
app.get('/users/:id', async (req, res) =>{
    const user = await User.findById(req.params.id).populate('pool_funds');
    res.send(user);
})

//get transaction by member or pool fund (yet to come)


app.listen(PORT, () => {
    console.log(`Serving on port: ${PORT}`)
})