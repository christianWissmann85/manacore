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
      <div className="h-32 flex items-center justify-center text-glass-text-muted text-xs italic glass-panel border-dashed opacity-70">
        Win probability trend will appear here
      </div>
    );
  }

  const data = winProbabilityHistory.map((point, index) => ({
    ...point,
    index,
    probabilityPercent: point.probability * 100,
  }));

  return (
    <div className="h-40 glass-panel p-2 rounded-lg">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <XAxis
            dataKey="index"
            tick={{ fontSize: 9, fill: '#64748b' }}
            axisLine={{ stroke: '#334155' }}
            tickLine={{ stroke: '#334155' }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: '#64748b' }}
            axisLine={{ stroke: '#334155' }}
            tickLine={{ stroke: '#334155' }}
            tickFormatter={(value) => `${value}`}
            width={30}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#f1f5f9',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
            }}
            itemStyle={{ color: '#f1f5f9' }}
            labelStyle={{
              color: '#94a3b8',
              marginBottom: '4px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: '2px',
            }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Win Prob']}
            labelFormatter={(index) => {
              const point = data[index as number];
              return point?.event ?? `Step ${index}`;
            }}
          />
          {/* 50% reference line */}
          <ReferenceLine
            y={50}
            stroke="#475569"
            strokeDasharray="3 3"
            label={{ value: '50%', position: 'insideRight', fill: '#64748b', fontSize: 9 }}
          />
          <Line
            type="monotone"
            dataKey="probabilityPercent"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
