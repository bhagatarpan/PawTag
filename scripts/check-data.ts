import { connectDatabase, Order, Tag, Subscription, Invoice, PendingOrder } from '@pawtag/db';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../packages/api/.env') });

const DB_URL = process.env.DB_URL || 'mongodb://localhost:27017/pawtag';

async function checkData() {
  await connectDatabase(DB_URL);
  
  const orders = await Order.countDocuments({});
  const tags = await Tag.countDocuments({});
  const subs = await Subscription.countDocuments({});
  const invoices = await Invoice.countDocuments({});
  const pending = await PendingOrder.countDocuments({});
  
  console.log(`Orders: ${orders}`);
  console.log(`Tags: ${tags}`);
  console.log(`Subscriptions: ${subs}`);
  console.log(`Invoices: ${invoices}`);
  console.log(`PendingOrders: ${pending}`);
  
  const orderList = await Order.find({}).select('orderNumber status payment.status').lean();
  orderList.forEach(o => console.log(`  - ${o.orderNumber} | order: ${o.status} | payment: ${o.payment?.status}`));
  
  process.exit(0);
}

checkData();
