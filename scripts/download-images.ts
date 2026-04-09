import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const DRIVERS_URL = 'https://raw.githubusercontent.com/f1db/f1db/main/public/images/drivers/photos/';
const CONSTRUCTORS_URL = 'https://raw.githubusercontent.com/f1db/f1db/main/public/images/constructors/logos/';

const driversDir = path.join(__dirname, '..', 'src', 'assets', 'drivers');
const constructorsDir = path.join(__dirname, '..', 'src', 'assets', 'constructors');

const driverIds = [
  'max_verstappen',
  'perez',
  'leclerc',
  'sainz',
  'hamilton',
  'russell',
  'norris',
  'piastri',
  'gasly',
  'ocon',
  'alonso',
  'stroll',
  'tsunoda',
  'ricciardo',
  'bottas',
  'zhou',
  'magnussen',
  'hulkenberg',
  'de_vries',
  'sargeant'
];

const constructorIds = [
  'red_bull',
  'ferrari',
  'mercedes',
  'mclaren',
  'alpine',
  'aston_martin',
  'alphatauri',
  'alfa',
  'haas',
  'williams'
];

async function downloadImage(url: string, savePath: string): Promise<void> {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(savePath, response.data);
    console.log(`✓ 下载成功: ${path.basename(savePath)}`);
  } catch (error) {
    console.error(`✗ 下载失败: ${url}`, (error as Error).message);
  }
}

async function main() {
  console.log('开始下载车手头像...');
  for (const driverId of driverIds) {
    const url = `${DRIVERS_URL}${driverId}.png`;
    const savePath = path.join(driversDir, `${driverId}.png`);
    await downloadImage(url, savePath);
  }

  console.log('\n开始下载车队Logo...');
  for (const constructorId of constructorIds) {
    const url = `${CONSTRUCTORS_URL}${constructorId}.png`;
    const savePath = path.join(constructorsDir, `${constructorId}.png`);
    await downloadImage(url, savePath);
  }

  console.log('\n下载完成！');
}

main().catch(console.error);
