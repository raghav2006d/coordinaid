export const eventVisuals = {
  general: {
    label: 'General',
    image:
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80',
    summary: 'Multi-purpose volunteering with coordination and crowd support.',
  },
  hackathon: {
    label: 'Hackathon',
    image:
      'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80',
    summary: 'Students collaborating on laptops with technical coordination support.',
  },
  technical: {
    label: 'Technical',
    image:
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80',
    summary: 'Workshops, coding sessions, and stage-tech execution.',
  },
  sports: {
    label: 'Sports',
    image:
      'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1600&q=80',
    summary: 'High-energy event flow, registration, and field-side logistics.',
  },
  cultural: {
    label: 'Cultural',
    image:
      'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1600&q=80',
    summary: 'Stage coordination, hospitality, and audience engagement.',
  },
  community: {
    label: 'Community',
    image:
      'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1600&q=80',
    summary: 'Outreach, public interaction, and service-focused volunteering.',
  },
};

export const eventCategoryOptions = Object.entries(eventVisuals).map(([value, config]) => ({
  value,
  label: config.label,
}));

export const getEventVisual = (category) => eventVisuals[category] || eventVisuals.general;
