import React from 'react';

/* ── Primitive blocks ── */
const Bar = ({ w = '100%', h = 14, r = 4, style }) => (
  <div className="sk-bar" style={{ width: w, height: h, borderRadius: r, ...style }} />
);

const Circle = ({ size = 32 }) => (
  <div className="sk-bar" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }} />
);

/* ── KPI row (4 cards) ── */
export function SkeletonKpi({ count = 4 }) {
  return (
    <div className="kpi-grid sk-fade">
      {Array.from({ length: count }, (_, i) => (
        <div className="kpi-card" key={i} style={{ animationDelay: `${i * .05}s` }}>
          <Bar w={80} h={10} />
          <Bar w={120} h={28} style={{ marginTop: 12 }} />
          <Bar w={60} h={10} style={{ marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

/* ── Page head ── */
export function SkeletonHead({ hasButton = true }) {
  return (
    <div className="page-head sk-fade">
      <div>
        <Bar w={180} h={22} />
        <Bar w={120} h={12} style={{ marginTop: 8 }} />
      </div>
      {hasButton && <Bar w={140} h={36} r={8} />}
    </div>
  );
}

/* ── Table: toolbar + header + rows ── */
export function SkeletonTable({ cols = 5, rows = 6, hasToolbar = true, hasAvatar = false }) {
  return (
    <div className="table-card sk-fade" style={{ animationDelay: '.15s' }}>
      {hasToolbar && (
        <div className="table-toolbar">
          <Bar w={220} h={32} r={6} />
          <Bar w={80} h={24} r={6} style={{ marginLeft: 'auto' }} />
        </div>
      )}
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }, (_, i) => (
              <th key={i}><Bar w={`${50 + Math.random() * 40}%`} h={10} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c}>
                  {c === 0 && hasAvatar ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Circle size={32} />
                      <div style={{ flex: 1 }}>
                        <Bar w="70%" h={12} />
                        <Bar w="50%" h={9} style={{ marginTop: 5 }} />
                      </div>
                    </div>
                  ) : (
                    <Bar w={`${40 + Math.random() * 50}%`} h={12} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Preset composites per page ── */

export function DashboardSkeleton() {
  return (
    <>
      <SkeletonKpi count={4} />
      <SkeletonTable cols={5} rows={5} />
    </>
  );
}

export function CatalogSkeleton() {
  return (
    <>
      <SkeletonHead />
      <SkeletonTable cols={7} rows={6} />
    </>
  );
}

export function OrdersSkeleton() {
  return (
    <>
      <SkeletonHead />
      <SkeletonTable cols={6} rows={6} />
    </>
  );
}

export function InventorySkeleton() {
  return (
    <>
      <SkeletonHead />
      <SkeletonTable cols={6} rows={6} hasToolbar={false} />
      <SkeletonTable cols={5} rows={4} />
    </>
  );
}

export function CustomersSkeleton() {
  return (
    <>
      <SkeletonHead />
      <SkeletonKpi count={5} />
      <SkeletonTable cols={8} rows={6} hasAvatar />
    </>
  );
}

export function EmployeesSkeleton() {
  return (
    <>
      <SkeletonHead />
      <SkeletonKpi count={4} />
      <SkeletonTable cols={7} rows={6} hasAvatar />
    </>
  );
}

export default function Skeleton({ variant = 'table' }) {
  switch (variant) {
    case 'dashboard':  return <DashboardSkeleton />;
    case 'catalog':    return <CatalogSkeleton />;
    case 'orders':     return <OrdersSkeleton />;
    case 'inventory':  return <InventorySkeleton />;
    case 'customers':  return <CustomersSkeleton />;
    case 'employees':  return <EmployeesSkeleton />;
    default:           return <SkeletonTable />;
  }
}
