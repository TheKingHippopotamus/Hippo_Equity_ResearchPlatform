import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartComponent } from './ChartComponent';
import type { ChartDataPoint } from './ChartComponent';

vi.mock('lightweight-charts', () => {
  return {
    ColorType: { Solid: 'solid' },
    LineSeries: {},
    AreaSeries: {},
    BaselineSeries: {},
    HistogramSeries: {},
    LineStyle: { Solid: 0, Dotted: 1, Dashed: 2, LargeDashed: 3, SparseDotted: 4 },
    LineType: { Simple: 0, WithSteps: 1, Curved: 2 },
    LastPriceAnimationMode: { Disabled: 0, Continuous: 1, OnDataUpdate: 2 },
    PriceLineSource: { LastBar: 0, LastVisible: 1 },
    PriceScaleMode: { Normal: 0, Logarithmic: 1, Percentage: 2, IndexedTo100: 3 },
    CrosshairMode: { Normal: 0, Magnet: 1, Hidden: 2 },
    createSeriesMarkers: () => ({
      setMarkers: vi.fn(),
      markers: vi.fn(),
      detach: vi.fn(),
    }),
    createChart: () => ({
      addSeries: () => ({ setData: vi.fn() }),
      removeSeries: vi.fn(),
      timeScale: () => ({ fitContent: vi.fn() }),
      applyOptions: vi.fn(),
      subscribeCrosshairMove: vi.fn(),
      unsubscribeCrosshairMove: vi.fn(),
      remove: vi.fn(),
    }),
  };
});

const ResizeObserverMock = class {
  observe(): void {}
  disconnect(): void {}
};

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: ResizeObserverMock,
  writable: true,
});

const mockData: ChartDataPoint[] = [
  { date: '2024-01-01', value: 100 },
  { date: '2024-01-02', value: 105 },
  { date: '2024-01-03', value: 110 },
];

describe('ChartComponent', () => {
  it('renders line chart by default', () => {
    render(<ChartComponent data={mockData} />);
    
    // Chart container should be rendered
    const chartContainer = document.querySelector('.chart-container');
    expect(chartContainer).toBeInTheDocument();
  });

  it('renders bar chart when type is bar', () => {
    render(<ChartComponent data={mockData} type="bar" />);
    
    const chartContainer = document.querySelector('.chart-container');
    expect(chartContainer).toBeInTheDocument();
  });

  it('renders area chart when type is area', () => {
    render(<ChartComponent data={mockData} type="area" />);
    
    const chartContainer = document.querySelector('.chart-container');
    expect(chartContainer).toBeInTheDocument();
  });

  it('renders baseline chart when type is baseline', () => {
    render(<ChartComponent data={mockData} type="baseline" />);

    const chartContainer = document.querySelector('.chart-container');
    expect(chartContainer).toBeInTheDocument();
  });

  it('displays title when provided', () => {
    render(<ChartComponent data={mockData} title="Price History" />);
    
    expect(screen.getByText('Price History')).toBeInTheDocument();
  });

  it('displays time range when provided', () => {
    render(<ChartComponent data={mockData} timeRange="Last 30 days" />);
    
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
  });

  it('displays axis labels when provided', () => {
    render(
      <ChartComponent
        data={mockData}
        xAxisLabel="Date"
        yAxisLabel="Price"
      />
    );
    
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
  });
});
