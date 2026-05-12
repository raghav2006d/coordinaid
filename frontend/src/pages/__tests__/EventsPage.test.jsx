import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import EventsPage from '../EventsPage.jsx';

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
    getEvents: vi.fn().mockResolvedValue({ data: { events: [] } }),
    deleteEvent: vi.fn(),
  },
}));

describe('EventsPage', () => {
  it('renders filters and empty state', async () => {
    render(
      <BrowserRouter>
        <EventsPage />
      </BrowserRouter>
    );

    expect(await screen.findByPlaceholderText('Search by event or venue')).toBeInTheDocument();
    expect(await screen.findByText('No events match your filters.')).toBeInTheDocument();
  });
});
