import mongoose, { Schema, Document } from 'mongoose';

export interface ICartItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  variantName?: string;
  sku: string;
  unitPrice: number;
  customizationTotal: number;
  quantity: number;
  petName?: string;
  image?: string;
}

export interface ICartDocument extends Document {
  userId: mongoose.Types.ObjectId;
  items: (ICartItem & Document)[];
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  variantName: { type: String },
  sku: { type: String, required: true },
  unitPrice: { type: Number, required: true, min: 0 },
  customizationTotal: { type: Number, default: 0, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  petName: { type: String },
  image: { type: String },
}, { _id: true });

const CartSchema = new Schema<ICartDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    items: [CartItemSchema],
  },
  { timestamps: true }
);

export const Cart = mongoose.model<ICartDocument>('Cart', CartSchema);
