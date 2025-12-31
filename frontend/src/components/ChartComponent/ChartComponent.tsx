import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  createSeriesMarkers,
  LineStyle,
  LineType,
  LastPriceAnimationMode,
  PriceLineSource,
  PriceScaleMode,
  CrosshairMode,
  type IChartApi,
  type ISeriesMarkersPluginApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import './ChartComponent.css';

export type ChartType = 'line' | 'bar' | 'area';
type TimeframeId = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface ChartNewsItem {
  id?: string;
  title: string;
  publishedAt: string;
  url?: string;
  source?: string;
  sentiment?: number;
}

type ThemeId = 'light' | 'slate' | 'midnight';
type LineWidthOption = 1 | 2 | 3 | 4;
type NewsDisplayMode = 'floating' | 'inline';

interface ChartComponentProps {
  data: ChartDataPoint[];
  type?: ChartType;
  timeRange?: string;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  color?: string;
  newsItems?: ChartNewsItem[];
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const applyAlpha = (input: string, alpha: number) => {
  const safeAlpha = clamp(alpha, 0, 1);
  const color = input.trim();
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
    }
  }
  return input;
};

const toIsoDate = (input: Time) => {
  if (typeof input === 'string') {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return input;
  }

  if (typeof input === 'number') {
    const parsed = new Date(input * 1000);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return null;
  }

  if (input && typeof input === 'object') {
    const { year, month, day } = input;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  return null;
};

const sentimentToColor = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '#94a3b8';
  }
  if (value <= -1) {
    return '#ef4444';
  }
  if (value < 0.5) {
    return '#f59e0b';
  }
  if (value < 2.5) {
    return '#22c55e';
  }
  return '#0f766e';
};

const TIMEFRAMES: Array<{ id: TimeframeId; label: string; days?: number }> = [
  { id: '1W', label: '1W', days: 7 },
  { id: '1M', label: '1M', days: 30 },
  { id: '3M', label: '3M', days: 90 },
  { id: '6M', label: '6M', days: 180 },
  { id: '1Y', label: '1Y', days: 365 },
  { id: 'ALL', label: 'All' },
];

const CHART_THEMES: Record<
  ThemeId,
  {
    name: string;
    background: string;
    text: string;
    grid: string;
    border: string;
    crosshair: string;
    watermark: string;
  }
> = {
  light: {
    name: 'Light',
    background: '#ffffff',
    text: '#111827',
    grid: '#e5e7eb',
    border: '#e5e7eb',
    crosshair: '#9ca3af',
    watermark: 'rgba(15, 118, 110, 0.08)',
  },
  slate: {
    name: 'Slate',
    background: '#0f172a',
    text: '#e2e8f0',
    grid: 'rgba(148, 163, 184, 0.2)',
    border: 'rgba(148, 163, 184, 0.4)',
    crosshair: '#94a3b8',
    watermark: 'rgba(148, 163, 184, 0.12)',
  },
  midnight: {
    name: 'Midnight',
    background: '#111827',
    text: '#f3f4f6',
    grid: 'rgba(75, 85, 99, 0.3)',
    border: 'rgba(75, 85, 99, 0.6)',
    crosshair: '#cbd5f5',
    watermark: 'rgba(59, 130, 246, 0.14)',
  },
};

