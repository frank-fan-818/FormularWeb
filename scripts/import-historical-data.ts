import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

// 加载环境变量（运行时在项目根目录，直接加载.env）
dotenv.config();

// 初始化Supabase客户端
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Ergast API客户端
const ergastApi = axios.create({
  baseURL: 'https://ergast.com/api/f1',
  timeout: 30000,
});

// 导入的截止赛季
const MAX_SEASON = 2025;

// 延时函数，避免API限流
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 导入赛季列表
 */
async function importSeasons() {
  console.log('📥 导入赛季列表...');
  
  try {
    const response = await ergastApi.get('/seasons.json?limit=100');
    const seasons = response.data.MRData.SeasonTable.Seasons;
    
    // 只导入MAX_SEASON及以前的赛季
    const filteredSeasons = seasons
      .filter((s: any) => parseInt(s.season) <= MAX_SEASON)
      .map((s: any) => ({
        year: parseInt(s.season),
        url: s.url
      }));

    // 清空现有数据
    await supabase.from('seasons').delete().lt('year', MAX_SEASON + 1);
    
    // 插入新数据
    const { error } = await supabase.from('seasons').insert(filteredSeasons);
    
    if (error) {
      console.error('❌ 导入赛季失败:', error);
      return false;
    }
    
    console.log(`✅ 成功导入 ${filteredSeasons.length} 个赛季`);
    return true;
  } catch (error) {
    console.error('❌ 导入赛季失败:', error);
    return false;
  }
}

/**
 * 导入所有车手
 */
async function importDrivers() {
  console.log('📥 导入车手列表...');
  
  try {
    const response = await ergastApi.get('/drivers.json?limit=1000');
    const drivers = response.data.MRData.DriverTable.Drivers;
    
    const formattedDrivers = drivers.map((d: any) => ({
      driver_id: d.driverId,
      first_name: d.givenName,
      last_name: d.familyName,
      code: d.code,
      permanent_number: d.permanentNumber,
      nationality: d.nationality,
      date_of_birth: d.dateOfBirth,
      url: d.url
    }));

    // 清空现有数据
    await supabase.from('drivers').delete().neq('driver_id', '');
    
    // 插入新数据
    const { error } = await supabase.from('drivers').insert(formattedDrivers);
    
    if (error) {
      console.error('❌ 导入车手失败:', error);
      return false;
    }
    
    console.log(`✅ 成功导入 ${formattedDrivers.length} 位车手`);
    return true;
  } catch (error) {
    console.error('❌ 导入车手失败:', error);
    return false;
  }
}

/**
 * 导入所有车队
 */
async function importConstructors() {
  console.log('📥 导入车队列表...');
  
  try {
    const response = await ergastApi.get('/constructors.json?limit=200');
    const constructors = response.data.MRData.ConstructorTable.Constructors;
    
    const formattedConstructors = constructors.map((c: any) => ({
      constructor_id: c.constructorId,
      name: c.name,
      nationality: c.nationality,
      url: c.url
    }));

    // 清空现有数据
    await supabase.from('constructors').delete().neq('constructor_id', '');
    
    // 插入新数据
    const { error } = await supabase.from('constructors').insert(formattedConstructors);
    
    if (error) {
      console.error('❌ 导入车队失败:', error);
      return false;
    }
    
    console.log(`✅ 成功导入 ${formattedConstructors.length} 支车队`);
    return true;
  } catch (error) {
    console.error('❌ 导入车队失败:', error);
    return false;
  }
}

/**
 * 导入指定赛季的赛历
 */
async function importSeasonRaces(season: number) {
  console.log(`📥 导入 ${season} 赛季赛历...`);
  
  try {
    const response = await ergastApi.get(`/${season}.json`);
    const races = response.data.MRData.RaceTable.Races;
    
    const formattedRaces = races.map((r: any) => ({
      season,
      round: parseInt(r.round),
      race_name: r.raceName,
      circuit_id: r.Circuit.circuitId,
      date: r.date,
      time: r.time,
      url: r.url,
      locality: r.Circuit.Location.locality,
      country: r.Circuit.Location.country
    }));

    // 删除该赛季现有数据
    await supabase.from('races').delete().eq('season', season);
    
    // 插入新数据
    const { data, error } = await supabase
      .from('races')
      .insert(formattedRaces)
      .select('id, round');
    
    if (error) {
      console.error(`❌ 导入 ${season} 赛季赛历失败:`, error);
      return null;
    }
    
    // 创建round到id的映射
    const raceIdMap = new Map(data.map(r => [r.round, r.id]));
    console.log(`✅ 成功导入 ${season} 赛季 ${formattedRaces.length} 场比赛`);
    return raceIdMap;
  } catch (error) {
    console.error(`❌ 导入 ${season} 赛季赛历失败:`, error);
    return null;
  }
}

