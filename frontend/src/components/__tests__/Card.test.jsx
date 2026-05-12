import { render, screen } from '@testing-library/react';
import React from 'react';
import Card from '../Card.jsx';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Test content</Card>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
});
