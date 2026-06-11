import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function MetricsChart({ r2, color }) {
  const data = [
    { name: 'R²', value: r2 * 100 }
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis dataKey="name" type="category" hide />
        <Tooltip 
          cursor={{fill: 'transparent'}}
          contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #374151', fontSize: '12px' }}
          formatter={(value) => [`${value.toFixed(1)}%`, 'Akurasi']}
        />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={12} />
      </BarChart>
    </ResponsiveContainer>
  );
}
