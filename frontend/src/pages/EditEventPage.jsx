import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sparkles, Save } from 'lucide-react';
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

const EditEventPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [formData, setFormData] = useState({
    eventName: '',
    description: '',
    eventLogo: '',
    mottoText: '',
    mottoImage: '',
    date: '',
    venue: '',
    category: 'general',
    maxVolunteers: '',
    isFullDay: false,
    startTime: '',
    endTime: '',
  });
  const [roles, setRoles] = useState([]);
  const [roleDrafts, setRoleDrafts] = useState({});
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [skillDrafts, setSkillDrafts] = useState({});
  const [deletingRoleId, setDeletingRoleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [eventLogoFile, setEventLogoFile] = useState(null);
  const [mottoImageFile, setMottoImageFile] = useState(null);
  const activeVisual = getEventVisual(formData.category);

  useEffect(() => {
    fetchEvent();
  }, []);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      const res = await eventAPI.getEventById(id);
      const event = res.data;
      setFormData({
        eventName: event.eventName || '',
        description: event.description || '',
        eventLogo: event.eventLogo || '',
        mottoText: event.mottoText || '',
        mottoImage: event.mottoImage || '',
        date: event.date ? event.date.slice(0, 10) : '',
        venue: event.venue || '',
        category: event.category || 'general',
        maxVolunteers: event.maxVolunteers || '',
        isFullDay: Boolean(event.isFullDay),
        startTime: event.startTime || '09:00',
        endTime: event.endTime || '13:00',
      });
      const eventRoles = event.roles || [];
      setRoles(eventRoles);
      const drafts = {};
      const skillDraftMap = {};
      eventRoles.forEach((role) => {
        drafts[role._id] = {
          roleName: role.roleName || '',
          description: role.description || '',
          requiredCount: role.requiredCount || '',
          preferredExperienceLevel: role.preferredExperienceLevel || 'intermediate',
          requiredSkills: role.requiredSkills || [],
          isFullDay: Boolean(role.isFullDay),
          startTime: role.startTime || '09:00',
          endTime: role.endTime || '13:00',
        };
        skillDraftMap[role._id] = {
          name: skillCatalog[0],
          minimumLevel: 'beginner',
        };
      });
      setRoleDrafts(drafts);
      setSkillDrafts(skillDraftMap);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const updateRoleDraft = (roleId, field, value) => {
    setRoleDrafts((prev) => ({
      ...prev,
      [roleId]: { ...prev[roleId], [field]: value },
    }));
  };

  const handleRoleTimeTypeChange = (roleId, value) => {
    const isFullDay = value === 'full-day';
    setRoleDrafts((prev) => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        isFullDay,
        startTime: isFullDay ? '' : prev[roleId]?.startTime || '09:00',
        endTime: isFullDay ? '' : prev[roleId]?.endTime || '13:00',
      },
    }));
  };

  const addRoleSkill = (roleId) => {
    const draft = roleDrafts[roleId];
    const skillDraft = skillDrafts[roleId];
    if (!draft || !skillDraft) return;
    const duplicate = draft.requiredSkills.some(
      (skill) => skill.name.toLowerCase() === skillDraft.name.toLowerCase()
    );
    if (duplicate) return;
    updateRoleDraft(roleId, 'requiredSkills', [...draft.requiredSkills, skillDraft]);
  };

  const removeRoleSkill = (roleId, skillName) => {
    const draft = roleDrafts[roleId];
    if (!draft) return;
    updateRoleDraft(
      roleId,
      'requiredSkills',
      draft.requiredSkills.filter((skill) => skill.name !== skillName)
    );
  };

  const saveRole = async (roleId) => {
    const draft = roleDrafts[roleId];
    if (!draft) return;

    if (!draft.isFullDay) {
      const [startHour, startMinute] = draft.startTime.split(':').map((value) => Number(value));
      const [endHour, endMinute] = draft.endTime.split(':').map((value) => Number(value));
      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;
      if (Number.isNaN(startTotal) || Number.isNaN(endTotal) || endTotal <= startTotal) {
        setError('Role end time must be later than start time.');
        return;
      }
    }

    try {
      setSavingRoleId(roleId);
      const payload = {
        ...draft,
        requiredCount: Number(draft.requiredCount),
      };
      const res = await eventAPI.updateRoleInEvent(id, roleId, payload);
      setRoles((prev) => prev.map((role) => (role._id === roleId ? res.data.role : role)));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update role');
    } finally {
      setSavingRoleId(null);
    }
  };

  const deleteRole = async (roleId) => {
    try {
      setDeletingRoleId(roleId);
      await eventAPI.deleteRoleFromEvent(id, roleId);
      setRoles((prev) => prev.filter((role) => role._id !== roleId));
      setRoleDrafts((prev) => {
        const updated = { ...prev };
        delete updated[roleId];
        return updated;
      });
      setSkillDrafts((prev) => {
        const updated = { ...prev };
        delete updated[roleId];
        return updated;
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete role');
    } finally {
      setDeletingRoleId(null);
    }
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    if (!formData.isFullDay) {
      const [startHour, startMinute] = formData.startTime.split(':').map((value) => Number(value));
      const [endHour, endMinute] = formData.endTime.split(':').map((value) => Number(value));
      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;

      if (Number.isNaN(startTotal) || Number.isNaN(endTotal) || endTotal <= startTotal) {
        setError('End time must be later than start time.');
        setSaving(false);
        return;
      }
    }

    try {
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

      await eventAPI.updateEvent(id, {
        ...formData,
        eventLogo: eventLogoUrl,
        mottoImage: mottoImageUrl,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell gradient-light flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-sm font-semibold text-[#6a5d54]">Loading event...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell gradient-light flex min-h-screen">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-8 md:py-8">
          <Header
            title="Edit Event"
            subtitle="Update event details and time range with the same validation rules."
            icon={<Sparkles size={28} />}
            showUserProfile={true}
          />

          <div className="hero-image soft-ring mb-6 p-6" style={{ backgroundImage: `url(${activeVisual.image})` }}>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-100">Event Visual Context</p>
            <h3 className="mt-3 max-w-3xl text-3xl font-black text-white md:text-4xl">
              {activeVisual.label} Event
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-orange-50">{activeVisual.summary}</p>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl bg-[#fff1ee] px-4 py-4 text-sm font-medium text-[#a24431]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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
                    {formData.eventLogo && (
                      <img
                        src={formData.eventLogo}
                        alt="Event logo"
                        className="mt-3 h-20 w-20 rounded-xl object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Motto image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setMottoImageFile(event.target.files?.[0] || null)}
                      className="input-field"
                    />
                    {formData.mottoImage && (
                      <img
                        src={formData.mottoImage}
                        alt="Motto visual"
                        className="mt-3 h-20 w-28 rounded-xl object-cover"
                      />
                    )}
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
                  <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Time type</label>
                  <select
                    value={formData.isFullDay ? 'full-day' : 'custom'}
                    onChange={handleFullDayChange}
                    className="input-field"
                  >
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
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Category</label>
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
                  />
                </div>
              </div>
            </Card>

            <Card hoverable={false} className="shell-panel border-0 p-7">
              <h3 className="mb-6 text-2xl font-bold text-[#1f1a17]">Edit roles</h3>
              <div className="space-y-6">
                {roles.map((role) => {
                  const draft = roleDrafts[role._id];
                  const skillDraft = skillDrafts[role._id] || { name: skillCatalog[0], minimumLevel: 'beginner' };
                  if (!draft) return null;

                  return (
                    <div key={role._id} className="rounded-[24px] bg-white/82 p-5">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Role name</label>
                          <input
                            type="text"
                            value={draft.roleName}
                            onChange={(event) => updateRoleDraft(role._id, 'roleName', event.target.value)}
                            className="input-field"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Volunteers needed</label>
                          <input
                            type="number"
                            value={draft.requiredCount}
                            onChange={(event) => updateRoleDraft(role._id, 'requiredCount', event.target.value)}
                            className="input-field"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Role description</label>
                          <textarea
                            rows="3"
                            value={draft.description}
                            onChange={(event) => updateRoleDraft(role._id, 'description', event.target.value)}
                            className="input-field"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Preferred experience</label>
                          <select
                            value={draft.preferredExperienceLevel}
                            onChange={(event) => updateRoleDraft(role._id, 'preferredExperienceLevel', event.target.value)}
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
                            value={draft.isFullDay ? 'full-day' : 'custom'}
                            onChange={(event) => handleRoleTimeTypeChange(role._id, event.target.value)}
                            className="input-field"
                          >
                            <option value="custom">Custom time range</option>
                            <option value="full-day">Full day</option>
                          </select>
                        </div>
                      </div>

                      {!draft.isFullDay && (
                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Role start time</label>
                            <input
                              type="time"
                              value={draft.startTime}
                              onChange={(event) => updateRoleDraft(role._id, 'startTime', event.target.value)}
                              className="input-field"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Role end time</label>
                            <input
                              type="time"
                              value={draft.endTime}
                              onChange={(event) => updateRoleDraft(role._id, 'endTime', event.target.value)}
                              className="input-field"
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-5 rounded-[20px] bg-white/70 p-4">
                        <p className="mb-3 text-sm font-semibold text-[#4d3e34]">Required skills</p>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto]">
                          <select
                            value={skillDraft.name}
                            onChange={(event) =>
                              setSkillDrafts((prev) => ({
                                ...prev,
                                [role._id]: { ...skillDraft, name: event.target.value },
                              }))
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
                              setSkillDrafts((prev) => ({
                                ...prev,
                                [role._id]: { ...skillDraft, minimumLevel: event.target.value },
                              }))
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
                            onClick={() => addRoleSkill(role._id)}
                            className="rounded-2xl bg-[#1f1a17] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#362822]"
                          >
                            Add skill
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {draft.requiredSkills.map((skill) => (
                            <span key={`${role._id}-${skill.name}`} className="badge badge-primary">
                              {skill.name} - {skill.minimumLevel}
                              <button
                                type="button"
                                onClick={() => removeRoleSkill(role._id, skill.name)}
                                className="ml-2 text-[#a24431]"
                              >
                                x
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => deleteRole(role._id)}
                          disabled={deletingRoleId === role._id}
                          className="rounded-2xl bg-[#a24431] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#893827] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingRoleId === role._id ? 'Deleting...' : 'Delete role'}
                        </button>
                        <button
                          type="button"
                          onClick={() => saveRole(role._id)}
                          disabled={savingRoleId === role._id}
                          className="rounded-2xl bg-[#2f7d6a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#256453] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingRoleId === role._id ? 'Saving...' : 'Save role'}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {!roles.length && (
                  <p className="text-sm text-[#6a5d54]">No roles found for this event.</p>
                )}
              </div>
            </Card>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1f1a17] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#362822] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              <span>{saving ? 'Updating...' : 'Update event'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditEventPage;
