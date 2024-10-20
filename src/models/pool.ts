import mongoose, { Document, Model, Schema } from 'mongoose';

export interface InterfacePool {
  name: string;
  paymentInterval: string;
  members: string[];
  description: string;
  address: string;
  stokvelType: string;
}

export interface InterfacePoolDocument extends InterfacePool, Document {
  createdAt: Date;
  updatedAt: Date;
}

const poolSchema = new Schema<InterfacePoolDocument>(
  {
    name: { type: String, required: true, unique: true },
    paymentInterval: { type: String, required: true },
    members: { type: [String] },
    description: { type: String, required: false },
    address:  { type: String, required: true, unique: true },
    stokvelType: { type: String, required: true }
  },
  {
    timestamps: true
  }
);

const PoolSchema: Model<InterfacePoolDocument> =
  mongoose.models?.pool || mongoose.model<InterfacePoolDocument>('pool', poolSchema);

export default PoolSchema;