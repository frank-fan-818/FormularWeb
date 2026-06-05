import type { FastF1RaceAnalytics, FastF1StrategyStint } from '@/types';
import { escapeTooltipText, formatSignedSeconds } from '@/utils/raceDetailFormatters';
import { formatCompoundWithCode, getTyreAgeLabel, formatTyreLife } from '@/utils/tyreCompounds';
import { TEXT, CHART_TOOLTIP_CSS } from '../constants';
import type { ChartTooltipParam } from './helpers';
import {
  getCompoundColor,
  getMaxRaceLap,
  averageLapTimes,
  formatSessionSeconds,
} from './helpers';

export type StintPaceMetric = FastF1StrategyStint & {
  driver: string;
  averagePaceSeconds: number | null;
  degradationSeconds: number | null;
  previousDeltaSeconds: number | null;
};

function getStintAtIndex<T extends FastF1StrategyStint>(stints: T[], index: number) {
  return stints.find((stint) => stint.stint === index + 1) || null;
}

function getStintPaceMetrics(
  analytics: FastF1RaceAnalytics,
  driver: string,
  stints: FastF1StrategyStint[],
) {
  const series = analytics.lapTimeSeries.find((item) => item.driver === driver);
  let previousAverage: number | null = null;

  return stints.map((stint): StintPaceMetric => {
    const lapTimes = (series?.laps || [])
      .filter((lap) => (
        Number.isFinite(lap.lapTimeSeconds)
        && lap.lapNumber >= stint.startLap
        && lap.lapNumber <= stint.endLap
      ))
      .sort((a, b) => a.lapNumber - b.lapNumber)
      .map((lap) => lap.lapTimeSeconds);

    const averagePaceSeconds = averageLapTimes(lapTimes);
    const firstAverage = averageLapTimes(lapTimes.slice(0, 3));
    const lastAverage = averageLapTimes(lapTimes.slice(-3));
    const degradationSeconds = firstAverage !== null && lastAverage !== null
      ? Number((lastAverage - firstAverage).toFixed(3))
      : null;
    const previousDeltaSeconds = averagePaceSeconds !== null && previousAverage !== null
      ? Number((averagePaceSeconds - previousAverage).toFixed(3))
      : null;

    if (averagePaceSeconds !== null) {
      previousAverage = averagePaceSeconds;
    }

    return {
      ...stint,
      driver,
      averagePaceSeconds,
      degradationSeconds,
      previousDeltaSeconds,
    };
  });
}

function buildStintTooltip(params: ChartTooltipParam) {
  const data = params.data as {
    stint?: StintPaceMetric;
    compoundLabel?: string;
    tyreAgeLabel?: string;
    tyreLifeLabel?: string | null;
  };
  const stint = data?.stint;

  if (!stint) {
    return '';
  }

  return `
    <div class="fastf1-tooltip">
      <div class="fastf1-tooltip-title">${escapeTooltipText(stint.driver)} - Stint ${stint.stint}</div>
      <div class="fastf1-tooltip-grid fastf1-tooltip-grid-stint">
        <div class="fastf1-tooltip-row">
          <span class="fastf1-tooltip-marker" style="background:${getCompoundColor(stint.compound)};"></span>
          <span class="fastf1-tooltip-name">${escapeTooltipText(data.compoundLabel || stint.compound)}</span>
          <strong>L${stint.startLap}-L${stint.endLap} (${stint.lapCount})</strong>
        </div>
        <div class="fastf1-tooltip-row">
          <span class="fastf1-tooltip-marker is-empty"></span>
          <span>${TEXT.tyreAge}</span>
          <strong class="fastf1-tyre-age-badge">${escapeTooltipText(data.tyreAgeLabel || getTyreAgeLabel(stint))}</strong>
        </div>
        <div class="fastf1-tooltip-row">
          <span class="fastf1-tooltip-marker is-empty"></span>
          <span>${TEXT.tyreLife}</span>
          <strong>${escapeTooltipText(data.tyreLifeLabel || formatTyreLife(stint) || '-')}</strong>
        </div>
        <div class="fastf1-tooltip-row">
          <span class="fastf1-tooltip-marker is-empty"></span>
          <span>${TEXT.stintPace}</span>
          <strong>${formatSessionSeconds(stint.averagePaceSeconds)}</strong>
        </div>
        <div class="fastf1-tooltip-row">
          <span class="fastf1-tooltip-marker is-empty"></span>
          <span>${TEXT.degradation}</span>
          <strong>${formatSignedSeconds(stint.degradationSeconds)}</strong>
        </div>
        <div class="fastf1-tooltip-row">
          <span class="fastf1-tooltip-marker is-empty"></span>
          <span>vs Prev Stint</span>
          <strong>${formatSignedSeconds(stint.previousDeltaSeconds)}</strong>
        </div>
      </div>
    </div>
  `;
}

