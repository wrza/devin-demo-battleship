import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

afterEach(cleanup);

function playerCell(name: string) {
  return screen.getByRole('button', { name: new RegExp(`^Your fleet ${name}:`) });
}

describe('App', () => {
  it('renders both boards and starts in the placement phase', () => {
    render(<App />);

    expect(screen.getByRole('grid', { name: 'Your fleet' })).toBeTruthy();
    expect(screen.getByRole('grid', { name: 'Enemy waters' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/Place your Carrier/);
  });

  it('places a ship on click and advances to the next ship', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(playerCell('A1'));

    expect(screen.getByRole('status').textContent).toMatch(/Place your Battleship/);
    expect(playerCell('A1').className).toMatch(/cell-ship/);
    expect(playerCell('E1').className).toMatch(/cell-ship/);
  });

  it('lets the player fire once the fleet is placed', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Place randomly' }));
    expect(screen.getByRole('status').textContent).toMatch(/Your turn/);

    await user.click(screen.getByRole('button', { name: /^Enemy waters A1:/ }));

    const log = screen.getByRole('region', { name: 'Battle log' });
    expect(within(log).getByText(/You fired at A1/)).toBeTruthy();
  });

  it('disables enemy cells during placement', () => {
    render(<App />);

    const enemyCell = screen.getByRole('button', { name: /^Enemy waters A1:/ });
    expect((enemyCell as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a notice for an invalid placement instead of failing silently', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(playerCell('H1'));

    expect(screen.getByRole('alert').textContent).toBe('The Carrier does not fit there.');
    expect(screen.getByRole('status').textContent).toMatch(/Place your Carrier/);
  });

  it('disables an enemy cell once it has been fired at', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Place randomly' }));
    await user.click(screen.getByRole('button', { name: /^Enemy waters A1:/ }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(/Your turn|You (win|lose)/),
    );

    const fired = screen.getByRole('button', { name: /^Enemy waters A1: (hit|miss)/ });
    expect((fired as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps manually placed ships when placing the rest randomly', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(playerCell('A1'));
    await user.click(screen.getByRole('button', { name: 'Place randomly' }));

    for (const name of ['A1', 'B1', 'C1', 'D1', 'E1']) {
      expect(playerCell(name).className).toMatch(/cell-ship/);
    }
    expect(screen.getByRole('status').textContent).toMatch(/Your turn/);
  });
});
