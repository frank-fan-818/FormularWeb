import { supabase } from './src/utils/supabase.ts';

async function testConnection() {
  console.log('正在测试Supabase连接...');
  
  try {
    // 测试简单查询
    const { data, error } = await supabase.from('circuits').select('count');
    
    if (error) {
      console.error('连接失败:', error.message);
      console.log('请检查：1. 数据库表是否已创建 2. API密钥是否正确 3. 网络是否正常');
      return false;
    }
    
    console.log('✅ 连接成功！Supabase正常工作');
    console.log('查询结果:', data);
    return true;
  } catch (error) {
    console.error('连接异常:', error);
    return false;
  }
}

testConnection();
