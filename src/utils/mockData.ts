import type { ErgastResponse, Season, DriverStanding, ConstructorStanding, Race, Driver, Constructor, Circuit } from '@/types';

// 模拟赛季数据
const mockSeasons: Season[] = Array.from({ length: 30 }, (_, i) => ({
  season: (2025 - i).toString(),
  url: '#'
}));

// 模拟完整20位车手积分榜
const mockDriverStandings: DriverStanding[] = [
  {
    position: '1',
    positionText: '1',
    points: '410',
    wins: '12',
    Driver: {
      driverId: 'max_verstappen',
      permanentNumber: '1',
      code: 'VER',
      url: '#',
      givenName: 'Max',
      familyName: 'Verstappen',
      dateOfBirth: '1997-09-30',
      nationality: 'Dutch'
    },
    Constructors: [{
      constructorId: 'red_bull',
      url: '#',
      name: 'Red Bull Racing',
      nationality: 'Austrian'
    }]
  },
  {
    position: '2',
    positionText: '2',
    points: '294',
    wins: '3',
    Driver: {
      driverId: 'leclerc',
      permanentNumber: '16',
      code: 'LEC',
      url: '#',
      givenName: 'Charles',
      familyName: 'Leclerc',
      dateOfBirth: '1997-10-16',
      nationality: 'Monegasque'
    },
    Constructors: [{
      constructorId: 'ferrari',
      url: '#',
      name: 'Ferrari',
      nationality: 'Italian'
    }]
  },
  {
    position: '3',
    positionText: '3',
    points: '278',
    wins: '2',
    Driver: {
      driverId: 'russell',
      permanentNumber: '63',
      code: 'RUS',
      url: '#',
      givenName: 'George',
      familyName: 'Russell',
      dateOfBirth: '1998-02-15',
      nationality: 'British'
    },
    Constructors: [{
      constructorId: 'mercedes',
      url: '#',
      name: 'Mercedes',
      nationality: 'German'
    }]
  },
  {
    position: '4',
    positionText: '4',
    points: '240',
    wins: '1',
    Driver: {
      driverId: 'sainz',
      permanentNumber: '55',
      code: 'SAI',
      url: '#',
      givenName: 'Carlos',
      familyName: 'Sainz',
      dateOfBirth: '1994-09-01',
      nationality: 'Spanish'
    },
    Constructors: [{
      constructorId: 'ferrari',
      url: '#',
      name: 'Ferrari',
      nationality: 'Italian'
    }]
  },
  {
    position: '5',
    positionText: '5',
    points: '214',
    wins: '0',
    Driver: {
      driverId: 'perez',
      permanentNumber: '11',
      code: 'PER',
      url: '#',
      givenName: 'Sergio',
      familyName: 'Perez',
      dateOfBirth: '1990-01-26',
      nationality: 'Mexican'
    },
    Constructors: [{
      constructorId: 'red_bull',
      url: '#',
      name: 'Red Bull Racing',
      nationality: 'Austrian'
    }]
  },
  {
    position: '6',
    positionText: '6',
    points: '205',
    wins: '0',
    Driver: {
      driverId: 'norris',
      permanentNumber: '4',
      code: 'NOR',
      url: '#',
      givenName: 'Lando',
      familyName: 'Norris',
      dateOfBirth: '1999-11-13',
      nationality: 'British'
    },
    Constructors: [{
      constructorId: 'mclaren',
      url: '#',
      name: 'McLaren',
      nationality: 'British'
    }]
  },
  {
    position: '7',
    positionText: '7',
    points: '198',
    wins: '0',
    Driver: {
      driverId: 'piastri',
      permanentNumber: '81',
      code: 'PIA',
      url: '#',
      givenName: 'Oscar',
      familyName: 'Piastri',
      dateOfBirth: '2001-04-06',
      nationality: 'Australian'
    },
    Constructors: [{
      constructorId: 'mclaren',
      url: '#',
      name: 'McLaren',
      nationality: 'British'
    }]
  },
  {
    position: '8',
    positionText: '8',
    points: '156',
    wins: '0',
    Driver: {
      driverId: 'hamilton',
      permanentNumber: '44',
      code: 'HAM',
      url: '#',
      givenName: 'Lewis',
      familyName: 'Hamilton',
      dateOfBirth: '1985-01-07',
      nationality: 'British'
    },
    Constructors: [{
      constructorId: 'ferrari',
      url: '#',
      name: 'Ferrari',
      nationality: 'Italian'
    }]
  },
  {
    position: '9',
    positionText: '9',
    points: '120',
    wins: '0',
    Driver: {
      driverId: 'alonso',
      permanentNumber: '14',
      code: 'ALO',
      url: '#',
      givenName: 'Fernando',
      familyName: 'Alonso',
      dateOfBirth: '1981-07-29',
      nationality: 'Spanish'
    },
    Constructors: [{
      constructorId: 'aston_martin',
      url: '#',
      name: 'Aston Martin',
      nationality: 'British'
    }]
  },
  {
    position: '10',
    positionText: '10',
    points: '87',
    wins: '0',
    Driver: {
      driverId: 'stroll',
      permanentNumber: '18',
      code: 'STR',
      url: '#',
      givenName: 'Lance',
      familyName: 'Stroll',
      dateOfBirth: '1998-10-29',
      nationality: 'Canadian'
    },
    Constructors: [{
      constructorId: 'aston_martin',
      url: '#',
      name: 'Aston Martin',
      nationality: 'British'
    }]
  },
  {
    position: '11',
    positionText: '11',
    points: '72',
    wins: '0',
    Driver: {
      driverId: 'ocon',
      permanentNumber: '31',
      code: 'OCO',
      url: '#',
      givenName: 'Esteban',
      familyName: 'Ocon',
      dateOfBirth: '1996-09-17',
      nationality: 'French'
    },
    Constructors: [{
      constructorId: 'alpine',
      url: '#',
      name: 'Alpine',
      nationality: 'French'
    }]
  },
  {
    position: '12',
    positionText: '12',
    points: '65',
    wins: '0',
    Driver: {
      driverId: 'gasly',
      permanentNumber: '10',
      code: 'GAS',
      url: '#',
      givenName: 'Pierre',
      familyName: 'Gasly',
      dateOfBirth: '1996-02-07',
      nationality: 'French'
    },
    Constructors: [{
      constructorId: 'alpine',
      url: '#',
      name: 'Alpine',
      nationality: 'French'
    }]
  },
  {
    position: '13',
    positionText: '13',
    points: '48',
    wins: '0',
    Driver: {
      driverId: 'hulkenberg',
      permanentNumber: '27',
      code: 'HUL',
      url: '#',
      givenName: 'Nico',
      familyName: 'Hulkenberg',
      dateOfBirth: '1987-08-19',
      nationality: 'German'
    },
    Constructors: [{
      constructorId: 'haas',
      url: '#',
      name: 'Haas F1 Team',
      nationality: 'American'
    }]
  },
  {
    position: '14',
    positionText: '14',
    points: '32',
    wins: '0',
    Driver: {
      driverId: 'magnussen',
      permanentNumber: '20',
      code: 'MAG',
      url: '#',
      givenName: 'Kevin',
      familyName: 'Magnussen',
      dateOfBirth: '1992-10-05',
      nationality: 'Danish'
    },
    Constructors: [{
      constructorId: 'haas',
      url: '#',
      name: 'Haas F1 Team',
      nationality: 'American'
    }]
  },
  {
    position: '15',
    positionText: '15',
    points: '28',
    wins: '0',
    Driver: {
      driverId: 'tsunoda',
      permanentNumber: '22',
      code: 'TSU',
      url: '#',
      givenName: 'Yuki',
      familyName: 'Tsunoda',
      dateOfBirth: '2000-05-11',
      nationality: 'Japanese'
    },
    Constructors: [{
      constructorId: 'rb',
      url: '#',
      name: 'RB',
      nationality: 'Italian'
    }]
  },
  {
    position: '16',
    positionText: '16',
    points: '15',
    wins: '0',
    Driver: {
      driverId: 'hadjar',
      permanentNumber: '19',
      code: 'HAD',
      url: '#',
      givenName: 'Isack',
      familyName: 'Hadjar',
      dateOfBirth: '2004-04-28',
      nationality: 'French'
    },
    Constructors: [{
      constructorId: 'rb',
      url: '#',
      name: 'RB',
      nationality: 'Italian'
    }]
  },
  {
    position: '17',
    positionText: '17',
    points: '11',
    wins: '0',
    Driver: {
      driverId: 'bottas',
      permanentNumber: '77',
      code: 'BOT',
      url: '#',
      givenName: 'Valtteri',
      familyName: 'Bottas',
      dateOfBirth: '1989-08-28',
      nationality: 'Finnish'
    },
    Constructors: [{
      constructorId: 'kick_sauber',
      url: '#',
      name: 'Kick Sauber',
      nationality: 'Swiss'
    }]
  },
  {
    position: '18',
    positionText: '18',
    points: '7',
    wins: '0',
    Driver: {
      driverId: 'zhou',
      permanentNumber: '24',
      code: 'ZHO',
      url: '#',
      givenName: 'Guanyu',
      familyName: 'Zhou',
      dateOfBirth: '1999-05-30',
      nationality: 'Chinese'
    },
    Constructors: [{
      constructorId: 'kick_sauber',
      url: '#',
      name: 'Kick Sauber',
      nationality: 'Swiss'
    }]
  },
  {
    position: '19',
    positionText: '19',
    points: '3',
    wins: '0',
    Driver: {
      driverId: 'sargeant',
      permanentNumber: '2',
      code: 'SAR',
      url: '#',
      givenName: 'Logan',
      familyName: 'Sargeant',
      dateOfBirth: '2000-12-31',
      nationality: 'American'
    },
    Constructors: [{
      constructorId: 'williams',
      url: '#',
      name: 'Williams',
      nationality: 'British'
    }]
  },
  {
    position: '20',
    positionText: '20',
    points: '1',
    wins: '0',
    Driver: {
      driverId: 'colapinto',
      permanentNumber: '43',
      code: 'COL',
      url: '#',
      givenName: 'Franco',
      familyName: 'Colapinto',
      dateOfBirth: '2003-03-27',
      nationality: 'Argentine'
    },
    Constructors: [{
      constructorId: 'williams',
      url: '#',
      name: 'Williams',
      nationality: 'British'
    }]
  }
];

