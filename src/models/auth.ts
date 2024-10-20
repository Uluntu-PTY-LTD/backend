import mongoose, { Document, Model, Schema } from 'mongoose';

export interface InterfaceAuth {
  email: string;
  code: string;
  expires: Date;
  uuid: string;
}

export interface InterfaceAuthDocument extends InterfaceAuth, Document {
  createdAt: Date;
  updatedAt: Date;
}

const authSchema = new Schema<InterfaceAuthDocument>(
  {
    uuid: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    expires: { type: Date, required: true },
  },
  {
    timestamps: true
  }
);

authSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });

const AuthSchema: Model<InterfaceAuthDocument> =
  mongoose.models?.auth || mongoose.model<InterfaceAuthDocument>('auth', authSchema);

export default AuthSchema;