function buildTyreStrategyOption(
  analytics: FastF1RaceAnalytics,
  highlightedDrivers: string[] = [],
  season: string | number = analytics.season,
  round: string | number | undefined = analytics.round,
) {
  const strategies = [...analytics.tyreStrategies].sort((a, b) => {
    const aPosition = a.racePosition ?? Number.MAX_SAFE_INTEGER;
    const bPosition = b.racePosition ?? Number.MAX_SAFE_INTEGER;
    return aPosition - bPosition;
  });
  const highlightedSet = new Set(highlightedDrivers);
  const hasHighlight = highlightedSet.size > 0;
  const metricStrategies = strategies.map((strategy) => ({
    ...strategy,
    stints: getStintPaceMetrics(analytics, strategy.driver, strategy.stints),
  }));
  const drivers = metricStrategies.map((strategy) => strategy.driver);
  const maxStints = Math.max(
    0,
    ...metricStrategies.map((strategy) => strategy.stints.length),
  );

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      appendToBody: true,
      borderWidth: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      extraCssText: CHART_TOOLTIP_CSS,
      textStyle: {
        color: '#fff',
      },
      formatter: buildStintTooltip,
    },
    legend: {
      show: false,
    },
    grid: {
      top: 18,
      right: 24,
      bottom: 44,
      left: 68,
    },
    xAxis: {
      type: 'value',
      name: 'Laps',
      max: getMaxRaceLap(analytics),
      minInterval: 1,
      axisLine: {
        lineStyle: { color: '#cbd5e1' },
      },
      axisTick: {
        lineStyle: { color: '#cbd5e1' },
      },
      axisLabel: {
        color: '#64748b',
      },
      splitLine: {
        lineStyle: { color: 'rgba(148, 163, 184, 0.18)' },
      },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: drivers,
      axisLine: {
        lineStyle: { color: '#cbd5e1' },
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: '#475569',
        fontWeight: 700,
      },
    },
    series: Array.from({ length: maxStints }, (_, index) => ({
      name: `Stint ${index + 1}`,
      type: 'bar',
      stack: 'stints',
      barMaxWidth: 18,
      data: metricStrategies.map((strategy) => {
        const stint = getStintAtIndex(strategy.stints, index);
        const isHighlighted = !hasHighlight || highlightedSet.has(strategy.driver);
        return {
          value: stint?.lapCount || 0,
          stint: stint || undefined,
          compoundLabel: stint ? formatCompoundWithCode(season, round, stint.compound) : '',
          tyreAgeLabel: stint ? getTyreAgeLabel(stint) : '',
          tyreLifeLabel: stint ? formatTyreLife(stint) : null,
          itemStyle: {
            color: stint ? getCompoundColor(stint.compound) : 'transparent',
            borderColor: 'rgba(15, 23, 42, 0.3)',
            borderWidth: stint ? 1 : 0,
            borderType: stint && getTyreAgeLabel(stint) === '\u65e7\u80ce' ? 'dashed' : 'solid',
            opacity: isHighlighted ? 1 : 0.22,
          },
        };
      }),
    })),
  };
}

export { getStintAtIndex, getStintPaceMetrics, buildStintTooltip, buildTyreStrategyOption };