// 模拟车队积分榜
const mockConstructorStandings: ConstructorStanding[] = [
  {
    position: '1',
    positionText: '1',
    points: '860',
    wins: '12',
    Constructor: {
      constructorId: 'red_bull',
      url: '#',
      name: 'Red Bull Racing',
      nationality: 'Austrian'
    }
  },
  {
    position: '2',
    positionText: '2',
    points: '672',
    wins: '5',
    Constructor: {
      constructorId: 'ferrari',
      url: '#',
      name: 'Ferrari',
      nationality: 'Italian'
    }
  },
  {
    position: '3',
    positionText: '3',
    points: '420',
    wins: '1',
    Constructor: {
      constructorId: 'mercedes',
      url: '#',
      name: 'Mercedes',
      nationality: 'German'
    }
  },
  {
    position: '4',
    positionText: '4',
    points: '305',
    wins: '0',
    Constructor: {
      constructorId: 'mclaren',
      url: '#',
      name: 'McLaren',
      nationality: 'British'
    }
  }
];

// 2026赛季完整赛历（24场）
const mockRaces2026: Race[] = [
  {
    season: '2026',
    round: '1',
    url: '#',
    raceName: '巴林大奖赛',
    Circuit: {
      circuitId: 'bahrain',
      url: '#',
      circuitName: '巴林国际赛道',
      Location: {
        lat: '26.0325',
        long: '50.5106',
        locality: 'Sakhir',
        country: 'Bahrain'
      }
    },
    date: '2026-03-01',
    time: '15:00:00Z'
  },
  {
    season: '2026',
    round: '2',
    url: '#',
    raceName: '沙特阿拉伯大奖赛',
    Circuit: {
      circuitId: 'jeddah_corniche',
      url: '#',
      circuitName: '吉达滨海赛道',
      Location: {
        lat: '21.5433',
        long: '39.1728',
        locality: 'Jeddah',
        country: 'Saudi Arabia'
      }
    },
    date: '2026-03-08',
    time: '17:00:00Z'
  },
  {
    season: '2026',
    round: '3',
    url: '#',
    raceName: '澳大利亚大奖赛',
    Circuit: {
      circuitId: 'albert_park',
      url: '#',
      circuitName: '阿尔伯特公园赛道',
      Location: {
        lat: '-37.8497',
        long: '144.968',
        locality: 'Melbourne',
        country: 'Australia'
      }
    },
    date: '2026-03-22',
    time: '05:00:00Z'
  },
  {
    season: '2026',
    round: '4',
    url: '#',
    raceName: '日本大奖赛',
    Circuit: {
      circuitId: 'suzuka',
      url: '#',
      circuitName: '铃鹿赛道',
      Location: {
        lat: '34.8431',
        long: '136.541',
        locality: 'Suzuka',
        country: 'Japan'
      }
    },
    date: '2026-04-05',
    time: '05:00:00Z'
  },
  {
    season: '2026',
    round: '5',
    url: '#',
    raceName: '中国大奖赛',
    Circuit: {
      circuitId: 'shanghai',
      url: '#',
      circuitName: '上海国际赛道',
      Location: {
        lat: '31.3389',
        long: '121.22',
        locality: 'Shanghai',
        country: 'China'
      }
    },
    date: '2026-04-19',
    time: '07:00:00Z'
  },
  {
    season: '2026',
    round: '6',
    url: '#',
    raceName: '迈阿密大奖赛',
    Circuit: {
      circuitId: 'miami',
      url: '#',
      circuitName: '迈阿密国际赛道',
      Location: {
        lat: '25.9581',
        long: '-80.2389',
        locality: 'Miami',
        country: 'USA'
      }
    },
    date: '2026-05-04',
    time: '19:30:00Z'
  },
  {
    season: '2026',
    round: '7',
    url: '#',
    raceName: '伊莫拉大奖赛',
    Circuit: {
      circuitId: 'imola',
      url: '#',
      circuitName: '恩佐·迪诺·法拉利赛道',
      Location: {
        lat: '44.3439',
        long: '11.7167',
        locality: 'Imola',
        country: 'Italy'
      }
    },
    date: '2026-05-18',
    time: '13:00:00Z'
  },
  {
    season: '2026',
    round: '8',
    url: '#',
    raceName: '摩纳哥大奖赛',
    Circuit: {
      circuitId: 'monaco',
      url: '#',
      circuitName: '摩纳哥赛道',
      Location: {
        lat: '43.7347',
        long: '7.4206',
        locality: 'Monte-Carlo',
        country: 'Monaco'
      }
    },
    date: '2026-05-25',
    time: '13:00:00Z'
  },
  {
    season: '2026',
    round: '9',
    url: '#',
    raceName: '西班牙大奖赛',
    Circuit: {
      circuitId: 'catalunya',
      url: '#',
      circuitName: '加泰罗尼亚赛道',
      Location: {
        lat: '41.5704',
        long: '2.2611',
        locality: 'Montmelo',
        country: 'Spain'
      }
    },
    date: '2026-06-08',
    time: '13:00:00Z'
  },
  {
    season: '2026',
    round: '10',
    url: '#',
    raceName: '加拿大大奖赛',
    Circuit: {
      circuitId: 'villeneuve',
      url: '#',
      circuitName: '吉尔斯·维伦纽夫赛道',
      Location: {
        lat: '45.5079',
        long: '-73.529',
        locality: 'Montreal',
        country: 'Canada'
      }
    },
    date: '2026-06-15',
    time: '18:00:00Z'
  },
  {
    season: '2026',
    round: '11',
    url: '#',
    raceName: '奥地利大奖赛',
    Circuit: {
      circuitId: 'red_bull_ring',
      url: '#',
      circuitName: '红牛环赛道',
      Location: {
        lat: '47.2197',
        long: '14.7647',
        locality: 'Spielberg',
        country: 'Austria'
      }
    },
    date: '2026-06-29',
    time: '13:00:00Z'
  },
  {
    season: '2026',
    round: '12',
    url: '#',
    raceName: '英国大奖赛',
    Circuit: {
      circuitId: 'silverstone',
      url: '#',
      circuitName: '银石赛道',
      Location: {
        lat: '52.0786',
        long: '-1.0169',
        locality: 'Silverstone',
        country: 'UK'
      }
    },
    date: '2026-07-06',
    time: '14:00:00Z'
  },
  {
    season: '2026',
    round: '13',
    url: '#',
    raceName: '匈牙利大奖赛',
    Circuit: {
      circuitId: 'hungaroring',
      url: '#',
      circuitName: '亨格罗宁赛道',
      Location: {
        lat: '47.5814',
        long: '19.2493',
        locality: 'Mogyorod',
        country: 'Hungary'
      }
    },
    date: '2026-07-20',
    time: '13:00:00Z'
  },
  {
    season: '2026',
    round: '14',
    url: '#',
    raceName: '比利时大奖赛',
    Circuit: {
      circuitId: 'spa',
      url: '#',
      circuitName: '斯帕-弗朗科尔尚赛道',
      Location: {
        lat: '50.4372',
        long: '5.9714',
        locality: 'Stavelot',
        country: 'Belgium'
      }
    },
    date: '2026-07-27',
    time: '13:00:00Z'
  },
  {
    season: '2026',
    round: '15',
    url: '#',
    raceName: '荷兰大奖赛',
    Circuit: {
      circuitId: 'zandvoort',
      url: '#',
      circuitName: '赞德沃特赛道',
      Location: {
        lat: '52.3886',
        long: '4.542',
        locality: 'Zandvoort',
        country: 'Netherlands'
      }
    },
    date: '2026-08-31',
    time: '13:00:00Z'
  },
  {
    season: '2026',
    round: '16',
    url: '#',
    raceName: '意大利大奖赛',
    Circuit: {
      circuitId: 'monza',
      url: '#',
      circuitName: '蒙扎赛道',
      Location: {
        lat: '45.6169',
        long: '9.2824',
        locality: 'Monza',
        country: 'Italy'
      }
    },
    date: '2026-09-07',
    time: '13:00:00Z'
  },
  {
    season: '2026',
    round: '17',
    url: '#',
    raceName: '阿塞拜疆大奖赛',
    Circuit: {
      circuitId: 'baku',
      url: '#',
      circuitName: '巴库市街赛道',
      Location: {
        lat: '40.3725',
        long: '49.8533',
        locality: 'Baku',
        country: 'Azerbaijan'
      }
    },
    date: '2026-09-21',
    time: '11:00:00Z'
  },
  {
    season: '2026',
    round: '18',
    url: '#',
    raceName: '新加坡大奖赛',
    Circuit: {
      circuitId: 'marina_bay',
      url: '#',
      circuitName: '滨海湾市街赛道',
      Location: {
        lat: '1.2914',
        long: '103.864',
        locality: 'Marina Bay',
        country: 'Singapore'
      }
    },
    date: '2026-09-28',
    time: '12:00:00Z'
  },
  {
    season: '2026',
    round: '19',
    url: '#',
    raceName: '美国大奖赛',
    Circuit: {
      circuitId: 'austin',
      url: '#',
      circuitName: '美洲赛道',
      Location: {
        lat: '30.1328',
        long: '-97.6411',
        locality: 'Austin',
        country: 'USA'
      }
    },
    date: '2026-10-12',
    time: '19:00:00Z'
  },
  {
    season: '2026',
    round: '20',
    url: '#',
    raceName: '墨西哥大奖赛',
    Circuit: {
      circuitId: 'rodriguez',
      url: '#',
      circuitName: '罗德里格斯兄弟赛道',
      Location: {
        lat: '19.4026',
        long: '-99.094',
        locality: 'Mexico City',
        country: 'Mexico'
      }
    },
    date: '2026-10-26',
    time: '19:00:00Z'
  },
  {
    season: '2026',
    round: '21',
    url: '#',
    raceName: '圣保罗大奖赛',
    Circuit: {
      circuitId: 'interlagos',
      url: '#',
      circuitName: '英特拉格斯赛道',
      Location: {
        lat: '-23.7017',
        long: '-46.6986',
        locality: 'Sao Paulo',
        country: 'Brazil'
      }
    },
    date: '2026-11-02',
    time: '17:00:00Z'
  },
  {
    season: '2026',
    round: '22',
    url: '#',
    raceName: '拉斯维加斯大奖赛',
    Circuit: {
      circuitId: 'las_vegas',
      url: '#',
      circuitName: '拉斯维加斯街道赛道',
      Location: {
        lat: '36.1147',
        long: '-115.176',
        locality: 'Las Vegas',
        country: 'USA'
      }
    },
    date: '2026-11-23',
    time: '06:00:00Z'
  },
  {
    season: '2026',
    round: '23',
    url: '#',
    raceName: '卡塔尔大奖赛',
    Circuit: {
      circuitId: 'losail',
      url: '#',
      circuitName: '罗赛尔国际赛道',
      Location: {
        lat: '25.49',
        long: '51.4542',
        locality: 'Lusail',
        country: 'Qatar'
      }
    },
    date: '2026-11-30',
    time: '14:00:00Z'
  },
  {
    season: '2026',
    round: '24',
    url: '#',
    raceName: '阿布扎比大奖赛',
    Circuit: {
      circuitId: 'yas_marina',
      url: '#',
      circuitName: '亚斯码头赛道',
      Location: {
        lat: '24.4672',
        long: '54.6031',
        locality: 'Abu Dhabi',
        country: 'United Arab Emirates'
      }
    },
    date: '2025-11-23',
    time: '13:00:00Z'
  }
];

