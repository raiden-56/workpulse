import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
} from '@mui/material';
import type { ReactNode } from 'react';
import type { PageMeta } from '@/types/api';
import { EmptyState } from '../common/EmptyState';
import { LoadingSkeleton } from '../common/LoadingSkeleton';

export interface Column<T> {
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  hideBelow?: 'sm' | 'md' | 'lg';
}

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  meta?: PageMeta;
  page?: number;
  size?: number;
  onPageChange?: (page: number) => void;
  onSizeChange?: (size: number) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  caption?: string;
  dense?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  meta,
  page = 0,
  size = 25,
  onPageChange,
  onSizeChange,
  sort,
  onSortChange,
  onRowClick,
  emptyTitle = 'Nothing to show',
  emptyDescription,
  caption,
  dense,
}: DataTableProps<T>) {
  const hideSx = (c: Column<T>) => (c.hideBelow ? { display: { xs: 'none', [c.hideBelow]: 'table-cell' } } : undefined);

  return (
    <Box>
      <TableContainer>
        <Table size={dense ? 'small' : 'medium'} aria-busy={loading || undefined}>
          {caption && <caption className="wp-visually-hidden">{caption}</caption>}
          <TableHead>
            <TableRow>
              {columns.map((c) => (
                <TableCell key={c.id} align={c.align} sx={{ width: c.width, ...hideSx(c) }} sortDirection={sort?.field === c.id ? sort.direction : false}>
                  {c.sortable && onSortChange ? (
                    <TableSortLabel
                      active={sort?.field === c.id}
                      direction={sort?.field === c.id ? sort.direction : 'asc'}
                      onClick={() => onSortChange({ field: c.id, direction: sort?.field === c.id && sort.direction === 'asc' ? 'desc' : 'asc' })}
                    >
                      {c.label}
                    </TableSortLabel>
                  ) : (
                    c.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading &&
              rows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  hover={!!onRowClick}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => (e.key === 'Enter' ? onRowClick(row) : undefined) : undefined}
                  sx={{ cursor: onRowClick ? 'pointer' : 'default', transition: 'background-color 100ms' }}
                >
                  {columns.map((c) => (
                    <TableCell key={c.id} align={c.align} sx={hideSx(c)}>
                      {c.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      {loading && <LoadingSkeleton variant="table" rows={Math.min(size, 8)} />}
      {!loading && rows.length === 0 && <EmptyState compact title={emptyTitle} description={emptyDescription} />}
      {meta && onPageChange && (
        <TablePagination
          component="div"
          count={meta.totalElements}
          page={Math.min(page, Math.max(0, meta.totalPages - 1))}
          rowsPerPage={size}
          onPageChange={(_e, p) => onPageChange(p)}
          onRowsPerPageChange={onSizeChange ? (e) => onSizeChange(Number(e.target.value)) : undefined}
          rowsPerPageOptions={onSizeChange ? [10, 25, 50, 100] : [size]}
        />
      )}
    </Box>
  );
}
