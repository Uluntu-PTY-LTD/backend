import mongoose, { Document, Model, Schema } from 'mongoose';

export interface InterfaceUser {
  email: string;
  address: string;
}

export interface InterfaceUserDocument extends InterfaceUser, Document {
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<InterfaceUserDocument>(
  {
    email: { type: String, required: true, unique: true },
    address: { type: String, required: true, unique: true },
  },
  {
    timestamps: true
  }
);

const UserSchema: Model<InterfaceUserDocument> =
  mongoose.models?.users || mongoose.model<InterfaceUserDocument>('users', userSchema);

export default UserSchema;