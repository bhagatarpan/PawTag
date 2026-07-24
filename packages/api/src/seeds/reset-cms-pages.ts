import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { connectDatabase, disconnectDatabase, CmsPage } from '@pawtag/db';

async function resetPages() {
  console.log('Connecting...');
  await connectDatabase(process.env.DB_URL!);
  console.log('Connected');
  const slugs = ['about', 'privacy-policy', 'terms-of-service', 'faq'];
  for (const slug of slugs) {
    const result = await CmsPage.deleteOne({ slug });
    console.log(`Deleted ${slug}: ${result.deletedCount}`);
  }
  await disconnectDatabase();
  console.log('Done. Run pnpm seed:cms to re-create with Puck format');
}
resetPages().catch(e => { console.error(e); process.exit(1); });
