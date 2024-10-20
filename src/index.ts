import express from 'express';
import dotenv from 'dotenv';
import { connectToDatabase } from './db';
import AuthSchema from "./models/auth"
import UserSchema from './models/user';
import PoolSchema from './models/pool';
import cors from 'cors';
import jwt, { JwtPayload } from 'jsonwebtoken';
import cron from "node-cron"

import { Request, Response, NextFunction } from 'express';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface CustomRequest extends Request {
  user?: JwtPayload;
}

dotenv.config();

const HOST = process.env.HOST || 'http://localhost';
const PORT = parseInt(process.env.PORT || '4500');
const app = express();

app.use(cors({
  origin: `*`,
  credentials: true, 
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const verifyToken = (req: CustomRequest, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: 'Invalid token' });
  }
};

app.get('/', verifyToken, (req, res) => {
  try{
    return res.status(200).send();
  }catch(error){
    return res.status(422).send();
  }
});

/*
* Auth
*/
app.post("/auth/login", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: "Invalid email provided" });
    }

    const code = "111111";
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    const user = await UserSchema.findOneAndUpdate(
      { email: email.toLowerCase() },
      { 
        $setOnInsert: { 
          email: email.toLowerCase(), 
        }
      },
      { upsert: true, new: true }
    );

    await AuthSchema.findOneAndUpdate(
      { uuid: user._id, email: email.toLowerCase() },
      { code, expires },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: "Verification code sent successfully" });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post('/auth/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code || typeof email !== 'string' || typeof code !== 'string') {
      return res.status(400).json({ message: 'Invalid email or code provided' });
    }
    
    const auth = await AuthSchema.findOne({ email: email.toLowerCase() });

    if (!auth || auth.code !== code.toLowerCase() || auth.expires < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    const user = await UserSchema.findOne({ email: email.toLowerCase() });
    const token = jwt.sign({ email: email.toLowerCase(), uuid: user?._id, }, JWT_SECRET, { expiresIn: '365d' });
    
    await AuthSchema.deleteOne({ email });
    res.status(200).json({token});
  } catch (error) {
    console.error(error);
    res.status(500).json({token: null});
  }
});

// Stokvel
app.get('/stokvel/all', verifyToken, async (req, res) => {
  try{
    const response = await PoolSchema.find({});

    return res.status(200).json({
      pools: response
    });
  }catch(error){
    return res.status(422).send();
  }
});

app.post('/stokvel/join', verifyToken, async (req, res) => {
  try{
    //@ts-expect-error
    const { uuid } = req.user
    const { id = "" } = req.query;
    //console.log(uuid, req.query)

    if (!id || !uuid) {
      return res.status(400).json({ message: 'Missing stokvel ID or user ID' });
    }

    const _id = id;

    const updatedPool = await PoolSchema.findByIdAndUpdate(
      _id,
      { $addToSet: { members: uuid } },
      { new: true }
    );

    if (!updatedPool) {
      return res.status(404).json({ message: 'Stokvel not found' });
    }

    return res.status(200).json({
      balance: 0,
      members: [],
      transactions: [],
    });
  }catch(error){

    return res.status(422).send();
  }
});

app.get('/stokvel/:id', verifyToken, async (req, res) => {
  try{
    const {id} = req.params
    const response = await PoolSchema.findOne({_id: id});

    console.log(response)

    return res.status(200).json({
      balance: 0,
      members: [],
      transactions: [],
    });
  }catch(error){
    return res.status(200).json({});
  }
});

// Transactions
app.get('/transactions', verifyToken, (req, res) => {
  try{
    return res.status(200).json({
      balance: 0,
      transactions: []
    });
  }catch(error){
    return res.status(200).json({});
  }
});

//initialize server
app.listen(PORT, async () => {
  await connectToDatabase();

  await PoolSchema.findOneAndUpdate(
    {
      name: "Keystone Rotation Fund",
    },
    {
      $setOnInsert: { 
        name: "Keystone Rotation Fund",
        paymentInterval: "Monthly",
        address: "http://ilp.rafiki.money/keystone",
        stokvelType: "rotational",
        description: "A rotational stokvel is a group savings scheme where members contribute a set amount of money at regular intervals, such as weekly or monthly. The total contributions are then given to one member of the group in rotation, allowing each participant to receive a lump sum of money at a specific time"
      }
    },
    { upsert: true, new: true }
  );


  cron.schedule('* */5 * * * *', () => {
    console.log('Running a task every 5 minutes');
  });
  

  console.log(`Application started on URL ${HOST}:${PORT} 🎉`);
});