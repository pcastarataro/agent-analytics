import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { SortableTable, Column } from '../../src/components/SortableTable';

interface TestRow extends Record<string, unknown> {
  name: string;
  count: number;
}

const columns: Column<TestRow>[] = [
  { key: 'name', label: 'Name' },
  { key: 'count', label: 'Count', sortable: true },
];

const data: TestRow[] = [
  { name: 'Alice', count: 30 },
  { name: 'Bob', count: 10 },
  { name: 'Charlie', count: 20 },
];

afterEach(() => {
  cleanup();
});

describe('SortableTable', () => {
  it('renders column headers', () => {
    render(<SortableTable columns={columns} data={data} />);
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('Count')).toBeDefined();
  });

  it('renders all data rows', () => {
    render(<SortableTable columns={columns} data={data} />);
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('Charlie')).toBeDefined();
  });

  it('sorts ascending on first click', () => {
    render(<SortableTable columns={columns} data={data} />);
    fireEvent.click(screen.getByText('Count'));

    const cells = screen.getAllByRole('cell');
    const countCells = cells.filter((c) => /^\d+$/.test(c.textContent ?? ''));
    expect(countCells[0].textContent).toBe('10');
    expect(countCells[1].textContent).toBe('20');
    expect(countCells[2].textContent).toBe('30');
  });

  it('sorts descending on second click', () => {
    render(<SortableTable columns={columns} data={data} />);
    fireEvent.click(screen.getByText('Count'));
    fireEvent.click(screen.getByText('Count', { selector: 'span' }));

    const cells = screen.getAllByRole('cell');
    const countCells = cells.filter((c) => /^\d+$/.test(c.textContent ?? ''));
    expect(countCells[0].textContent).toBe('30');
    expect(countCells[1].textContent).toBe('20');
    expect(countCells[2].textContent).toBe('10');
  });

  it('shows empty message when data is empty', () => {
    render(<SortableTable columns={columns} data={[]} emptyMessage="No data." />);
    expect(screen.getByText('No data.')).toBeDefined();
  });

  it('uses custom render function', () => {
    const customColumns: Column<TestRow>[] = [
      { key: 'name', label: 'Name' },
      {
        key: 'count',
        label: 'Count',
        render: (row) => `${row.count} items`,
      },
    ];
    render(<SortableTable columns={customColumns} data={data} />);
    expect(screen.getByText('30 items')).toBeDefined();
  });
});
