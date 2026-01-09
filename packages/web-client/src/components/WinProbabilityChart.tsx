import { useGameStore } from '../store/gameStore';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export function WinProbabilityChart() {
  const { winProbabilityHistory } = useGameStore();

  if (winProbabilityHistory.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-500 text-sm bg-board-bg/30 rounded">
        Win probability data will appear as the game progresses
      </div>
    );
  }

  const data = winProbabilityHistory.map((point, index) => ({
    ...point,
    index,
    probabilityPercent: point.probability * 100,
  }));

  return (
    <div className="h-40 bg-board-bg/30 rounded p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <XAxis
            dataKey="index"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={{ stroke: '#374151' }}
            tickLine={{ stroke: '#374151' }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={{ stroke: '#374151' }}
            tickLine={{ stroke: '#374151' }}
            tickFormatter={(value) => `${value}%`}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a2e',
              border: '1px solid #374151',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Win Prob']}
            labelFormatter={(index) => {
              const point = data[index as number];
              return point?.event ?? `Step ${index}`;
            }}
          />
          {/* 50% reference line */}
          <ReferenceLine
            y={50}
            stroke="#6b7280"
            strokeDasharray="3 3"
            label={{ value: '50%', position: 'insideRight', fill: '#6b7280', fontSize: 10 }}
          />
          <Line
            type="monotone"
            dataKey="probabilityPercent"
            stroke="#e94560"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#e94560' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
