import { useCallback, useEffect, useState } from 'react';

export type TelemetryMetric = 'throttle' | 'brake' | 'gear' | 'rpm';

const DEFAULT_TELEMETRY_METRICS: TelemetryMetric[] = ['throttle', 'brake', 'gear', 'rpm'];

export function useRaceAnalysisControls(season: string, round: string) {
  const [selectedLapDrivers, setSelectedLapDrivers] = useState<string[]>([]);
  const [selectedDuelDrivers, setSelectedDuelDrivers] = useState<string[]>([]);
  const [selectedTelemetryDrivers, setSelectedTelemetryDrivers] = useState<string[]>([]);
  const [selectedTelemetryMetrics, setSelectedTelemetryMetrics] = useState<TelemetryMetric[]>(
    DEFAULT_TELEMETRY_METRICS,
  );
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSelectedLapDrivers([]);
    setSelectedDuelDrivers([]);
    setSelectedTelemetryDrivers([]);
    setSelectedTelemetryMetrics(DEFAULT_TELEMETRY_METRICS);
    setCollapsedSections({});
  }, [round, season]);

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const isCollapsed = useCallback(
    (key: string) => Boolean(collapsedSections[key]),
    [collapsedSections],
  );

  const handleLapDriverToggle = useCallback((driver: string) => {
    setSelectedLapDrivers((current) => {
      if (!current.length) return [driver];
      return current.includes(driver)
        ? current.filter((item) => item !== driver)
        : [...current, driver];
    });
  }, []);

  const handleDuelDriverToggle = useCallback((driver: string) => {
    setSelectedDuelDrivers((current) => {
      const next = current.includes(driver)
        ? current.filter((item) => item !== driver)
        : current.length < 2
          ? [...current, driver]
          : [current[1], driver];
      setSelectedLapDrivers(next);
      return next;
    });
  }, []);

  const handleTelemetryDriverToggle = useCallback((driver: string) => {
    setSelectedTelemetryDrivers((current) => {
      if (!current.length) return [driver];
      return current.includes(driver)
        ? current.filter((item) => item !== driver)
        : [...current, driver];
    });
  }, []);

  const handleTelemetryMetricToggle = useCallback((metric: TelemetryMetric) => {
    setSelectedTelemetryMetrics((current) => (
      current.includes(metric)
        ? current.filter((item) => item !== metric)
        : [...current, metric]
    ));
  }, []);

  return {
    selectedLapDrivers,
    selectedDuelDrivers,
    selectedTelemetryDrivers,
    selectedTelemetryMetrics,
    toggleSection,
    isCollapsed,
    handleLapDriverToggle,
    handleDuelDriverToggle,
    handleTelemetryDriverToggle,
    handleTelemetryMetricToggle,
  };
}
