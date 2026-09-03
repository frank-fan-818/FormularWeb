import { getSessionTimestamp } from '@/utils/raceSchedule';

export type SessionDataPhase = 'scheduled' | 'processing' | 'delayed' | 'unknown';

const ANALYSIS_AVAILABILITY_DELAY_MS = 4 * 60 * 60 * 1000;

export function getSessionDataPhase(
  session: { date?: string; time?: string } | null | undefined,
  now = new Date(),
): SessionDataPhase {
  const timestamp = getSessionTimestamp(session);

  if (timestamp === null) {
    return 'unknown';
  }
  if (now.getTime() < timestamp) {
    return 'scheduled';
  }
  if (now.getTime() < timestamp + ANALYSIS_AVAILABILITY_DELAY_MS) {
    return 'processing';
  }
  return 'delayed';
}

interface SessionUnavailableCopyOptions {
  label: string;
  phase: SessionDataPhase;
  hasClassification?: boolean;
  errorMessage?: string;
}

export interface SessionUnavailableCopy {
  title: string;
  description: string;
  canRetry: boolean;
}

export function getSessionUnavailableCopy({
  label,
  phase,
  hasClassification = false,
  errorMessage,
}: SessionUnavailableCopyOptions): SessionUnavailableCopy {
  if (errorMessage) {
    return {
      title: `${label}数据加载失败`,
      description: errorMessage,
      canRetry: true,
    };
  }

  if (phase === 'scheduled') {
    return {
      title: `${label}尚未开始`,
      description: '场次结束后，系统会自动获取计时数据并生成分析。',
      canRetry: false,
    };
  }

  if (phase === 'processing') {
    return {
      title: `${label}分析正在生成`,
      description: '场次刚刚结束，完整计时快照通常会在数小时内发布，系统会自动重试。',
      canRetry: false,
    };
  }

  if (phase === 'delayed') {
    return {
      title: `${label}分析数据延迟`,
      description: hasClassification
        ? '官方排名已可查看，但完整计时快照尚未同步。自动任务会持续重试，你也可以立即重试。'
        : '该场次已经结束，但结果与完整计时快照尚未同步。自动任务会持续重试。',
      canRetry: true,
    };
  }

  return {
    title: `${label}数据尚未发布`,
    description: '赛历尚未提供可靠的场次时间，或数据源尚未发布该场次。系统会自动重试。',
    canRetry: true,
  };
}
