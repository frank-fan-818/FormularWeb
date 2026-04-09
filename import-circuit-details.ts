import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './src/utils/supabase.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log('   脚本目录:', __dirname);

// 项目根目录 = 脚本所在目录（因为脚本直接在项目根目录）
const F1DB_PATH = path.join(__dirname, 'f1db-main', 'src', 'data');
console.log('   F1DB路径:', F1DB_PATH);

// 扩展数据ID别名映射（f1db文件名 vs 我们的扩展数据key）
const circuitIdAliases: Record<string, string> = {
  'spielberg': 'red_bull_ring',
  'spa_francorchamps': 'spa',
  'monaco': 'monaco_circuit',
  'mexico_city': 'rodriguez',
  'montreal': 'villeneuve',
  'melbourne': 'albert_park',
  'las_vegas': 'las_vegas',
  'yas_marina': 'yas_marina',
  'jeddah': 'jeddah',
  'marina_bay': 'marina_bay',
};

// circuitData.ts中的扩展数据
const circuitExtraData: Record<string, any> = {
  // 亚洲 & 中东
  shanghai: { first_race: 2004, lap_record: '1:31.095', lap_record_driver: 'Michael Schumacher', lap_record_year: 2004, total_races: 18, race_laps: 56, total_distance: '305.269 km' },
  suzuka: { first_race: 1987, lap_record: '1:30.983', lap_record_driver: 'Lewis Hamilton', lap_record_year: 2019, total_races: 36, race_laps: 53, total_distance: '307.471 km' },
  bahrain: { first_race: 2004, lap_record: '1:31.447', lap_record_driver: 'Pedro de la Rosa', lap_record_year: 2005, total_races: 20, race_laps: 57, total_distance: '308.238 km' },
  yas_marina: { first_race: 2009, lap_record: '1:26.103', lap_record_driver: 'Max Verstappen', lap_record_year: 2021, total_races: 15, race_laps: 58, total_distance: '306.183 km' },
  jeddah: { first_race: 2021, lap_record: '1:28.165', lap_record_driver: 'Lewis Hamilton', lap_record_year: 2021, total_races: 4, race_laps: 50, total_distance: '308.450 km' },
  lusail: { first_race: 2021, lap_record: '1:20.951', lap_record_driver: 'Max Verstappen', lap_record_year: 2023, total_races: 3, race_laps: 57, total_distance: '308.610 km' },
  marina_bay: { first_race: 2008, lap_record: '1:41.905', lap_record_driver: 'Kevin Magnussen', lap_record_year: 2018, total_races: 14, race_laps: 62, total_distance: '308.706 km' },
  sepang: { first_race: 1999, lap_record: '1:34.080', lap_record_driver: 'Juan Pablo Montoya', lap_record_year: 2004, total_races: 18, race_laps: 56, total_distance: '310.408 km' },
  yeongam: { first_race: 2010, lap_record: '1:39.605', lap_record_driver: 'Sebastian Vettel', lap_record_year: 2011, total_races: 4, race_laps: 55, total_distance: '308.630 km' },
  buddh: { first_race: 2011, lap_record: '1:27.249', lap_record_driver: 'Sebastian Vettel', lap_record_year: 2011, total_races: 3, race_laps: 60, total_distance: '308.428 km' },

  // 欧洲
  monza: { first_race: 1950, lap_record: '1:21.046', lap_record_driver: 'Rubens Barrichello', lap_record_year: 2004, total_races: 73, race_laps: 53, total_distance: '306.720 km' },
  monaco: { first_race: 1950, lap_record: '1:12.909', lap_record_driver: 'Lewis Hamilton', lap_record_year: 2021, total_races: 79, race_laps: 78, total_distance: '260.286 km' },
  monaco_circuit: { first_race: 1950, lap_record: '1:12.909', lap_record_driver: 'Lewis Hamilton', lap_record_year: 2021, total_races: 79, race_laps: 78, total_distance: '260.286 km' },
  silverstone: { first_race: 1950, lap_record: '1:27.097', lap_record_driver: 'Max Verstappen', lap_record_year: 2020, total_races: 57, race_laps: 52, total_distance: '306.198 km' },
  spa: { first_race: 1950, lap_record: '1:41.252', lap_record_driver: 'Valtteri Bottas', lap_record_year: 2018, total_races: 66, race_laps: 44, total_distance: '308.052 km' },
  spa_francorchamps: { first_race: 1950, lap_record: '1:41.252', lap_record_driver: 'Valtteri Bottas', lap_record_year: 2018, total_races: 66, race_laps: 44, total_distance: '308.052 km' },
  catalunya: { first_race: 1991, lap_record: '1:18.149', lap_record_driver: 'Max Verstappen', lap_record_year: 2023, total_races: 33, race_laps: 66, total_distance: '307.104 km' },
  imola: { first_race: 1980, lap_record: '1:15.484', lap_record_driver: 'Lewis Hamilton', lap_record_year: 2020, total_races: 29, race_laps: 63, total_distance: '309.049 km' },
  red_bull_ring: { first_race: 1970, lap_record: '1:05.619', lap_record_driver: 'Carlos Sainz', lap_record_year: 2020, total_races: 35, race_laps: 71, total_distance: '306.452 km' },
  spielberg: { first_race: 1970, lap_record: '1:05.619', lap_record_driver: 'Carlos Sainz', lap_record_year: 2020, total_races: 35, race_laps: 71, total_distance: '306.452 km' },
  hungaroring: { first_race: 1986, lap_record: '1:16.627', lap_record_driver: 'Lewis Hamilton', lap_record_year: 2020, total_races: 38, race_laps: 70, total_distance: '306.630 km' },
  zandvoort: { first_race: 1952, lap_record: '1:11.097', lap_record_driver: 'Lewis Hamilton', lap_record_year: 2021, total_races: 32, race_laps: 72, total_distance: '306.587 km' },
  hockenheimring: { first_race: 1970, lap_record: '1:13.780', lap_record_driver: 'Kimi Räikkönen', lap_record_year: 2004, total_races: 37, race_laps: 67, total_distance: '306.458 km' },
  nurburgring: { first_race: 1951, lap_record: '1:28.139', lap_record_driver: 'Max Verstappen', lap_record_year: 2020, total_races: 40, race_laps: 60, total_distance: '308.329 km' },
  magny_cours: { first_race: 1991, lap_record: '1:15.377', lap_record_driver: 'Michael Schumacher', lap_record_year: 2004, total_races: 18, race_laps: 70, total_distance: '308.586 km' },
  paul_ricard: { first_race: 1971, lap_record: '1:32.740', lap_record_driver: 'Valtteri Bottas', lap_record_year: 2019, total_races: 18, race_laps: 53, total_distance: '309.690 km' },
  estoril: { first_race: 1984, lap_record: '1:14.859', lap_record_driver: 'Ralf Schumacher', lap_record_year: 2002, total_races: 13, race_laps: 71, total_distance: '307.770 km' },
  istanbul: { first_race: 2005, lap_record: '1:24.770', lap_record_driver: 'Juan Pablo Montoya', lap_record_year: 2005, total_races: 8, race_laps: 58, total_distance: '309.396 km' },
  baku: { first_race: 2016, lap_record: '1:43.009', lap_record_driver: 'Charles Leclerc', lap_record_year: 2019, total_races: 7, race_laps: 51, total_distance: '306.049 km' },
  valencia: { first_race: 2008, lap_record: '1:38.683', lap_record_driver: 'Timo Glock', lap_record_year: 2009, total_races: 5, race_laps: 57, total_distance: '308.883 km' },
  valencia_street: { first_race: 2008, lap_record: '1:38.683', lap_record_driver: 'Timo Glock', lap_record_year: 2009, total_races: 5, race_laps: 57, total_distance: '308.883 km' },

  // 美洲
  interlagos: { first_race: 1973, lap_record: '1:10.540', lap_record_driver: 'Valtteri Bottas', lap_record_year: 2018, total_races: 48, race_laps: 71, total_distance: '305.909 km' },
  mexico_city: { first_race: 1963, lap_record: '1:17.774', lap_record_driver: 'Valtteri Bottas', lap_record_year: 2021, total_races: 22, race_laps: 71, total_distance: '305.354 km' },
  rodriguez: { first_race: 1963, lap_record: '1:17.774', lap_record_driver: 'Valtteri Bottas', lap_record_year: 2021, total_races: 22, race_laps: 71, total_distance: '305.354 km' },
  austin: { first_race: 2012, lap_record: '1:36.169', lap_record_driver: 'Charles Leclerc', lap_record_year: 2022, total_races: 10, race_laps: 56, total_distance: '308.405 km' },
  miami: { first_race: 2022, lap_record: '1:29.708', lap_record_driver: 'Max Verstappen', lap_record_year: 2023, total_races: 3, race_laps: 57, total_distance: '308.326 km' },
  las_vegas: { first_race: 1981, lap_record: '1:35.498', lap_record_driver: 'Oscar Piastri', lap_record_year: 2023, total_races: 2, race_laps: 50, total_distance: '305.888 km' },
  villeneuve: { first_race: 1978, lap_record: '1:13.078', lap_record_driver: 'Valtteri Bottas', lap_record_year: 2019, total_races: 42, race_laps: 70, total_distance: '305.270 km' },
  montreal: { first_race: 1978, lap_record: '1:13.078', lap_record_driver: 'Valtteri Bottas', lap_record_year: 2019, total_races: 42, race_laps: 70, total_distance: '305.270 km' },
  indianapolis: { first_race: 2000, lap_record: '1:10.399', lap_record_driver: 'Rubens Barrichello', lap_record_year: 2004, total_races: 8, race_laps: 73, total_distance: '306.016 km' },
  watkins_glen: { first_race: 1961, lap_record: '1:32.931', lap_record_driver: 'Jackie Stewart', lap_record_year: 1973, total_races: 20, race_laps: 59, total_distance: '386.820 km' },
  long_beach: { first_race: 1976, lap_record: '1:19.939', lap_record_driver: 'Niki Lauda', lap_record_year: 1977, total_races: 8, race_laps: 80, total_distance: '253.920 km' },

  // 大洋洲
  melbourne: { first_race: 1996, lap_record: '1:17.868', lap_record_driver: 'Michael Schumacher', lap_record_year: 2004, total_races: 26, race_laps: 58, total_distance: '306.124 km' },
  albert_park: { first_race: 1996, lap_record: '1:17.868', lap_record_driver: 'Michael Schumacher', lap_record_year: 2004, total_races: 26, race_laps: 58, total_distance: '306.124 km' },
};

