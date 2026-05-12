import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import CreateEventPage from '../CreateEventPage.jsx';
import { vi } from 'vitest';

vi.mock('../../components/Sidebar.jsx', () => ({
  default: () => <div>Sidebar</div>,
}));
vi.mock('../../components/Header.jsx', () => ({
  default: () => <div>Header</div>,
}));
vi.mock('../../components/Card.jsx', () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock('../../utils/api.js', () => ({
  eventAPI: {
    createEvent: vi.fn(),
    addRoleToEvent: vi.fn(),
  },
}));

describe('CreateEventPage', () => {
  it('renders event form fields', () => {
    render(
      <BrowserRouter>
        <CreateEventPage />
      </BrowserRouter>
    );

    expect(screen.getByText('AI Event Planning Assistant')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Annual Sports Day')).toBeInTheDocument();
    expect(screen.getAllByText('Custom time range').length).toBeGreaterThan(0);
  });
});