/**
 * 导入指定赛季的比赛结果
 */
async function importRaceResults(season: number, raceIdMap: Map<number, number>) {
  console.log(`📥 导入 ${season} 赛季比赛结果...`);
  
  for (const [round, raceId] of raceIdMap) {
    try {
      const response = await ergastApi.get(`/${season}/${round}/results.json?limit=50`);
      const results = response.data.MRData.RaceTable.Races[0]?.Results || [];
      
      const formattedResults = results.map((r: any, index: number) => ({
        race_id: raceId,
        position: parseInt(r.position),
        position_text: r.positionText,
        points: parseFloat(r.points),
        driver_id: r.Driver.driverId,
        constructor_id: r.Constructor.constructorId,
        grid: parseInt(r.grid),
        laps: parseInt(r.laps),
        status: r.status,
        time: r.Time?.time,
        time_millis: r.Time?.millis ? parseInt(r.Time.millis) : null,
        fastest_lap_rank: r.FastestLap?.rank ? parseInt(r.FastestLap.rank) : null,
        fastest_lap_time: r.FastestLap?.Time?.time,
        fastest_lap_speed: r.FastestLap?.AverageSpeed?.speed ? parseFloat(r.FastestLap.AverageSpeed.speed) : null
      }));

      // 删除该比赛现有结果
      await supabase.from('race_results').delete().eq('race_id', raceId);
      
      // 插入新数据
      const { error } = await supabase.from('race_results').insert(formattedResults);
      
      if (error) {
        console.error(`❌ 导入 ${season} 赛季第 ${round} 轮比赛结果失败:`, error);
        continue;
      }
      
      console.log(`✅ 成功导入 ${season} 赛季第 ${round} 轮比赛结果，共 ${formattedResults.length} 条`);
      await delay(1000); // 避免API限流
    } catch (error) {
      console.error(`❌ 导入 ${season} 赛季第 ${round} 轮比赛结果失败:`, error);
      await delay(2000);
    }
  }
}

/**
 * 导入指定赛季的排位赛结果
 */
async function importQualifyingResults(season: number, raceIdMap: Map<number, number>) {
  console.log(`📥 导入 ${season} 赛季排位赛结果...`);
  
  for (const [round, raceId] of raceIdMap) {
    try {
      const response = await ergastApi.get(`/${season}/${round}/qualifying.json?limit=50`);
      const results = response.data.MRData.RaceTable.Races[0]?.QualifyingResults || [];
      
      const formattedResults = results.map((r: any) => ({
        race_id: raceId,
        position: parseInt(r.position),
        driver_id: r.Driver.driverId,
        constructor_id: r.Constructor.constructorId,
        q1: r.Q1,
        q2: r.Q2,
        q3: r.Q3
      }));

      // 删除该比赛现有排位赛结果
      await supabase.from('qualifying_results').delete().eq('race_id', raceId);
      
      // 插入新数据
      const { error } = await supabase.from('qualifying_results').insert(formattedResults);
      
      if (error) {
        console.error(`❌ 导入 ${season} 赛季第 ${round} 轮排位赛结果失败:`, error);
        continue;
      }
      
      console.log(`✅ 成功导入 ${season} 赛季第 ${round} 轮排位赛结果，共 ${formattedResults.length} 条`);
      await delay(1000); // 避免API限流
    } catch (error) {
      console.error(`❌ 导入 ${season} 赛季第 ${round} 轮排位赛结果失败:`, error);
      await delay(2000);
    }
  }
}

/**
 * 主导入函数
 */
async function main() {
  console.log('🚀 开始导入F1历史数据到Supabase...');
  console.log(`📅 导入截止赛季: ${MAX_SEASON}`);
  
  // 1. 导入基础数据
  const successSeasons = await importSeasons();
  const successDrivers = await importDrivers();
  const successConstructors = await importConstructors();
  
  if (!successSeasons || !successDrivers || !successConstructors) {
    console.error('❌ 基础数据导入失败，终止执行');
    process.exit(1);
  }
  
  // 2. 逐年导入赛历和比赛结果
  for (let season = 1950; season <= MAX_SEASON; season++) {
    console.log(`\n====================================`);
    console.log(`处理 ${season} 赛季`);
    console.log(`====================================`);
    
    const raceIdMap = await importSeasonRaces(season);
    if (!raceIdMap) continue;
    
    await importRaceResults(season, raceIdMap);
    await importQualifyingResults(season, raceIdMap);
    
    console.log(`✅ ${season} 赛季导入完成`);
    await delay(5000); // 每个赛季间隔5秒，避免API限流
  }
  
  console.log('\n🎉 所有历史数据导入完成！');
  console.log('✅ 已导入 1950 -', MAX_SEASON, '赛季的所有数据');
}

// 执行导入
main().catch(console.error);