// 额外历史赛道数据
const historicalCircuits: Record<string, any> = {
  // 更多历史赛道
  adelaide: { first_race: 1985, total_races: 10, race_laps: 82, total_distance: '306.180 km', lap_record: '1:16.00', lap_record_driver: 'Nigel Mansell', lap_record_year: 1994 },
  brands_hatch: { first_race: 1986, total_races: 13, race_laps: 78, total_distance: '306.156 km', lap_record: '1:18.627', lap_record_driver: 'Damon Hill', lap_record_year: 1996 },
  donington: { first_race: 1933, total_races: 17, race_laps: 76, total_distance: '308.416 km', lap_record: '1:18.029', lap_record_driver: 'Lewis Hamilton', lap_record_year: 2010 },
  kyalami: { first_race: 1967, total_races: 23, race_laps: 69, total_distance: '308.637 km', lap_record: '1:17.577', lap_record_driver: 'Lewis Hamilton', lap_record_year: 2018 },
  mugello: { first_race: 2020, total_races: 4, race_laps: 59, total_distance: '309.496 km', lap_record: '1:15.144', lap_record_driver: 'Lewis Hamilton', lap_record_year: 2020 },
  portimao: { first_race: 2020, total_races: 5, race_laps: 66, total_distance: '306.716 km', lap_record: '1:18.149', lap_record_driver: 'Max Verstappen', lap_record_year: 2021 },
  sochi: { first_race: 2014, total_races: 10, race_laps: 53, total_distance: '309.745 km', lap_record: '1:35.761', lap_record_driver: 'Lewis Hamilton', lap_record_year: 2020 },
  zolder: { first_race: 1963, total_races: 8, race_laps: 70, total_distance: '300.590 km', lap_record: '1:18.332', lap_record_driver: 'Niki Lauda', lap_record_year: 1975 },
  zeltweg: { first_race: 1969, total_races: 3, race_laps: 70, total_distance: '306.880 km', lap_record: '1:31.530', lap_record_driver: 'Gilles Villeneuve', lap_record_year: 1979 },
  jerez: { first_race: 1986, total_races: 4, race_laps: 73, total_distance: '299.890 km', lap_record: '1:21.670', lap_record_driver: 'Alain Prost', lap_record_year: 1986 },
  estoril: { first_race: 1984, total_races: 13, race_laps: 71, total_distance: '307.770 km', lap_record: '1:14.859', lap_record_driver: 'Ralf Schumacher', lap_record_year: 2002 },
};

