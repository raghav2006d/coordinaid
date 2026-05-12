import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import Card from '../components/Card.jsx';
import { eventAPI } from '../utils/api.js';
import { eventCategoryOptions, getEventVisual } from '../utils/eventVisuals.js';

const skillCatalog = [
  'Registration Desk',
  'Crowd Management',
  'Public Speaking',
  'Stage Coordination',
  'Logistics',
  'First Aid',
  'Photography',
  'Social Media',
  'Data Entry',
  'Hospitality',
  'Technical Support',
  'Volunteer Coordination',
];

const levelOptions = ['beginner', 'intermediate', 'advanced'];
const plannerEventTypeOptions = [
  { value: 'tech-fest', label: 'Tech Fest' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'workshop', label: 'Workshop' },
];

const eventTypeToCategory = {
  'tech-fest': 'technical',
  cultural: 'cultural',
  workshop: 'community',
};

const CreateEventPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    eventName: '',
    description: '',
    eventLogo: '',
    mottoText: '',
    mottoImage: '',
    eventType: 'general',
    expectedAttendees: '',
    durationHours: '',
    date: '',
    venue: '',
    category: 'general',
    maxVolunteers: '',
    isFullDay: false,
    startTime: '09:00',
    endTime: '13:00',
  });
  const [roles, setRoles] = useState([]);
  const [newRole, setNewRole] = useState({
    roleName: '',
    description: '',
    requiredCount: '',
    preferredExperienceLevel: 'intermediate',
    requiredSkills: [],
    isFullDay: false,
    startTime: '09:00',
    endTime: '13:00',
  });
  const [skillDraft, setSkillDraft] = useState({
    name: skillCatalog[0],
    minimumLevel: 'beginner',
  });
  const [loading, setLoading] = useState(false);
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState(null);
  const [error, setError] = useState('');
  const [eventLogoFile, setEventLogoFile] = useState(null);
  const [mottoImageFile, setMottoImageFile] = useState(null);
  const activeVisual = getEventVisual(formData.category);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFullDayChange = (event) => {
    const isFullDay = event.target.value === 'full-day';
    setFormData((prev) => ({
      ...prev,
      isFullDay,
      startTime: isFullDay ? '' : prev.startTime || '09:00',
      endTime: isFullDay ? '' : prev.endTime || '13:00',
    }));
  };

  const handleRoleChange = (event) => {
    const { name, value } = event.target;
    setNewRole((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleTimeTypeChange = (event) => {
    const isFullDay = event.target.value === 'full-day';
    setNewRole((prev) => ({
      ...prev,
      isFullDay,
      startTime: isFullDay ? '' : prev.startTime || '09:00',
      endTime: isFullDay ? '' : prev.endTime || '13:00',
    }));
  };

  const addRequiredSkill = () => {
    const duplicate = newRole.requiredSkills.some(
      (skill) => skill.name.toLowerCase() === skillDraft.name.toLowerCase()
    );

    if (duplicate) {
      return;
    }

    setNewRole((prev) => ({
      ...prev,
      requiredSkills: [...prev.requiredSkills, skillDraft],
    }));
  };

  const removeRequiredSkill = (skillName) => {
    setNewRole((prev) => ({
      ...prev,
      requiredSkills: prev.requiredSkills.filter((skill) => skill.name !== skillName),
    }));
  };

  const addRole = () => {
    if (!newRole.roleName || !newRole.requiredCount) {
      setError('Please enter role name and required volunteer count before adding the role.');
      return;
    }

    if (!newRole.isFullDay) {
      const [startHour, startMinute] = newRole.startTime.split(':').map((value) => Number(value));
      const [endHour, endMinute] = newRole.endTime.split(':').map((value) => Number(value));
      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;
      if (Number.isNaN(startTotal) || Number.isNaN(endTotal) || endTotal <= startTotal) {
        setError('Role end time must be later than start time.');
        return;
      }
    }

    setError('');
    setRoles((prev) => [...prev, { ...newRole }]);
    setNewRole({
      roleName: '',
      description: '',
      requiredCount: '',
      preferredExperienceLevel: 'intermediate',
      requiredSkills: [],
      isFullDay: false,
      startTime: '09:00',
      endTime: '13:00',
    });
  };

  const removeRole = (index) => {
    setRoles((prev) => prev.filter((_, roleIndex) => roleIndex !== index));
  };

  const handleGenerateAiPlan = async () => {
    const attendees = Number(formData.expectedAttendees);
    const durationHours = Number(formData.durationHours);

    if (!attendees || attendees < 1) {
      setError('Please enter expected attendees before generating the AI plan.');
      return;
    }

    setError('');
    setAiPlanLoading(true);

    try {
      const response = await eventAPI.generateAiPlan({
        eventType: formData.eventType,
        attendees,
        durationHours: Number.isNaN(durationHours) ? 0 : durationHours,
      });
      setAiPlan(response.data.plan);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate AI event plan.');
      setAiPlan(null);
    } finally {
      setAiPlanLoading(false);
    }
  };

  const handleUseAiPlan = () => {
    if (!aiPlan) {
      return;
    }

    const mappedRoles = (aiPlan.roles || []).map((role) => ({
      roleName: role.roleName,
      description: `AI suggested ${role.roleName.toLowerCase()} responsibilities.`,
      requiredCount: String(role.requiredCount),
      preferredExperienceLevel: role.preferredExperienceLevel || 'intermediate',
      requiredSkills: role.requiredSkills || [],
      isFullDay: false,
      startTime: formData.startTime || '09:00',
      endTime: formData.endTime || '13:00',
    }));

    setRoles(mappedRoles);
    setFormData((prev) => ({
      ...prev,
      maxVolunteers: String(aiPlan.totalVolunteers || prev.maxVolunteers || ''),
      expectedAttendees: String(aiPlan.attendees || prev.expectedAttendees || ''),
      durationHours: String(aiPlan.durationHours || prev.durationHours || ''),
      eventType: aiPlan.eventType || prev.eventType,
      category: eventTypeToCategory[aiPlan.eventType] || prev.category,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.isFullDay) {
        const [startHour, startMinute] = formData.startTime.split(':').map((value) => Number(value));
        const [endHour, endMinute] = formData.endTime.split(':').map((value) => Number(value));
        const startTotal = startHour * 60 + startMinute;
        const endTotal = endHour * 60 + endMinute;

        if (Number.isNaN(startTotal) || Number.isNaN(endTotal) || endTotal <= startTotal) {
          setError('End time must be later than start time.');
          setLoading(false);
          return;
        }
      }

      let eventLogoUrl = formData.eventLogo;
      let mottoImageUrl = formData.mottoImage;

      if (eventLogoFile) {
        const logoFormData = new FormData();
        logoFormData.append('eventLogo', eventLogoFile);
        const logoUploadRes = await eventAPI.uploadEventLogo(logoFormData);
        eventLogoUrl = logoUploadRes.data.fileUrl;
      }

      if (mottoImageFile) {
        const mottoFormData = new FormData();
        mottoFormData.append('mottoImage', mottoImageFile);
        const mottoUploadRes = await eventAPI.uploadMottoImage(mottoFormData);
        mottoImageUrl = mottoUploadRes.data.fileUrl;
      }

      const eventRes = await eventAPI.createEvent({
        ...formData,
        maxVolunteers: Number(formData.maxVolunteers),
        expectedAttendees: Number(formData.expectedAttendees) || 0,
        durationHours: Number(formData.durationHours) || 0,
        eventLogo: eventLogoUrl,
        mottoImage: mottoImageUrl,
      });
      const eventId = eventRes.data.event._id;

      for (const role of roles) {
        await eventAPI.addRoleToEvent(eventId, {
          ...role,
          requiredCount: Number(role.requiredCount),
        });
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell gradient-light flex min-h-screen">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1300px] px-4 py-6 md:px-8 md:py-8">
          <Header
            title="Create Event Blueprint"
            subtitle="Define event goals, add role requirements, and shape the AI input with skill and experience expectations."
            icon={<Sparkles size={28} />}
            showUserProfile={true}
          />

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="hero-image soft-ring p-6" style={{ backgroundImage: `url(${activeVisual.image})` }}>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-100">Event Moodboard</p>
              <h3 className="mt-3 max-w-3xl text-3xl font-black text-white md:text-4xl">
                {activeVisual.label} Event Experience
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-orange-50">{activeVisual.summary}</p>
            </div>
          </motion.section>

          {error && (
            <div className="mb-6 rounded-2xl bg-[#fff1ee] px-4 py-4 text-sm font-medium text-[#a24431]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <Card hoverable={false} className="shell-panel border-0 p-7">
              <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-[#1f1a17]">AI Event Planning Assistant</h3>
                  <p className="mt-2 text-sm text-[#6a5d54]">
                    Generate volunteer count, role distribution, and skill requirements from attendee demand.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAiPlan}
                  disabled={aiPlanLoading}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-[#1f1a17] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#362822] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Wand2 size={16} />
                  <span>{aiPlanLoading ? 'Generating...' : 'Generate AI Plan'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Event type</label>
                  <select
                    name="eventType"
                    value={formData.eventType}
                    onChange={handleInputChange}
                    className="input-field"
                  >
                    {plannerEventTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Expected attendees</label>
                  <input
                    type="number"
                    name="expectedAttendees"
                    min="0"
                    value={formData.expectedAttendees}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="250"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Duration (hours)</label>
                  <input
                    type="number"
                    name="durationHours"
                    min="0"
                    step="0.5"
                    value={formData.durationHours}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="4"
                  />
                </div>
              </div>

              {aiPlan && (
                <div className="mt-6 rounded-[24px] bg-white/80 p-5">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#4d3e34]">
                        Suggested volunteers: <span className="text-[#1f1a17]">{aiPlan.totalVolunteers}</span>
                      </p>
                      <p className="mt-1 text-xs text-[#6a5d54]">Formula: {aiPlan.formula}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleUseAiPlan}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-[#2f7d6a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#256453]"
                    >
                      <CheckCircle2 size={15} />
                      <span>Use AI Plan</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {aiPlan.roles?.map((role) => (
                      <div key={role.roleKey} className="rounded-[20px] border border-white/60 bg-white/90 p-4">
                        <p className="font-bold text-[#1f1a17]">{role.roleName}</p>
                        <p className="text-sm text-[#6a5d54]">
                          {role.requiredCount} volunteers ({Math.round(role.percentage * 100)}%)
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(role.requiredSkills || []).map((skill) => (
                            <span key={`${role.roleKey}-${skill.name}`} className="badge badge-primary">
                              {skill.name} - {skill.minimumLevel}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card hoverable={false} className="shell-panel border-0 p-7">
              <h3 className="mb-6 text-2xl font-bold text-[#1f1a17]">Event details</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Event name</label>
                  <input
                    type="text"
                    name="eventName"
                    value={formData.eventName}
                    onChange={handleInputChange}
                    required
                    className="input-field"
                    placeholder="Annual Sports Day"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="4"
                    className="input-field"
                    placeholder="Describe the event, audience, and volunteer expectations."
                  />
                </div>

                <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Event logo image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setEventLogoFile(event.target.files?.[0] || null)}
                      className="input-field"
                    />
                    <p className="mt-2 text-xs text-[#6a5d54]">Upload logo for this event brand.</p>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Motto image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setMottoImageFile(event.target.files?.[0] || null)}
                      className="input-field"
                    />
                    <p className="mt-2 text-xs text-[#6a5d54]">Upload an image representing the event motto.</p>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Motto text</label>
                  <input
                    type="text"
                    name="mottoText"
                    value={formData.mottoText}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="Example: Build. Learn. Launch."
                  />
                </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Date</label>
                <input
                  type="date"
                  name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                  className="input-field"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Time slot</label>
                <select value={formData.isFullDay ? 'full-day' : 'custom'} onChange={handleFullDayChange} className="input-field">
                  <option value="custom">Custom time range</option>
                  <option value="full-day">Full day</option>
                </select>
              </div>

              {!formData.isFullDay && (
                <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Start time</label>
                    <input
                      type="time"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleInputChange}
                      required={!formData.isFullDay}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">End time</label>
                    <input
                      type="time"
                      name="endTime"
                      value={formData.endTime}
                      onChange={handleInputChange}
                      required={!formData.isFullDay}
                      className="input-field"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Venue</label>
                <input
                  type="text"
                  name="venue"
                    value={formData.venue}
                    onChange={handleInputChange}
                    required
                    className="input-field"
                  placeholder="Main auditorium"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Event category</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="input-field"
                >
                  {eventCategoryOptions.map((categoryOption) => (
                    <option key={categoryOption.value} value={categoryOption.value}>
                      {categoryOption.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Maximum volunteers</label>
                <input
                  type="number"
                    name="maxVolunteers"
                    value={formData.maxVolunteers}
                    onChange={handleInputChange}
                    required
                    className="input-field"
                    placeholder="30"
                  />
                </div>
              </div>
            </Card>

            <Card hoverable={false} className="shell-panel border-0 p-7">
              <h3 className="mb-6 text-2xl font-bold text-[#1f1a17]">Role and requirement definition</h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Role name</label>
                  <input
                    type="text"
                    name="roleName"
                    value={newRole.roleName}
                    onChange={handleRoleChange}
                    className="input-field"
                    placeholder="Stage Coordinator"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Volunteers needed</label>
                  <input
                    type="number"
                    name="requiredCount"
                    value={newRole.requiredCount}
                    onChange={handleRoleChange}
                    className="input-field"
                    placeholder="4"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Role description</label>
                  <textarea
                    name="description"
                    value={newRole.description}
                    onChange={handleRoleChange}
                    rows="3"
                    className="input-field"
                    placeholder="What this role needs during the event."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Preferred experience</label>
                  <select
                    name="preferredExperienceLevel"
                    value={newRole.preferredExperienceLevel}
                    onChange={handleRoleChange}
                    className="input-field"
                  >
                    {levelOptions.map((level) => (
                      <option key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Role time type</label>
                  <select
                    value={newRole.isFullDay ? 'full-day' : 'custom'}
                    onChange={handleRoleTimeTypeChange}
                    className="input-field"
                  >
                    <option value="custom">Custom time range</option>
                    <option value="full-day">Full day</option>
                  </select>
                </div>
              </div>

              {!newRole.isFullDay && (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Role start time</label>
                    <input
                      type="time"
                      name="startTime"
                      value={newRole.startTime}
                      onChange={handleRoleChange}
                      required={!newRole.isFullDay}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Role end time</label>
                    <input
                      type="time"
                      name="endTime"
                      value={newRole.endTime}
                      onChange={handleRoleChange}
                      required={!newRole.isFullDay}
                      className="input-field"
                    />
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-[24px] bg-white/70 p-5">
                <p className="mb-4 text-sm font-semibold text-[#4d3e34]">Required skills</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto]">
                  <select
                    value={skillDraft.name}
                    onChange={(event) =>
                      setSkillDraft((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="input-field"
                  >
                    {skillCatalog.map((skill) => (
                      <option key={skill} value={skill}>
                        {skill}
                      </option>
                    ))}
                  </select>

                  <select
                    value={skillDraft.minimumLevel}
                    onChange={(event) =>
                      setSkillDraft((prev) => ({ ...prev, minimumLevel: event.target.value }))
                    }
                    className="input-field"
                  >
                    {levelOptions.map((level) => (
                      <option key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={addRequiredSkill}
                    className="rounded-2xl bg-[#1f1a17] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#362822]"
                  >
                    Add skill
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {newRole.requiredSkills.map((skill) => (
                    <div
                      key={skill.name}
                      className="flex items-center gap-3 rounded-2xl bg-[#fff4ea] px-4 py-2 text-sm font-medium text-[#8a4224]"
                    >
                      <span>{skill.name}</span>
                      <span className="capitalize text-[#6a5d54]">{skill.minimumLevel}</span>
                      <button type="button" onClick={() => removeRequiredSkill(skill.name)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={addRole}
                className="mt-6 flex items-center gap-2 rounded-2xl bg-[#2f7d6a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#256453]"
              >
                <Plus size={16} />
                <span>Add role to event</span>
              </button>

              {roles.length > 0 && (
                <div className="mt-6 space-y-4">
                  {roles.map((role, index) => (
                    <div key={`${role.roleName}-${index}`} className="rounded-[24px] bg-white/82 p-5">
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-bold text-[#1f1a17]">{role.roleName}</p>
                          <p className="text-sm text-[#6a5d54]">{role.requiredCount} volunteers needed</p>
                        </div>
                        <button type="button" onClick={() => removeRole(index)} className="text-[#a24431]">
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <p className="text-sm text-[#6a5d54]">{role.description || 'No description added.'}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {role.requiredSkills.map((skill) => (
                          <span key={skill.name} className="badge badge-primary">
                            {skill.name} - {skill.minimumLevel}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-2xl bg-[#1f1a17] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#362822] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Creating event...' : 'Create event and roles'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateEventPage;
