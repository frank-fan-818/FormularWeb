import { supabase } from './src/utils/supabase.ts';

async function testDriverImport() {
  // 测试插入一条车手数据
  const testDriver = {
    driver_id: 'test_driver',
    first_name: '测试',
    last_name: '车手',
    nationality: '中国',
    date_of_birth: '1990-01-01'
  };

  const { data, error } = await supabase.from('drivers').insert(testDriver);
  
  if (error) {
    console.error('车手插入失败:', error.message);
    console.log('错误详情:', error);
  } else {
    console.log('✅ 车手插入成功！车手表结构正常');
  }
}

testDriverImport();
