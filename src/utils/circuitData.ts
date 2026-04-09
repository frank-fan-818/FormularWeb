// 从f1db获取赛道详细信息（静态集成，无外部依赖）
export const getCircuitDetails = async (circuitId: string) => {
  // 所有赛道数据已静态集成，直接返回
  const circuitData: Record<string, any> = {
    // 亚洲 & 中东
    shanghai: {
      firstRace: 2004,
      lapRecord: '1:31.095',
      lapRecordDriver: 'Michael Schumacher',
      lapRecordYear: 2004,
      totalRaces: 18,
      raceLaps: 56,
      totalDistance: '305.269 km'
    },
    suzuka: {
      firstRace: 1987,
      lapRecord: '1:30.983',
      lapRecordDriver: 'Lewis Hamilton',
      lapRecordYear: 2019,
      totalRaces: 36,
      raceLaps: 53,
      totalDistance: '307.471 km'
    },
    bahrain: {
      firstRace: 2004,
      lapRecord: '1:31.447',
      lapRecordDriver: 'Pedro de la Rosa',
      lapRecordYear: 2005,
      totalRaces: 20,
      raceLaps: 57,
      totalDistance: '308.238 km'
    },
    yas_marina: {
      firstRace: 2009,
      lapRecord: '1:26.103',
      lapRecordDriver: 'Max Verstappen',
      lapRecordYear: 2021,
      totalRaces: 15,
      raceLaps: 58,
      totalDistance: '306.183 km'
    },
    jeddah: {
      firstRace: 2021,
      lapRecord: '1:28.165',
      lapRecordDriver: 'Lewis Hamilton',
      lapRecordYear: 2021,
      totalRaces: 4,
      raceLaps: 50,
      totalDistance: '308.450 km'
    },
    lusail: {
      firstRace: 2021,
      lapRecord: '1:20.951',
      lapRecordDriver: 'Max Verstappen',
      lapRecordYear: 2023,
      totalRaces: 3,
      raceLaps: 57,
      totalDistance: '308.610 km'
    },
    marina_bay: {
      firstRace: 2008,
      lapRecord: '1:41.905',
      lapRecordDriver: 'Kevin Magnussen',
      lapRecordYear: 2018,
      totalRaces: 14,
      raceLaps: 62,
      totalDistance: '308.706 km'
    },
    sepang: {
      firstRace: 1999,
      lapRecord: '1:34.080',
      lapRecordDriver: 'Juan Pablo Montoya',
      lapRecordYear: 2004,
      totalRaces: 18,
      raceLaps: 56,
      totalDistance: '310.408 km'
    },
    yeongam: {
      firstRace: 2010,
      lapRecord: '1:39.605',
      lapRecordDriver: 'Sebastian Vettel',
      lapRecordYear: 2011,
      totalRaces: 4,
      raceLaps: 55,
      totalDistance: '308.630 km'
    },
    buddha: {
      firstRace: 2011,
      lapRecord: '1:27.249',
      lapRecordDriver: 'Sebastian Vettel',
      lapRecordYear: 2011,
      totalRaces: 3,
      raceLaps: 60,
      totalDistance: '308.428 km'
    },

    // 欧洲
    monza: {
      firstRace: 1950,
      lapRecord: '1:21.046',
      lapRecordDriver: 'Rubens Barrichello',
      lapRecordYear: 2004,
      totalRaces: 73,
      raceLaps: 53,
      totalDistance: '306.720 km'
    },
    monaco: {
      firstRace: 1950,
      lapRecord: '1:12.909',
      lapRecordDriver: 'Lewis Hamilton',
      lapRecordYear: 2021,
      totalRaces: 79,
      raceLaps: 78,
      totalDistance: '260.286 km'
    },
    monaco_circuit: {
      firstRace: 1950,
      lapRecord: '1:12.909',
      lapRecordDriver: 'Lewis Hamilton',
      lapRecordYear: 2021,
      totalRaces: 79,
      raceLaps: 78,
      totalDistance: '260.286 km'
    },
    silverstone: {
      firstRace: 1950,
      lapRecord: '1:27.097',
      lapRecordDriver: 'Max Verstappen',
      lapRecordYear: 2020,
      totalRaces: 57,
      raceLaps: 52,
      totalDistance: '306.198 km'
    },
    spa: {
      firstRace: 1950,
      lapRecord: '1:41.252',
      lapRecordDriver: 'Valtteri Bottas',
      lapRecordYear: 2018,
      totalRaces: 66,
      raceLaps: 44,
      totalDistance: '308.052 km'
    },
    catalunya: {
      firstRace: 1991,
      lapRecord: '1:18.149',
      lapRecordDriver: 'Max Verstappen',
      lapRecordYear: 2023,
      totalRaces: 33,
      raceLaps: 66,
      totalDistance: '307.104 km'
    },
    imola: {
      firstRace: 1980,
      lapRecord: '1:15.484',
      lapRecordDriver: 'Lewis Hamilton',
      lapRecordYear: 2020,
      totalRaces: 29,
      raceLaps: 63,
      totalDistance: '309.049 km'
    },
    red_bull_ring: {
      firstRace: 1970,
      lapRecord: '1:05.619',
      lapRecordDriver: 'Carlos Sainz',
      lapRecordYear: 2020,
      totalRaces: 35,
      raceLaps: 71,
      totalDistance: '306.452 km'
    },
    hungaroring: {
      firstRace: 1986,
      lapRecord: '1:16.627',
      lapRecordDriver: 'Lewis Hamilton',
      lapRecordYear: 2020,
      totalRaces: 38,
      raceLaps: 70,
      totalDistance: '306.630 km'
    },
    zandvoort: {
      firstRace: 1952,
      lapRecord: '1:11.097',
      lapRecordDriver: 'Lewis Hamilton',
      lapRecordYear: 2021,
      totalRaces: 32,
      raceLaps: 72,
      totalDistance: '306.587 km'
    },
    spa_francorchamps: {
      firstRace: 1950,
      lapRecord: '1:41.252',
      lapRecordDriver: 'Valtteri Bottas',
      lapRecordYear: 2018,
      totalRaces: 66,
      raceLaps: 44,
      totalDistance: '308.052 km'
    },
    hockenheimring: {
      firstRace: 1970,
      lapRecord: '1:13.780',
      lapRecordDriver: 'Kimi Räikkönen',
      lapRecordYear: 2004,
      totalRaces: 37,
      raceLaps: 67,
      totalDistance: '306.458 km'
    },
    nurburgring: {
      firstRace: 1951,
      lapRecord: '1:28.139',
      lapRecordDriver: 'Max Verstappen',
      lapRecordYear: 2020,
      totalRaces: 40,
      raceLaps: 60,
      totalDistance: '308.329 km'
    },
    magny_cours: {
      firstRace: 1991,
      lapRecord: '1:15.377',
      lapRecordDriver: 'Michael Schumacher',
      lapRecordYear: 2004,
      totalRaces: 18,
      raceLaps: 70,
      totalDistance: '308.586 km'
    },
    paul_ricard: {
      firstRace: 1971,
      lapRecord: '1:32.740',
      lapRecordDriver: 'Valtteri Bottas',
      lapRecordYear: 2019,
      totalRaces: 18,
      raceLaps: 53,
      totalDistance: '309.690 km'
    },
    estoril: {
      firstRace: 1984,
      lapRecord: '1:14.859',
      lapRecordDriver: 'Ralf Schumacher',
      lapRecordYear: 2002,
      totalRaces: 13,
      raceLaps: 71,
      totalDistance: '307.770 km'
    },
    istanbul: {
      firstRace: 2005,
      lapRecord: '1:24.770',
      lapRecordDriver: 'Juan Pablo Montoya',
      lapRecordYear: 2005,
      totalRaces: 8,
      raceLaps: 58,
      totalDistance: '309.396 km'
    },
    baku: {
      firstRace: 2016,
      lapRecord: '1:43.009',
      lapRecordDriver: 'Charles Leclerc',
      lapRecordYear: 2019,
      totalRaces: 7,
      raceLaps: 51,
      totalDistance: '306.049 km'
    },
    valencia: {
      firstRace: 2008,
      lapRecord: '1:38.683',
      lapRecordDriver: 'Timo Glock',
      lapRecordYear: 2009,
      totalRaces: 5,
      raceLaps: 57,
      totalDistance: '308.883 km'
    },

    // 美洲
    interlagos: {
      firstRace: 1973,
      lapRecord: '1:10.540',
      lapRecordDriver: 'Valtteri Bottas',
      lapRecordYear: 2018,
      totalRaces: 48,
      raceLaps: 71,
      totalDistance: '305.909 km'
    },
    mexico_city: {
      firstRace: 1963,
      lapRecord: '1:17.774',
      lapRecordDriver: 'Valtteri Bottas',
      lapRecordYear: 2021,
      totalRaces: 22,
      raceLaps: 71,
      totalDistance: '305.354 km'
    },
    austin: {
      firstRace: 2012,
      lapRecord: '1:36.169',
      lapRecordDriver: 'Charles Leclerc',
      lapRecordYear: 2022,
      totalRaces: 10,
      raceLaps: 56,
      totalDistance: '308.405 km'
    },
    miami: {
      firstRace: 2022,
      lapRecord: '1:29.708',
      lapRecordDriver: 'Max Verstappen',
      lapRecordYear: 2023,
      totalRaces: 3,
      raceLaps: 57,
      totalDistance: '308.326 km'
    },
    las_vegas: {
      firstRace: 1981,
      lapRecord: '1:35.498',
      lapRecordDriver: 'Oscar Piastri',
      lapRecordYear: 2023,
      totalRaces: 2,
      raceLaps: 50,
      totalDistance: '305.888 km'
    },
    montreal: {
      firstRace: 1978,
      lapRecord: '1:13.078',
      lapRecordDriver: 'Valtteri Bottas',
      lapRecordYear: 2019,
      totalRaces: 42,
      raceLaps: 70,
      totalDistance: '305.270 km'
    },
    indianapolis: {
      firstRace: 2000,
      lapRecord: '1:10.399',
      lapRecordDriver: 'Rubens Barrichello',
      lapRecordYear: 2004,
      totalRaces: 8,
      raceLaps: 73,
      totalDistance: '306.016 km'
    },
    watkins_glen: {
      firstRace: 1961,
      lapRecord: '1:32.931',
      lapRecordDriver: 'Jackie Stewart',
      lapRecordYear: 1973,
      totalRaces: 20,
      raceLaps: 59,
      totalDistance: '386.820 km'
    },
    long_beach: {
      firstRace: 1976,
      lapRecord: '1:19.939',
      lapRecordDriver: 'Niki Lauda',
      lapRecordYear: 1977,
      totalRaces: 8,
      raceLaps: 80,
      totalDistance: '253.920 km'
    },

    // 大洋洲
    melbourne: {
      firstRace: 1996,
      lapRecord: '1:17.868',
      lapRecordDriver: 'Michael Schumacher',
      lapRecordYear: 2004,
      totalRaces: 26,
      raceLaps: 58,
      totalDistance: '306.124 km'
    }
  };

  const circuit = circuitData[circuitId];
  if (!circuit) return null;

  return {
    ...circuit,
    // 确保格式一致
    length: circuit.length ? `${circuit.length} km` : '未知'
  };
}
