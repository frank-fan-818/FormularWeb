import { supabase } from './src/utils/supabase.ts';

async function testImport() {
  // 测试插入一条赛道数据
  const testData = {
    circuit_id: 'test_circuit',
    name: '测试赛道',
    country: '中国',
    first_race: 2024
  };

  const { data, error } = await supabase.from('circuits').insert(testData);
  
  if (error) {
    console.error('插入失败，错误原因:', error.message);
    console.log('请检查：1. 数据库中是否已经创建了circuits表 2. 表字段是否和插入数据匹配');
  } else {
    console.log('✅ 插入成功！数据库连接和表结构正常');
  }
}

testImport();