async function importCircuitsFull() {
  console.log('\n🚀 开始导入完整赛道数据...');

  // 检查目录是否存在
  console.log('📂 检查数据目录...');
  const circuitsDir = path.join(F1DB_PATH, 'circuits');
  console.log('   路径:', circuitsDir);
  console.log('   目录存在:', fs.existsSync(circuitsDir));

  if (!fs.existsSync(circuitsDir)) {
    console.error('❌ 赛道目录不存在!');
    return { successCount: 0, updateCount: 0 };
  }

  const files = fs.readdirSync(circuitsDir).filter(f => f.endsWith('.yml'));
  console.log('   找到文件数量:', files.length);
  console.log('   前5个文件:', files.slice(0, 5));

  // 1. 合并所有数据一次性导入（包含基础+扩展）
  console.log('\n📥 步骤1: 导入完整赛道数据...');

  const allCircuits: Record<string, any> = {};

  // 1.1 加载f1db基础数据
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(circuitsDir, file), 'utf-8');
      const circuitId = file.replace('.yml', '').replace(/-/g, '_');

      let name = '';
      let length: number | null = null;
      let turns: number | null = null;
      let lat: number | null = null;
      let long: number | null = null;
      let locality = '';
      let country = '';
      let direction = '';

      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('name:')) {
          name = trimmed.replace('name:', '').trim().replace(/^["']|["']$/g, '');
        } else if (trimmed.startsWith('length:')) {
          const val = trimmed.replace('length:', '').trim();
          length = val ? parseFloat(val) : null;
        } else if (trimmed.startsWith('turns:')) {
          const val = trimmed.replace('turns:', '').trim();
          turns = val ? parseInt(val) : null;
        } else if (trimmed.startsWith('latitude:')) {
          const val = trimmed.replace('latitude:', '').trim();
          lat = val ? parseFloat(val) : null;
        } else if (trimmed.startsWith('longitude:')) {
          const val = trimmed.replace('longitude:', '').trim();
          long = val ? parseFloat(val) : null;
        } else if (trimmed.startsWith('placeName:')) {
          locality = trimmed.replace('placeName:', '').trim().replace(/^["']|["']$/g, '');
        } else if (trimmed.startsWith('countryId:')) {
          country = trimmed.replace('countryId:', '').trim().replace(/^["']|["']$/g, '');
        } else if (trimmed.startsWith('direction:')) {
          direction = trimmed.replace('direction:', '').trim().replace(/^["']|["']$/g, '');
        }
      }

      // 如果name为空，使用文件名
      if (!name) {
        name = file.replace('.yml', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }

      allCircuits[circuitId] = {
        name,
        locality: locality || null,
        country: country || null,
        lat,
        long,
        length,
        turns,
        direction: direction || null,
      };
    } catch (error) {
      console.error(`❌ 解析失败 ${file}:`, (error as Error).message);
    }
  }

  // 1.2 合并扩展数据（使用别名映射）
  console.log('   合并扩展数据...');
  for (const [extraId, extra] of Object.entries({ ...circuitExtraData, ...historicalCircuits })) {
    // 查找匹配的f1db赛道ID
    let matchedCircuitId = extraId;

    // 如果扩展数据ID不在allCircuits中，尝试通过别名匹配
    if (!allCircuits[extraId]) {
      // 查找别名
      for (const [f1dbId, aliasId] of Object.entries(circuitIdAliases)) {
        if (aliasId === extraId && allCircuits[f1dbId]) {
          matchedCircuitId = f1dbId;
          break;
        }
      }
    }

    if (allCircuits[matchedCircuitId]) {
      allCircuits[matchedCircuitId] = { ...allCircuits[matchedCircuitId], ...extra };
    } else {
      // 如果基础数据没有，手动创建
      allCircuits[extraId] = {
        name: extraId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        ...extra
      };
    }
  }

  // 1.3 一次性插入所有数据
  console.log(`   总共 ${Object.keys(allCircuits).length} 条赛道，开始导入...`);
  let successCount = 0;

  for (const [circuitId, data] of Object.entries(allCircuits)) {
    try {
      const { error } = await supabase.from('circuits').upsert({
        circuit_id: circuitId,
        ...data,
      });

      if (error) {
        console.log(`⚠️ ${circuitId}: ${error.message}`);
      } else {
        successCount++;
      }
    } catch (error) {
      console.log(`⚠️ ${circuitId}: ${(error as Error).message}`);
    }
  }

  console.log(`\n✅ 成功导入 ${successCount} 条赛道数据（含扩展信息）`);
  console.log('\n🏁 赛道完整数据导入完成！');
  return { successCount };
}

async function main() {
  console.log('🎉 开始导入完整赛道数据到Supabase...');
  console.log('='.repeat(60));

  await importCircuitsFull();

  console.log('\n' + '='.repeat(60));
  console.log('✅ 所有赛道数据导入完成！');
}

main().catch(console.error);