// F1车队品牌色映射
const teamColorMap: Record<string, string> = {
  // 现役车队
  'red_bull': '#1e5bc6', // 红牛蓝
  'ferrari': '#dc0000', // 法拉利红
  'mercedes': '#00d2be', // 奔驰银/青
  'mclaren': '#ff8700', // 迈凯伦橙
  'aston_martin': '#006f62', // 阿斯顿马丁绿
  'alpine': '#0090ff', //  Alpine 蓝
  'alphatauri': '#2b4562', // 小红牛 深蓝
  'alfa': '#900000', // 阿尔法罗密欧 酒红
  'haas': '#000000', // 哈斯 黑
  'williams': '#005aff', // 威廉姆斯 蓝
  'sauber': '#00e700', // 索伯 绿
  'rb': '#0e4da4', // 小红牛 蓝

  // 历史车队
  'jordan': '#ffff00',
  'benetton': '#008856',
  'renault': '#fff500',
  'brawn': '#c8c8c8',
  'lotus': '#ffb800',
};

// 默认颜色
const DEFAULT_COLOR = '#8c8c8c';

// 获取车队颜色
export function getTeamColor(constructorId: string, isText = false): string {
  const color = teamColorMap[constructorId.toLowerCase()] || DEFAULT_COLOR;
  // 如果是文字颜色，对太浅的颜色做深色适配
  if (isText && (color === '#ffffff' || color === '#ffff00' || color === '#fff500' || color === '#ffb800')) {
    return '#000000';
  }
  return color;
}

// 获取车队背景色样式
export function getTeamBackgroundColor(constructorId: string): React.CSSProperties {
  return {
    backgroundColor: getTeamColor(constructorId),
    color: getTeamColor(constructorId, true)
  };
}
