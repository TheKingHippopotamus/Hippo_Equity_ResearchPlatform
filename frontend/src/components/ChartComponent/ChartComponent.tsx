import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  PriceScaleMode,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import './ChartComponent.css';

export type ChartType = 'line' | 'bar' | 'area';
type TimeframeId = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

type ThemeId = 'light' | 'slate' | 'midnight';
type LineWidthOption = 1 | 2 | 3 | 4;

interface ChartComponentProps {
  data: ChartDataPoint[];
  type?: ChartType;
  timeRange?: string;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  color?: string;
}

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
    watermark: 'rgba(37, 99, 235, 0.08)',
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
  color = '#2563eb',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | ISeriesApi<'Area'> | ISeriesApi<'Histogram'> | null>(null);
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
  const [lineWidth, setLineWidth] = useState<LineWidthOption>(2);
  const [showPriceLine, setShowPriceLine] = useState(true);
  const [showLastValue, setShowLastValue] = useState(true);
  const [showWatermark, setShowWatermark] = useState(false);
  const [watermarkText, setWatermarkText] = useState(title || 'Hippo Equity Research');
  const [themeId, setThemeId] = useState<ThemeId>('light');
  const [showAdvanced, setShowAdvanced] = useState(false);

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
      timeScale: { borderColor: theme.border, timeVisible, secondsVisible },
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
      chart.removeSeries(seriesRef.current);
    }

    let series: ISeriesApi<'Line'> | ISeriesApi<'Area'> | ISeriesApi<'Histogram'>;
    const scaleId = priceScaleSide === 'left' ? 'left' : 'right';

    if (activeType === 'area') {
      series = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: `${color}33`,
        bottomColor: `${color}11`,
        lineWidth,
        priceScaleId: scaleId,
        priceLineVisible: showPriceLine,
        lastValueVisible: showLastValue,
      });
    } else if (activeType === 'bar') {
      series = chart.addSeries(HistogramSeries, {
        color,
        priceScaleId: scaleId,
        priceLineVisible: showPriceLine,
        lastValueVisible: showLastValue,
      });
    } else {
      series = chart.addSeries(LineSeries, {
        color,
        lineWidth,
        priceScaleId: scaleId,
        priceLineVisible: showPriceLine,
        lastValueVisible: showLastValue,
      });
    }

    seriesRef.current = series;
  }, [activeType, color, lineWidth, priceScaleSide, showLastValue, showPriceLine]);

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
      lastValueVisible: showLastValue,
    };
    if (activeType === 'bar') {
      seriesRef.current.applyOptions(baseOptions);
    } else {
      seriesRef.current.applyOptions({ ...baseOptions, lineWidth });
    }
  }, [activeType, lineWidth, priceScaleSide, showLastValue, showPriceLine]);

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
  }, [filteredSeriesData]);

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