export const ChartComponent: React.FC<ChartComponentProps> = ({
  data,
  type = 'line',
  timeRange,
  title,
  xAxisLabel,
  yAxisLabel,
  color,
  newsItems,
}) => {
  const resolvedColor =
    color ||
    (typeof window !== 'undefined'
      ? getComputedStyle(document.body).getPropertyValue('--color-primary').trim()
      : '') ||
    '#0f766e';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | ISeriesApi<'Area'> | ISeriesApi<'Histogram'> | null>(null);
  const markerPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const [activeType, setActiveType] = useState<ChartType>(type);
  const [activeRange, setActiveRange] = useState<TimeframeId>('1M');
  const [gridVisible, setGridVisible] = useState(true);
  const [crosshairVisible, setCrosshairVisible] = useState(true);
  const [crosshairMode, setCrosshairMode] = useState<CrosshairMode>(CrosshairMode.Normal);
  const [priceScaleMode, setPriceScaleMode] = useState(PriceScaleMode.Normal);
  const [priceScaleSide, setPriceScaleSide] = useState<'right' | 'left'>('right');
  const [timeVisible, setTimeVisible] = useState(true);
  const [secondsVisible, setSecondsVisible] = useState(false);
  const [barSpacing, setBarSpacing] = useState(6);
  const [lineWidth, setLineWidth] = useState<LineWidthOption>(2);
  const [lineStyle, setLineStyle] = useState<LineStyle>(LineStyle.Solid);
  const [lineType, setLineType] = useState<LineType>(LineType.Curved);
  const [showMarkers, setShowMarkers] = useState(false);
  const [markerRadius, setMarkerRadius] = useState(4);
  const [areaOpacity, setAreaOpacity] = useState(0.2);
  const [showPriceLine, setShowPriceLine] = useState(true);
  const [showLastValue, setShowLastValue] = useState(true);
  const [priceLineStyle, setPriceLineStyle] = useState<LineStyle>(LineStyle.Dashed);
  const [priceLineSource, setPriceLineSource] = useState<PriceLineSource>(PriceLineSource.LastBar);
  const [lastPriceAnimation, setLastPriceAnimation] = useState<LastPriceAnimationMode>(
    LastPriceAnimationMode.OnDataUpdate
  );
  const [showWatermark, setShowWatermark] = useState(false);
  const [watermarkText, setWatermarkText] = useState(title || 'King Hippopotmus');
  const [themeId, setThemeId] = useState<ThemeId>('light');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const [newsDisplayMode, setNewsDisplayMode] = useState<NewsDisplayMode>('floating');
  const [hoveredNews, setHoveredNews] = useState<{
    date: string;
    items: ChartNewsItem[];
  } | null>(null);
  const [hoveredNewsPosition, setHoveredNewsPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const lastNewsDateRef = useRef<string | null>(null);
  const newsTooltipRef = useRef<HTMLDivElement | null>(null);
  const seriesData = useMemo(() => {
    const mapped = data
      .map((point) => {
        const parsedDate = new Date(point.date);
        if (Number.isNaN(parsedDate.getTime())) {
          return null;
        }
        const date = parsedDate.toISOString().slice(0, 10);
        return { time: date, value: point.value };
      })
      .filter((point): point is { time: string; value: number } => point !== null);
    return mapped.sort((a, b) => a.time.localeCompare(b.time));
  }, [data]);

  const availableRanges = useMemo(() => {
    if (seriesData.length < 2) {
      return TIMEFRAMES.map((range) => ({ ...range, enabled: range.id === 'ALL' }));
    }

    const start = new Date(seriesData[0].time);
    const end = new Date(seriesData[seriesData.length - 1].time);
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));

    return TIMEFRAMES.map((range) => ({
      ...range,
      enabled: range.days ? range.days <= totalDays : true,
    }));
  }, [seriesData]);

  const filteredSeriesData = useMemo(() => {
    if (activeRange === 'ALL' || seriesData.length === 0) {
      return seriesData;
    }

    const range = TIMEFRAMES.find((item) => item.id === activeRange);
    if (!range?.days) {
      return seriesData;
    }

    const endDate = new Date(seriesData[seriesData.length - 1].time);
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - range.days);
    return seriesData.filter((point) => new Date(point.time) >= startDate);
  }, [activeRange, seriesData]);

  const visibleRange = useMemo(() => {
    if (filteredSeriesData.length === 0) {
      return null;
    }
    return {
      start: filteredSeriesData[0].time,
      end: filteredSeriesData[filteredSeriesData.length - 1].time,
    };
  }, [filteredSeriesData]);

  const newsByDate = useMemo(() => {
    const map = new Map<string, ChartNewsItem[]>();
    if (!newsItems || newsItems.length === 0) {
      return map;
    }

    newsItems.forEach((item) => {
      const date = toIsoDate(item.publishedAt);
      if (!date) {
        return;
      }
      if (visibleRange && (date < visibleRange.start || date > visibleRange.end)) {
        return;
      }
      const existing = map.get(date) || [];
      existing.push(item);
      map.set(date, existing);
    });

    return map;
  }, [newsItems, visibleRange]);

  const newsMarkers = useMemo<SeriesMarker<Time>[]>(() => {
    if (!showNews || newsByDate.size === 0) {
      return [];
    }
    const markers: SeriesMarker<Time>[] = [];
    newsByDate.forEach((items, date) => {
      const sentiments = items
        .map((item) => item.sentiment)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const averageSentiment =
        sentiments.length > 0 ? sentiments.reduce((sum, value) => sum + value, 0) / sentiments.length : undefined;
      markers.push({
        time: date,
        position: 'aboveBar',
        shape: 'circle',
        color: sentimentToColor(averageSentiment),
        text: items.length > 1 ? `${items.length}` : 'N',
        size: 1.2,
      });
    });
    return markers;
  }, [newsByDate, newsDisplayMode, showNews]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const theme = CHART_THEMES[themeId];
    const chart = createChart(container, {
      width: Math.max(container.clientWidth, 1),
      height: Math.max(container.clientHeight, 1),
      layout: {
        background: { type: ColorType.Solid, color: theme.background },
        textColor: theme.text,
      },
      grid: {
        vertLines: { color: theme.grid, visible: gridVisible },
        horzLines: { color: theme.grid, visible: gridVisible },
      },
      rightPriceScale: {
        borderColor: theme.border,
        mode: priceScaleMode,
        visible: priceScaleSide === 'right',
      },
      leftPriceScale: {
        borderColor: theme.border,
        visible: priceScaleSide === 'left',
      },
      timeScale: { borderColor: theme.border, timeVisible, secondsVisible, barSpacing },
      crosshair: {
        mode: crosshairVisible ? crosshairMode : CrosshairMode.Hidden,
        vertLine: { visible: crosshairVisible, color: theme.crosshair },
        horzLine: { visible: crosshairVisible, color: theme.crosshair },
      },
    });

    chartRef.current = chart;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (container && chartRef.current) {
          if (resizeFrameRef.current) {
            window.cancelAnimationFrame(resizeFrameRef.current);
          }
          resizeFrameRef.current = window.requestAnimationFrame(() => {
            chartRef.current?.applyOptions({
              width: Math.max(container.clientWidth, 1),
              height: Math.max(container.clientHeight, 1),
            });
          });
        }
      });
      resizeObserverRef.current.observe(container);
    }

    return () => {
      if (resizeFrameRef.current) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }
      resizeObserverRef.current?.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    setActiveType(type);
  }, [type]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    if (seriesRef.current) {
      markerPluginRef.current?.detach();
      markerPluginRef.current = null;
      chart.removeSeries(seriesRef.current);
    }

    let series: ISeriesApi<'Line'> | ISeriesApi<'Area'> | ISeriesApi<'Histogram'>;
    const scaleId = priceScaleSide === 'left' ? 'left' : 'right';

    if (activeType === 'area') {
      series = chart.addSeries(AreaSeries, {
        lineColor: resolvedColor,
        topColor: applyAlpha(resolvedColor, areaOpacity),
        bottomColor: applyAlpha(resolvedColor, areaOpacity * 0.35),
        lineWidth,
        lineStyle,
        lineType,
        pointMarkersVisible: showMarkers,
        pointMarkersRadius: showMarkers ? markerRadius : undefined,
        lastPriceAnimation,
        priceScaleId: scaleId,
        priceLineVisible: showPriceLine,
        priceLineStyle,
        priceLineSource,
        lastValueVisible: showLastValue,
      });
    } else if (activeType === 'bar') {
      series = chart.addSeries(HistogramSeries, {
        color: resolvedColor,
        base: 0,
        priceScaleId: scaleId,
        priceLineVisible: showPriceLine,
        priceLineStyle,
        priceLineSource,
        lastValueVisible: showLastValue,
      });
    } else {
      series = chart.addSeries(LineSeries, {
        color: resolvedColor,
        lineWidth,
        lineStyle,
        lineType,
        pointMarkersVisible: showMarkers,
        pointMarkersRadius: showMarkers ? markerRadius : undefined,
        lastPriceAnimation,
        priceScaleId: scaleId,
        priceLineVisible: showPriceLine,
        priceLineStyle,
        priceLineSource,
        lastValueVisible: showLastValue,
      });
    }

    seriesRef.current = series;
  }, [
    activeType,
    areaOpacity,
    resolvedColor,
    lastPriceAnimation,
    lineStyle,
    lineType,
    lineWidth,
    markerRadius,
    priceLineSource,
    priceLineStyle,
    priceScaleSide,
    showLastValue,
    showMarkers,
    showPriceLine,
  ]);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }

    if (!showNews || newsMarkers.length === 0) {
      markerPluginRef.current?.setMarkers([]);
      setHoveredNews(null);
      setHoveredNewsPosition(null);
      return;
    }

    if (!markerPluginRef.current) {
      markerPluginRef.current = createSeriesMarkers(seriesRef.current, newsMarkers, {
        autoScale: true,
      });
    } else {
      markerPluginRef.current.setMarkers(newsMarkers);
    }
  }, [newsMarkers, showNews]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    const handleMove = (param: Parameters<IChartApi['subscribeCrosshairMove']>[0] extends (p: infer P) => void ? P : never) => {
      if (!showNews || newsByDate.size === 0) {
        setHoveredNews(null);
        setHoveredNewsPosition(null);
        lastNewsDateRef.current = null;
        return;
      }

      if (!param?.time) {
        setHoveredNews(null);
        setHoveredNewsPosition(null);
        lastNewsDateRef.current = null;
        return;
      }

      const date = toIsoDate(param.time as Time);
      if (!date) {
        setHoveredNews(null);
        setHoveredNewsPosition(null);
        lastNewsDateRef.current = null;
        return;
      }

      const items = newsByDate.get(date);
      if (!items || items.length === 0) {
        setHoveredNews(null);
        setHoveredNewsPosition(null);
        lastNewsDateRef.current = null;
        return;
      }

      const isSameDate = lastNewsDateRef.current === date;
      lastNewsDateRef.current = date;

      if (!isSameDate && newsDisplayMode === 'floating' && param.point && containerRef.current?.parentElement) {
        const surface = containerRef.current.parentElement;
        const tooltipWidth = newsTooltipRef.current?.offsetWidth ?? 320;
        const tooltipHeight = newsTooltipRef.current?.offsetHeight ?? 180;
        const padding = 16;
        const maxX = Math.max(padding, surface.clientWidth - tooltipWidth - padding);
        const maxY = Math.max(padding, surface.clientHeight - tooltipHeight - padding);
        const nextX = Math.min(Math.max(param.point.x + 12, padding), maxX);
        const nextY = Math.min(Math.max(param.point.y + 12, padding), maxY);
        setHoveredNewsPosition({ x: nextX, y: nextY });
      } else if (newsDisplayMode !== 'floating') {
        setHoveredNewsPosition(null);
      }

      setHoveredNews((prev) =>
        prev?.date === date && prev.items.length === items.length ? prev : { date, items }
      );
    };

    chart.subscribeCrosshairMove(handleMove);
    return () => {
      chart.unsubscribeCrosshairMove(handleMove);
    };
  }, [newsByDate, showNews]);

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }
    const theme = CHART_THEMES[themeId];
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: theme.background },
        textColor: theme.text,
      },
      grid: {
        vertLines: { color: theme.grid, visible: gridVisible },
        horzLines: { color: theme.grid, visible: gridVisible },
      },
      rightPriceScale: {
        borderColor: theme.border,
        mode: priceScaleMode,
        visible: priceScaleSide === 'right',
      },
      leftPriceScale: {
        borderColor: theme.border,
        visible: priceScaleSide === 'left',
      },
      timeScale: {
        borderColor: theme.border,
        timeVisible,
        secondsVisible,
        barSpacing,
      },
      crosshair: {
        mode: crosshairVisible ? crosshairMode : CrosshairMode.Hidden,
        vertLine: { visible: crosshairVisible, color: theme.crosshair },
        horzLine: { visible: crosshairVisible, color: theme.crosshair },
      },
    });
  }, [
    crosshairMode,
    crosshairVisible,
    gridVisible,
    barSpacing,
    priceScaleMode,
    priceScaleSide,
    secondsVisible,
    showWatermark,
    themeId,
    timeVisible,
    watermarkText,
  ]);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }
    const baseOptions = {
      priceScaleId: priceScaleSide === 'left' ? 'left' : 'right',
      priceLineVisible: showPriceLine,
      priceLineStyle,
      priceLineSource,
      lastValueVisible: showLastValue,
    };
    if (activeType === 'bar') {
      seriesRef.current.applyOptions(baseOptions);
    } else {
      seriesRef.current.applyOptions({
        ...baseOptions,
        lineWidth,
        lineStyle,
        lineType,
        pointMarkersVisible: showMarkers,
        pointMarkersRadius: showMarkers ? markerRadius : undefined,
        lastPriceAnimation,
      });
      if (activeType === 'area') {
        seriesRef.current.applyOptions({
          lineColor: resolvedColor,
          topColor: applyAlpha(resolvedColor, areaOpacity),
          bottomColor: applyAlpha(resolvedColor, areaOpacity * 0.35),
        });
      }
      if (activeType === 'line') {
        seriesRef.current.applyOptions({ color: resolvedColor });
      }
    }
  }, [
    activeType,
    areaOpacity,
    color,
    lastPriceAnimation,
    lineStyle,
    lineType,
    lineWidth,
    markerRadius,
    priceLineSource,
    priceLineStyle,
    priceScaleSide,
    showLastValue,
    showMarkers,
    showPriceLine,
  ]);

  useEffect(() => {
    if (title) {
      setWatermarkText(title);
    }
  }, [title]);

  useEffect(() => {
    if (seriesRef.current) {
      seriesRef.current.setData(filteredSeriesData);
      chartRef.current?.timeScale().fitContent();
    }
  }, [filteredSeriesData, activeType]);

  useEffect(() => {
    const enabledRanges = availableRanges.filter((range) => range.enabled);
    if (!enabledRanges.find((range) => range.id === activeRange)) {
      const fallback = enabledRanges[0]?.id ?? 'ALL';
      setActiveRange(fallback);
    }
  }, [activeRange, availableRanges]);

  return (
    <div className="chart-component card">
      {(title || timeRange) && (
        <div className="chart-header">
          {title && <h3 className="chart-title">{title}</h3>}
          {timeRange && <span className="chart-time-range">{timeRange}</span>}
        </div>
      )}
      <div className="chart-toolbar">
        <div className="chart-range">
          {availableRanges.map((range) => (
            <button
              key={range.id}
              type="button"
              className={`chart-range-button ${activeRange === range.id ? 'active' : ''}`}
              onClick={() => range.enabled && setActiveRange(range.id)}
              disabled={!range.enabled}
            >
              {range.label}
            </button>
          ))}
        </div>
        <div className="chart-controls">
          <label className="chart-control">
            <span>Style</span>
            <select
              value={activeType}
              onChange={(event) => setActiveType(event.target.value as ChartType)}
            >
              <option value="line">Line</option>
              <option value="area">Area</option>
              <option value="bar">Bar</option>
            </select>
          </label>
          <label className="chart-control">
            <span>Scale</span>
            <select
              value={priceScaleMode}
              onChange={(event) => setPriceScaleMode(Number(event.target.value))}
            >
              <option value={PriceScaleMode.Normal}>Normal</option>
              <option value={PriceScaleMode.Logarithmic}>Log</option>
              <option value={PriceScaleMode.Percentage}>Percent</option>
              <option value={PriceScaleMode.IndexedTo100}>Indexed</option>
            </select>
          </label>
          <button
            type="button"
            className="chart-fit-button"
            onClick={() => chartRef.current?.timeScale().fitContent()}
          >
            Fit
          </button>
          <button
            type="button"
            className={`chart-fit-button chart-toggle-button ${showNews ? 'active' : ''}`}
            onClick={() => setShowNews((prev) => !prev)}
            disabled={!newsItems || newsItems.length === 0}
          >
            {showNews ? 'News On' : 'News Off'}
          </button>
          <button
            type="button"
            className="chart-fit-button"
            onClick={() => setShowAdvanced((prev) => !prev)}
          >
            {showAdvanced ? 'Hide Options' : 'Options'}
          </button>
        </div>
      </div>
      {showAdvanced && (
        <div className="chart-advanced">
          <div className="chart-advanced-group">
            <p className="chart-advanced-title">Layout</p>
            <label className="chart-control">
              <span>Theme</span>
              <select
                value={themeId}
                onChange={(event) => setThemeId(event.target.value as ThemeId)}
              >
                {Object.entries(CHART_THEMES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="chart-control">
              <span>Bar spacing</span>
              <input
                type="range"
                min={2}
                max={14}
                step={1}
                value={barSpacing}
                onChange={(event) => setBarSpacing(Number(event.target.value))}
              />
              <span className="chart-range-value">{barSpacing}px</span>
            </label>
            <label className="chart-control checkbox">
              <input
                type="checkbox"
                checked={gridVisible}
                onChange={(event) => setGridVisible(event.target.checked)}
              />
              <span>Grid</span>
            </label>
            <label className="chart-control checkbox">
              <input
                type="checkbox"
                checked={timeVisible}
                onChange={(event) => setTimeVisible(event.target.checked)}
              />
              <span>Time axis</span>
            </label>
            <label className="chart-control checkbox">
              <input
                type="checkbox"
                checked={secondsVisible}
                onChange={(event) => setSecondsVisible(event.target.checked)}
              />
              <span>Seconds</span>
            </label>
          </div>

          <div className="chart-advanced-group">
            <p className="chart-advanced-title">Crosshair</p>
            <label className="chart-control">
              <span>Mode</span>
              <select
                value={crosshairMode}
                onChange={(event) => setCrosshairMode(Number(event.target.value) as CrosshairMode)}
                disabled={!crosshairVisible}
              >
                <option value={CrosshairMode.Normal}>Normal</option>
                <option value={CrosshairMode.Magnet}>Magnet</option>
              </select>
            </label>
            <label className="chart-control checkbox">
              <input
                type="checkbox"
                checked={crosshairVisible}
                onChange={(event) => setCrosshairVisible(event.target.checked)}
              />
              <span>Show crosshair</span>
            </label>
          </div>

          <div className="chart-advanced-group">
            <p className="chart-advanced-title">Price Scale</p>
            <label className="chart-control">
              <span>Side</span>
              <select
                value={priceScaleSide}
                onChange={(event) => setPriceScaleSide(event.target.value as 'left' | 'right')}
              >
                <option value="right">Right</option>
                <option value="left">Left</option>
              </select>
            </label>
            <label className="chart-control">
              <span>Price line</span>
              <select
                value={priceLineStyle}
                onChange={(event) => setPriceLineStyle(Number(event.target.value) as LineStyle)}
                disabled={!showPriceLine}
              >
                <option value={LineStyle.Solid}>Solid</option>
                <option value={LineStyle.Dotted}>Dotted</option>
                <option value={LineStyle.Dashed}>Dashed</option>
                <option value={LineStyle.LargeDashed}>Large dashed</option>
                <option value={LineStyle.SparseDotted}>Sparse dotted</option>
              </select>
            </label>
            <label className="chart-control">
              <span>Price source</span>
              <select
                value={priceLineSource}
                onChange={(event) => setPriceLineSource(Number(event.target.value) as PriceLineSource)}
                disabled={!showPriceLine}
              >
                <option value={PriceLineSource.LastBar}>Last bar</option>
                <option value={PriceLineSource.LastVisible}>Last visible</option>
              </select>
            </label>
            <label className="chart-control checkbox">
              <input
                type="checkbox"
                checked={showPriceLine}
                onChange={(event) => setShowPriceLine(event.target.checked)}
              />
              <span>Price line</span>
            </label>
            <label className="chart-control checkbox">
              <input
                type="checkbox"
                checked={showLastValue}
                onChange={(event) => setShowLastValue(event.target.checked)}
              />
              <span>Last value</span>
            </label>
          </div>

          <div className="chart-advanced-group">
            <p className="chart-advanced-title">Series</p>
            <label className="chart-control">
              <span>Line width</span>
              <select
                value={lineWidth}
                onChange={(event) => {
                  const next = Number(event.target.value) as LineWidthOption;
                  setLineWidth(next);
                }}
              >
                {[1, 2, 3, 4].map((width) => (
                  <option key={width} value={width}>
                    {width}px
                  </option>
                ))}
              </select>
            </label>
            <label className="chart-control">
              <span>Line style</span>
              <select
                value={lineStyle}
                onChange={(event) => setLineStyle(Number(event.target.value) as LineStyle)}
                disabled={activeType === 'bar'}
              >
                <option value={LineStyle.Solid}>Solid</option>
                <option value={LineStyle.Dotted}>Dotted</option>
                <option value={LineStyle.Dashed}>Dashed</option>
                <option value={LineStyle.LargeDashed}>Large dashed</option>
                <option value={LineStyle.SparseDotted}>Sparse dotted</option>
              </select>
            </label>
            <label className="chart-control">
              <span>Line type</span>
              <select
                value={lineType}
                onChange={(event) => setLineType(Number(event.target.value) as LineType)}
                disabled={activeType === 'bar'}
              >
                <option value={LineType.Simple}>Straight</option>
                <option value={LineType.WithSteps}>Steps</option>
                <option value={LineType.Curved}>Curved</option>
              </select>
            </label>
            <label className="chart-control checkbox">
              <input
                type="checkbox"
                checked={showMarkers}
                onChange={(event) => setShowMarkers(event.target.checked)}
                disabled={activeType === 'bar'}
              />
              <span>Markers</span>
            </label>
            <label className="chart-control">
              <span>Marker size</span>
              <input
                type="range"
                min={2}
                max={8}
                step={1}
                value={markerRadius}
                onChange={(event) => setMarkerRadius(Number(event.target.value))}
                disabled={!showMarkers || activeType === 'bar'}
              />
              <span className="chart-range-value">{markerRadius}px</span>
            </label>
            <label className="chart-control">
              <span>Animation</span>
              <select
                value={lastPriceAnimation}
                onChange={(event) =>
                  setLastPriceAnimation(Number(event.target.value) as LastPriceAnimationMode)
                }
                disabled={activeType === 'bar'}
              >
                <option value={LastPriceAnimationMode.Disabled}>Off</option>
                <option value={LastPriceAnimationMode.OnDataUpdate}>On update</option>
                <option value={LastPriceAnimationMode.Continuous}>Continuous</option>
              </select>
            </label>
            {activeType === 'area' && (
              <label className="chart-control">
                <span>Fill strength</span>
                <input
                  type="range"
                  min={0.08}
                  max={0.5}
                  step={0.02}
                  value={areaOpacity}
                  onChange={(event) => setAreaOpacity(Number(event.target.value))}
                />
                <span className="chart-range-value">{Math.round(areaOpacity * 100)}%</span>
              </label>
            )}
          </div>

          <div className="chart-advanced-group">
            <p className="chart-advanced-title">News</p>
            <label className="chart-control">
              <span>Display</span>
              <select
                value={newsDisplayMode}
                onChange={(event) => setNewsDisplayMode(event.target.value as NewsDisplayMode)}
                disabled={!showNews}
              >
                <option value="floating">Hover bubble</option>
                <option value="inline">Inline panel</option>
              </select>
            </label>
          </div>

          <div className="chart-advanced-group">
            <p className="chart-advanced-title">Watermark</p>
            <label className="chart-control checkbox">
              <input
                type="checkbox"
                checked={showWatermark}
                onChange={(event) => setShowWatermark(event.target.checked)}
              />
              <span>Show watermark</span>
            </label>
            <label className="chart-control">
              <span>Text</span>
              <input
                type="text"
                value={watermarkText}
                onChange={(event) => setWatermarkText(event.target.value)}
                placeholder="Watermark text"
              />
            </label>
          </div>
        </div>
      )}
      <div className="chart-surface">
        <div className="chart-container" ref={containerRef} />
        {showWatermark && (
          <div className="chart-watermark" style={{ color: CHART_THEMES[themeId].watermark }}>
            {watermarkText}
          </div>
        )}
        {showNews && hoveredNews && (newsDisplayMode === 'inline' || hoveredNewsPosition) && (
          <div
            ref={newsTooltipRef}
            className={`chart-news-tooltip ${newsDisplayMode}`}
            style={
              newsDisplayMode === 'floating' && hoveredNewsPosition
                ? { left: `${hoveredNewsPosition.x}px`, top: `${hoveredNewsPosition.y}px` }
                : undefined
            }
          >
            <div className="chart-news-date">{hoveredNews.date}</div>
            <ul>
              {hoveredNews.items.slice(0, 3).map((item) => (
                <li key={item.id || item.title} className="chart-news-item">
                  <span
                    className="chart-news-dot"
                    style={{ backgroundColor: sentimentToColor(item.sentiment) }}
                  />
                  <div className="chart-news-content">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.title}
                      </a>
                    ) : (
                      <span>{item.title}</span>
                    )}
                    {item.source && <span className="chart-news-source">{item.source}</span>}
                  </div>
                </li>
              ))}
            </ul>
            {hoveredNews.items.length > 3 && (
              <div className="chart-news-more">+{hoveredNews.items.length - 3} more</div>
            )}
          </div>
        )}
      </div>
      {xAxisLabel && (
        <div className="chart-x-axis-label">{xAxisLabel}</div>
      )}
      {yAxisLabel && (
        <div className="chart-y-axis-label">{yAxisLabel}</div>
      )}
    </div>
  );
};

export default ChartComponent;