// 模拟车手列表
const mockDrivers: Driver[] = mockDriverStandings.map(ds => ds.Driver);

// 模拟车队列表
const mockConstructors: Constructor[] = mockConstructorStandings.map(cs => cs.Constructor);

// 模拟赛道列表
const mockCircuits: Circuit[] = mockRaces2026.map(r => r.Circuit);

// 模拟响应处理
export function mockResponse(url: string): ErgastResponse<never> {
  const responseBase = {
    MRData: {
      xmlns: 'http://ergast.com/mrd/1.5',
      series: 'f1',
      url: url,
      limit: '30',
      offset: '0',
      total: '30',
    }
  };

  if (url.includes('seasons.json')) {
    return {
      ...responseBase,
      MRData: {
        ...responseBase.MRData,
        SeasonTable: {
          Seasons: mockSeasons
        }
      }
    };
  }

  if (url.includes('driverStandings.json')) {
    return {
      ...responseBase,
      MRData: {
        ...responseBase.MRData,
        StandingsTable: {
          season: '2025',
          StandingsLists: [{
            season: '2025',
            round: '22',
            DriverStandings: mockDriverStandings,
            ConstructorStandings: []
          }]
        }
      }
    };
  }

  if (url.includes('constructorStandings.json')) {
    return {
      ...responseBase,
      MRData: {
        ...responseBase.MRData,
        StandingsTable: {
          season: '2025',
          StandingsLists: [{
            season: '2025',
            round: '22',
            DriverStandings: [],
            ConstructorStandings: mockConstructorStandings
          }]
        }
      }
    };
  }

  if (url.match(/\/\d{4}\.json$/)) {
    // 提取请求的赛季
    const seasonMatch = url.match(/\/(\d{4})\.json$/);
    const requestedSeason = seasonMatch ? seasonMatch[1] : '2026';

    return {
      ...responseBase,
      MRData: {
        ...responseBase.MRData,
        RaceTable: {
          season: requestedSeason,
          Races: mockRaces2026
        }
      }
    };
  }

  if (url.includes('drivers.json')) {
    return {
      ...responseBase,
      MRData: {
        ...responseBase.MRData,
        DriverTable: {
          Drivers: mockDrivers
        }
      }
    };
  }

  if (url.includes('constructors.json')) {
    return {
      ...responseBase,
      MRData: {
        ...responseBase.MRData,
        ConstructorTable: {
          Constructors: mockConstructors
        }
      }
    };
  }

  // 处理练习赛请求
  if (url.includes('practice/1.json') || url.includes('practice/2.json') || url.includes('practice/3.json')) {
    const isShanghai = url.includes('/2/') || url.includes('/3/') || url.includes('/4/');
    if (isShanghai) {
      const practiceNumber = url.includes('practice/1') ? '1' : url.includes('practice/2') ? '2' : '3';
      return {
        ...responseBase,
        MRData: {
          ...responseBase.MRData,
          RaceTable: {
            season: '2025',
            round: '4',
            Races: [{
              season: '2025',
              round: '4',
              url: '#',
              raceName: 'Chinese Grand Prix',
              Circuit: {
                circuitId: 'shanghai',
                url: '#',
                circuitName: '上海国际赛道',
                Location: {
                  lat: '31.3389',
                  long: '121.22',
                  locality: 'Shanghai',
                  country: 'China'
                }
              },
              date: `2025-04-1${practiceNumber}`,
              Results: mockDriverStandings.map((ds, index) => ({
                number: ds.Driver.permanentNumber,
                position: (index + 1).toString(),
                positionText: (index + 1).toString(),
                points: '0',
                Driver: ds.Driver,
                Constructor: ds.Constructors[0],
                grid: '0',
                laps: '20',
                status: 'Finished',
                FastestLap: {
                  rank: (index + 1).toString(),
                  lap: (15 + (index % 6)).toString(),
                  Time: {
                    time: `1:3${practiceNumber}.${456 + index * 111}`.substring(0, 8)
                  },
                  AverageSpeed: {
                    units: 'kph',
                    speed: `${(205 + parseInt(practiceNumber) - index * 0.2).toFixed(1)}`
                  }
                }
              }))
            }]
          }
        }
      };
    }
    return {
      ...responseBase,
      MRData: {
        ...responseBase.MRData,
        RaceTable: {
          Races: []
        }
      }
    };
  }

  if (url.includes('circuits.json')) {
    return {
      ...responseBase,
      MRData: {
        ...responseBase.MRData,
        CircuitTable: {
          Circuits: mockCircuits
        }
      }
    };
  }

  // 处理冲刺赛请求
  if (url.includes('sprint.json')) {
    // 上海站有冲刺赛
    const isShanghai = url.includes('/2/') || url.includes('/3/') || url.includes('/4/'); // 2025年round4，2026年round2/3都是上海站
    if (isShanghai) {
      return {
        ...responseBase,
        MRData: {
          ...responseBase.MRData,
          RaceTable: {
            season: '2025',
            round: '4',
            Races: [{
              season: '2025',
              round: '4',
              url: '#',
              raceName: 'Chinese Grand Prix',
              Circuit: {
                circuitId: 'shanghai',
                url: '#',
                circuitName: '上海国际赛道',
                Location: {
                  lat: '31.3389',
                  long: '121.22',
                  locality: 'Shanghai',
                  country: 'China'
                }
              },
              date: '2025-04-13',
              SprintResults: mockDriverStandings.map((ds, index) => {
                const points = [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0][index];
                const timeGap = index === 0 ? '1:00:00.000' : `+${(index * 0.8 + Math.random() * 0.5).toFixed(3)}`;
                const laps = index < 19 ? '17' : '16';
                const status = index < 19 ? 'Finished' : '+1 Lap';

                return {
                  number: ds.Driver.permanentNumber,
                  position: (index + 1).toString(),
                  positionText: (index + 1).toString(),
                  points: points.toString(),
                  Driver: ds.Driver,
                  Constructor: ds.Constructors[0],
                  grid: ((index % 10) + 1).toString(),
                  laps: laps,
                  status: status,
                  Time: index < 19 ? {
                    millis: (3600000 + index * 800).toString(),
                    time: timeGap
                  } : undefined,
                  FastestLap: {
                    rank: (index + 1).toString(),
                    lap: (15 + (index % 3)).toString(),
                    Time: {
                      time: `1:32.${456 + index * 123}`.substring(0, 8)
                    },
                    AverageSpeed: {
                      units: 'kph',
                      speed: `${(206.5 - index * 0.15).toFixed(1)}`
                    }
                  }
                };
              })
            }]
          }
        }
      };
    }

    // 其他站没有冲刺赛
    return {
      ...responseBase,
      MRData: {
        ...responseBase.MRData,
        RaceTable: {
          Races: []
        }
      }
    };
  }

  // 处理冲刺排位赛请求
  if (url.includes('sprintQualifying.json')) {
    const isShanghai = url.includes('/2/') || url.includes('/3/') || url.includes('/4/');
    if (isShanghai) {
      return {
        ...responseBase,
        MRData: {
          ...responseBase.MRData,
          RaceTable: {
            season: '2025',
            round: '4',
            Races: [{
              season: '2025',
              round: '4',
              url: '#',
              raceName: 'Chinese Grand Prix',
              Circuit: {
                circuitId: 'shanghai',
                url: '#',
                circuitName: '上海国际赛道',
                Location: {
                  lat: '31.3389',
                  long: '121.22',
                  locality: 'Shanghai',
                  country: 'China'
                }
              },
              date: '2025-04-12',
              QualifyingResults: mockDriverStandings.map((ds, index) => {
                const baseTime = 133.000 + index * 0.150;
                const q1Time = `1:${(baseTime + 0.123).toFixed(3)}`;
                const q2Time = index < 15 ? `1:${(baseTime - 0.5 + index * 0.1).toFixed(3)}` : '';
                const q3Time = index < 10 ? `1:${(baseTime - 1.0 + index * 0.08).toFixed(3)}` : '';

                return {
                  number: ds.Driver.permanentNumber,
                  position: (index + 1).toString(),
                  Driver: ds.Driver,
                  Constructor: ds.Constructors[0],
                  Q1: q1Time,
                  Q2: q2Time,
                  Q3: q3Time
                };
              })
            }]
          }
        }
      };
    }
    return {
      ...responseBase,
      MRData: {
        ...responseBase.MRData,
        RaceTable: {
          Races: []
        }
      }
    };
  }

  return responseBase as ErgastResponse<never>;
}
