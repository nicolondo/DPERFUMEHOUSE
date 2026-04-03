'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './button';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render?: (item: T) => React.ReactNode;
  headerRender?: () => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  rowActions?: (item: T) => React.ReactNode;
  onRowClick?: (item: T) => void;
  keyExtractor?: (item: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  emptyMessage = 'No hay datos para mostrar',
  page = 1,
  pageSize = 20,
  total = 0,
  onPageChange,
  onSort,
  sortKey,
  sortDirection,
  rowActions,
  onRowClick,
  keyExtractor,
}: DataTableProps<T>) {
  const totalPages = Math.ceil(total / pageSize);

  function handleSort(key: string) {
    if (!onSort) return;
    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(key, newDirection);
  }

  if (loading) {
    return <TableSkeleton columns={columns.length + (rowActions ? 1 : 0)} rows={5} />;
  }

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-glass-border bg-glass-100 shadow-glass backdrop-blur-xl p-12 text-center">
        <p className="text-sm text-white/40">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-glass-border bg-glass-100 shadow-glass backdrop-blur-xl md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-glass-border bg-glass-50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/40',
                      col.sortable && 'cursor-pointer select-none hover:text-white/70',
                      col.className
                    )}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.headerRender ? col.headerRender() : col.header}
                      {col.sortable && sortKey === col.key && (
                        sortDirection === 'asc' ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )
                      )}
                    </div>
                  </th>
                ))}
                {rowActions && (
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white/40">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {data.map((item, idx) => (
                <tr
                  key={keyExtractor ? keyExtractor(item) : idx}
                  className={cn(
                    'hover:bg-glass-100 transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 text-sm text-white/70', col.className)}>
                      {col.render
                        ? col.render(item)
                        : String((item as any)[col.key] ?? '')}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {rowActions(item)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {data.map((item, idx) => (
          <div
            key={keyExtractor ? keyExtractor(item) : idx}
            className={cn(
              'rounded-xl border border-glass-border bg-glass-100 p-4 shadow-glass backdrop-blur-xl',
              onRowClick && 'cursor-pointer active:bg-glass-200'
            )}
            onClick={() => onRowClick?.(item)}
          >
            <div className="space-y-2">
              {columns.map((col) => (
                <div key={col.key} className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-white/40">{col.header}</span>
                  <span className="text-sm text-white/70 text-right">
                    {col.render
                      ? col.render(item)
                      : String((item as any)[col.key] ?? '')}
                  </span>
                </div>
              ))}
            </div>
            {rowActions && (
              <div className="mt-3 flex justify-end border-t border-glass-border pt-3" onClick={(e) => e.stopPropagation()}>
                {rowActions(item)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-white/50">
            Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} de {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={page <= 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm text-white/70">
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={page >= totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TableSkeleton({ columns, rows }: { columns: number; rows: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-glass-border bg-glass-100 shadow-glass backdrop-blur-xl">
      <div className="animate-pulse">
        <div className="border-b border-glass-border bg-glass-50 px-4 py-3">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, i) => (
              <div key={i} className="h-4 flex-1 rounded bg-glass-200" />
            ))}
          </div>
        </div>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="border-b border-glass-border px-4 py-3">
            <div className="flex gap-4">
              {Array.from({ length: columns }).map((_, colIdx) => (
                <div key={colIdx} className="h-4 flex-1 rounded bg-glass-200" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
