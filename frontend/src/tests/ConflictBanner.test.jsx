import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConflictBanner from '../components/ConflictBanner.jsx';

describe('ConflictBanner', () => {
  test('renders SUCCESS status and message', () => {
    render(
      <ConflictBanner
        result={{ status: 'SUCCESS', message: 'All good', diagnostics: [], unscheduled: [] }}
      />
    );
    expect(screen.getByText('SUCCESS')).toBeTruthy();
    expect(screen.getByText('All good')).toBeTruthy();
  });

  test('renders unscheduled sessions and diagnostics for FAILED status', () => {
    render(
      <ConflictBanner
        result={{
          status: 'FAILED',
          message: 'Could not schedule',
          diagnostics: [{ code: 'NO_SUITABLE_ROOM', message: 'No room fits.' }],
          unscheduled: [{ sessionId: 'MATH-A-S1', reasons: ['FACULTY_CONFLICT'] }],
        }}
      />
    );
    expect(screen.getByText('FAILED')).toBeTruthy();
    expect(screen.getByText(/MATH-A-S1/)).toBeTruthy();
    expect(screen.getByText('No room fits.')).toBeTruthy();
  });

  test('renders nothing when result is null', () => {
    const { container } = render(<ConflictBanner result={null} />);
    expect(container.innerHTML).toBe('');
  });
});
