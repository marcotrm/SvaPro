import React from 'react';
import clsx from 'clsx';

export default function StatCard({ title, value, icon: Icon, color = 'blue', onClick }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        'p-4 rounded-lg border transition',
        colorClasses[color],
        onClick && 'cursor-pointer hover:shadow-md hover:scale-105'
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        {Icon && <Icon size={28} className="opacity-30" />}
      </div>
    </div>
  );
}
