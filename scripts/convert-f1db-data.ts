import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

// 读取f1db数据
const F1DB_PATH = path.join(__dirname, '..', 'f1db-main', 'src', 'data');
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_PATH)) {
  fs.mkdirSync(OUTPUT_PATH, { recursive: true });
}

// 转换赛道数据
function convertCircuits() {
  const circuitsDir = path.join(F1DB_PATH, 'circuits');
  const circuitFiles = fs.readdirSync(circuitsDir).filter(f => f.endsWith('.yml'));
  
  const circuits: Record<string, any> = {};
  
  circuitFiles.forEach(file => {
    const content = fs.readFileSync(path.join(circuitsDir, file), 'utf-8');
    const data = yaml.parse(content);
    const circuitId = file.replace('.yml', '').replace(/-/g, '_');
    circuits[circuitId] = data;
  });
  
  // 输出到文件
  fs.writeFileSync(
    path.join(OUTPUT_PATH, 'circuits.ts'),
    `export const circuitsData = ${JSON.stringify(circuits, null, 2)} as const;\n`
  );
  
  console.log(`✓ 转换了 ${Object.keys(circuits).length} 条赛道数据`);
  return circuits;
}

// 转换车手数据
function convertDrivers() {
  const driversDir = path.join(F1DB_PATH, 'drivers');
  const driverFiles = fs.readdirSync(driversDir).filter(f => f.endsWith('.yml'));
  
  const drivers: Record<string, any> = {};
  
  driverFiles.forEach(file => {
    const content = fs.readFileSync(path.join(driversDir, file), 'utf-8');
    const data = yaml.parse(content);
    const driverId = file.replace('.yml', '').replace(/-/g, '_');
    drivers[driverId] = data;
  });
  
  fs.writeFileSync(
    path.join(OUTPUT_PATH, 'drivers.ts'),
    `export const driversData = ${JSON.stringify(drivers, null, 2)} as const;\n`
  );
  
  console.log(`✓ 转换了 ${Object.keys(drivers).length} 条车手数据`);
  return drivers;
}

// 转换车队数据
function convertConstructors() {
  const constructorsDir = path.join(F1DB_PATH, 'constructors');
  const constructorFiles = fs.readdirSync(constructorsDir).filter(f => f.endsWith('.yml'));
  
  const constructors: Record<string, any> = {};
  
  constructorFiles.forEach(file => {
    const content = fs.readFileSync(path.join(constructorsDir, file), 'utf-8');
    const data = yaml.parse(content);
    const constructorId = file.replace('.yml', '').replace(/-/g, '_');
    constructors[constructorId] = data;
  });
  
  fs.writeFileSync(
    path.join(OUTPUT_PATH, 'constructors.ts'),
    `export const constructorsData = ${JSON.stringify(constructors, null, 2)} as const;\n`
  );
  
  console.log(`✓ 转换了 ${Object.keys(constructors).length} 条车队数据`);
  return constructors;
}

// 创建统一的导出文件
function createIndexFile() {
  const content = `export * from './circuits';
export * from './drivers';
export * from './constructors';
`;
  
  fs.writeFileSync(path.join(OUTPUT_PATH, 'index.ts'), content);
  console.log('✓ 创建了数据导出文件');
}

// 主函数
function main() {
  try {
    console.log('开始转换f1db数据...\n');
    
    convertCircuits();
    convertDrivers();
    convertConstructors();
    createIndexFile();
    
    console.log('\n🎉 数据转换完成！所有f1db数据已集成到代码中。');
    console.log('数据位置：src/data/');
  } catch (error) {
    console.error('转换失败:', error);
    process.exit(1);
  }
}

main();
