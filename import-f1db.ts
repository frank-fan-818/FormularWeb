import { supabase } from './src/utils/supabase.ts';

// 导入比赛和结果数据（导入2025/2026赛季完整赛历）
async function importRacesAndResults() {
  console.log('\n🚀 开始导入比赛数据...');

  // 使用我们已经完善的2026赛季赛历数据
  const races2026 = [
    {
      season: 2026, round: 1, race_name: '巴林大奖赛', circuit_id: 'bahrain', date: '2026-03-01', is_sprint_weekend: false
    },
    {
      season: 2026, round: 2, race_name: '沙特阿拉伯大奖赛', circuit_id: 'jeddah_corniche', date: '2026-03-08', is_sprint_weekend: false
    },
    {
      season: 2026, round: 3, race_name: '澳大利亚大奖赛', circuit_id: 'albert_park', date: '2026-03-22', is_sprint_weekend: false
    },
    {
      season: 2026, round: 4, race_name: '日本大奖赛', circuit_id: 'suzuka', date: '2026-04-05', is_sprint_weekend: false
    },
    {
      season: 2026, round: 5, race_name: '中国大奖赛', circuit_id: 'shanghai', date: '2026-04-19', is_sprint_weekend: true
    },
    {
      season: 2026, round: 6, race_name: '迈阿密大奖赛', circuit_id: 'miami', date: '2026-05-04', is_sprint_weekend: false
    },
    {
      season: 2026, round: 7, race_name: '伊莫拉大奖赛', circuit_id: 'imola', date: '2026-05-18', is_sprint_weekend: false
    },
    {
      season: 2026, round: 8, race_name: '摩纳哥大奖赛', circuit_id: 'monaco', date: '2026-05-25', is_sprint_weekend: false
    },
    {
      season: 2026, round: 9, race_name: '西班牙大奖赛', circuit_id: 'catalunya', date: '2026-06-08', is_sprint_weekend: false
    },
    {
      season: 2026, round: 10, race_name: '加拿大大奖赛', circuit_id: 'villeneuve', date: '2026-06-15', is_sprint_weekend: false
    },
    {
      season: 2026, round: 11, race_name: '奥地利大奖赛', circuit_id: 'red_bull_ring', date: '2026-06-29', is_sprint_weekend: true
    },
    {
      season: 2026, round: 12, race_name: '英国大奖赛', circuit_id: 'silverstone', date: '2026-07-06', is_sprint_weekend: false
    },
    {
      season: 2026, round: 13, race_name: '匈牙利大奖赛', circuit_id: 'hungaroring', date: '2026-07-20', is_sprint_weekend: false
    },
    {
      season: 2026, round: 14, race_name: '比利时大奖赛', circuit_id: 'spa', date: '2026-07-27', is_sprint_weekend: false
    },
    {
      season: 2026, round: 15, race_name: '荷兰大奖赛', circuit_id: 'zandvoort', date: '2026-08-31', is_sprint_weekend: false
    },
    {
      season: 2026, round: 16, race_name: '意大利大奖赛', circuit_id: 'monza', date: '2026-09-07', is_sprint_weekend: false
    },
    {
      season: 2026, round: 17, race_name: '阿塞拜疆大奖赛', circuit_id: 'baku', date: '2026-09-21', is_sprint_weekend: true
    },
    {
      season: 2026, round: 18, race_name: '新加坡大奖赛', circuit_id: 'marina_bay', date: '2026-09-28', is_sprint_weekend: false
    },
    {
      season: 2026, round: 19, race_name: '美国大奖赛', circuit_id: 'austin', date: '2026-10-12', is_sprint_weekend: false
    },
    {
      season: 2026, round: 20, race_name: '墨西哥大奖赛', circuit_id: 'rodriguez', date: '2026-10-26', is_sprint_weekend: false
    },
    {
      season: 2026, round: 21, race_name: '圣保罗大奖赛', circuit_id: 'interlagos', date: '2026-11-02', is_sprint_weekend: true
    },
    {
      season: 2026, round: 22, race_name: '拉斯维加斯大奖赛', circuit_id: 'las_vegas', date: '2026-11-23', is_sprint_weekend: false
    },
    {
      season: 2026, round: 23, race_name: '卡塔尔大奖赛', circuit_id: 'losail', date: '2026-11-30', is_sprint_weekend: false
    },
    {
      season: 2026, round: 24, race_name: '阿布扎比大奖赛', circuit_id: 'yas_marina', date: '2026-12-08', is_sprint_weekend: false
    }
  ];

  let raceSuccessCount = 0;
  let resultSuccessCount = 0;

  for (const race of races2026) {
    try {
      // 插入比赛数据
      const { data: insertedRace, error: raceError } = await supabase
        .from('races')
        .upsert(race)
        .select()
        .single();

      if (raceError) throw raceError;
      raceSuccessCount++;
      console.log(`✅ 导入比赛: ${race.race_name}`);

      // 这里可以继续导入比赛结果和排位赛数据，用模拟数据填充
      // 生成20位车手的模拟成绩
      const mockResults = [];
      const mockQualifying = [];
      const driverIds = [
        'max_verstappen', 'leclerc', 'russell', 'sainz', 'perez', 'norris', 'piastri',
        'hamilton', 'alonso', 'stroll', 'ocon', 'gasly', 'hulkenberg', 'magnussen',
        'tsunoda', 'hadjar', 'bottas', 'zhou', 'sargeant', 'colapinto'
      ];

      const constructorIds = [
        'red_bull', 'ferrari', 'mercedes', 'ferrari', 'red_bull', 'mclaren', 'mclaren',
        'ferrari', 'aston_martin', 'aston_martin', 'alpine', 'alpine', 'haas', 'haas',
        'rb', 'rb', 'kick_sauber', 'kick_sauber', 'williams', 'williams'
      ];

      for (let i = 0; i < 20; i++) {
        // 正赛结果
        mockResults.push({
          race_id: insertedRace.id,
          driver_id: driverIds[i],
          constructor_id: constructorIds[i],
          position: i + 1,
          grid_position: Math.floor(Math.random() * 20) + 1,
          points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0][i],
          laps: race.circuit_id === 'monaco' ? 78 : 56,
          status: 'Finished',
          time: i === 0 ? '1:32:45.123' : `+${(i * 1.2 + Math.random() * 2).toFixed(3)}`,
          fastest_lap_time: `1:${(30 + i * 0.5).toFixed(3)}`,
          fastest_lap_rank: i + 1
        });

        // 排位赛结果
        mockQualifying.push({
          race_id: insertedRace.id,
          driver_id: driverIds[i],
          constructor_id: constructorIds[i],
          position: i + 1,
          q1_time: `1:${(32 + i * 0.3).toFixed(3)}`,
          q2_time: i < 15 ? `1:${(31 + i * 0.25).toFixed(3)}` : null,
          q3_time: i < 10 ? `1:${(30 + i * 0.2).toFixed(3)}` : null
        });
      }

      // 批量插入结果
      const { error: resultError } = await supabase.from('race_results').insert(mockResults);
      const { error: qualifyingError } = await supabase.from('qualifying_results').insert(mockQualifying);

      if (!resultError) resultSuccessCount += mockResults.length;
      if (!qualifyingError) resultSuccessCount += mockQualifying.length;

    } catch (error) {
      console.error(`❌ 导入比赛失败 ${race.race_name}:`, (error as Error).message);
    }
  }

  console.log(`\n🏁 比赛数据导入完成：成功 ${raceSuccessCount} 场比赛，${resultSuccessCount} 条结果数据`);
  return { raceSuccessCount, resultSuccessCount };
}

// 主函数
async function main() {
  console.log('🎉 开始导入比赛和结果数据到Supabase...');
  console.log('='.repeat(60));

  // 只导入比赛和结果数据
  await importRacesAndResults();

  console.log('\n' + '='.repeat(60));
  console.log('✅ 比赛数据导入完成！');
  console.log('现在可以在Supabase后台查看所有比赛和结果数据了~');
}

main().catch(console.error);
