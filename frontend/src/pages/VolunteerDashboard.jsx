import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Award,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  Clock3,
  Plus,
  Sparkles,
  Star,
  Target,
  Trash2,
  User,
  X,
} from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import Card from '../components/Card.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import VolunteerTeamJoiner from '../components/VolunteerTeamJoiner.jsx';
import { assignmentAPI, userAPI, attendanceAPI } from '../utils/api.js';

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

const statusStyles = {
  accepted: 'badge-success',
  pending: 'badge-warning',
  declined: 'badge-danger',
};

const VolunteerDashboard = () => {
  const [profile, setProfile] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [skillForm, setSkillForm] = useState({
    name: skillCatalog[0],
    level: 'beginner',
  });
  const [skillActionState, setSkillActionState] = useState({
    submitting: false,
    message: '',
    type: 'idle',
  });
  const [assignmentActionState, setAssignmentActionState] = useState({
    updatingId: null,
    message: '',
    type: 'idle',
  });
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [proofDrafts, setProofDrafts] = useState({});
  const [proofFiles, setProofFiles] = useState({});
  const [proofActionState, setProofActionState] = useState({
    submittingId: null,
    message: '',
    type: 'idle',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const availableSkills = useMemo(() => {
    const existingSkills = new Set((profile?.skills || []).map((skill) => skill.name.toLowerCase()));
    return skillCatalog.filter((skill) => !existingSkills.has(skill.toLowerCase()));
  }, [profile]);

  useEffect(() => {
    if (!availableSkills.length) {
      return;
    }

    setSkillForm((current) => {
      if (availableSkills.includes(current.name)) {
        return current;
      }

      return {
        ...current,
        name: availableSkills[0],
      };
    });
  }, [availableSkills]);

  const fetchData = async () => {
    try {
      const [profileRes, assignmentsRes] = await Promise.all([
        userAPI.getProfile(),
        assignmentAPI.getAssignments(),
      ]);

      setProfile(profileRes.data);
      setAssignments(assignmentsRes.data.assignments || []);

      const attendanceRes = await attendanceAPI.getAttendanceByVolunteer(profileRes.data._id);
      const attendanceMap = {};
      (attendanceRes.data.attendance || []).forEach((record) => {
        if (record.assignmentId?._id) {
          attendanceMap[record.assignmentId._id] = record;
        }
      });
      setAttendanceRecords(attendanceMap);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkillChange = (event) => {
    const { name, value } = event.target;
    setSkillForm((current) => ({ ...current, [name]: value }));
  };

  const handleAddSkill = async (event) => {
    event.preventDefault();

    const existingSkill = profile?.skills?.some(
      (skill) => skill.name.toLowerCase() === skillForm.name.toLowerCase()
    );

    if (existingSkill) {
      setSkillActionState({
        submitting: false,
        message: 'That skill is already in your profile.',
        type: 'error',
      });
      return;
    }

    setSkillActionState({
      submitting: true,
      message: '',
      type: 'idle',
    });

    try {
      const response = await userAPI.addSkill(skillForm);
      setProfile(response.data.user);
      setSkillActionState({
        submitting: false,
        message: 'Skill added to your volunteer profile.',
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to add skill:', error);
      setSkillActionState({
        submitting: false,
        message: 'Could not save that skill right now.',
        type: 'error',
      });
    }
  };

  const handleRemoveSkill = async (skillName) => {
    try {
      const response = await userAPI.removeSkill({ skillName });
      setProfile(response.data.user);
      setSkillActionState({
        submitting: false,
        message: `${skillName} removed from your profile.`,
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to remove skill:', error);
      setSkillActionState({
        submitting: false,
        message: 'Could not remove that skill right now.',
        type: 'error',
      });
    }
  };

  const handleAssignmentResponse = async (assignmentId, status) => {
    try {
      setAssignmentActionState({
        updatingId: assignmentId,
        message: '',
        type: 'idle',
      });

      const response = await assignmentAPI.updateAssignmentStatus(assignmentId, { status });
      const updatedAssignment = response.data.assignment;

      setAssignments((current) =>
        current.map((assignment) =>
          assignment._id === assignmentId
            ? { ...assignment, ...updatedAssignment, status: updatedAssignment.status }
            : assignment
        )
      );

      setAssignmentActionState({
        updatingId: null,
        message:
          status === 'accepted'
            ? 'You accepted the event assignment.'
            : 'You declined the event assignment.',
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to update assignment:', error);
      setAssignmentActionState({
        updatingId: null,
        message: 'Could not update that assignment right now.',
        type: 'error',
      });
    }
  };

  const handleProofChange = (assignmentId, field, value) => {
    setProofDrafts((prev) => ({
      ...prev,
      [assignmentId]: {
        ...(prev[assignmentId] || {}),
        [field]: value,
      },
    }));
  };

  const handleProofFileChange = (assignmentId, file) => {
    setProofFiles((prev) => ({
      ...prev,
      [assignmentId]: file,
    }));
  };

  const handleSubmitProof = async (assignment) => {
    const draft = proofDrafts[assignment._id] || {};
    const file = proofFiles[assignment._id];

    if (!file && !draft.proofImage) {
      setProofActionState({
        submittingId: null,
        message: 'Please add a proof image file or URL before submitting.',
        type: 'error',
      });
      return;
    }

    try {
      setProofActionState({ submittingId: assignment._id, message: '', type: 'idle' });
      let proofImageUrl = draft.proofImage;

      if (file) {
        const formData = new FormData();
        formData.append('proof', file);
        const uploadRes = await attendanceAPI.uploadAttendanceProof(formData);
        proofImageUrl = uploadRes.data.fileUrl;
      }

      const response = await attendanceAPI.submitAttendanceProof({
        eventId: assignment.eventId?._id,
        assignmentId: assignment._id,
        proofImage: proofImageUrl,
        volunteerNotes: draft.volunteerNotes || '',
      });

      setAttendanceRecords((prev) => ({
        ...prev,
        [assignment._id]: response.data.attendance,
      }));
      setProofActionState({
        submittingId: null,
        message: 'Proof submitted. Organizer verification is pending.',
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to submit proof:', error);
      setProofActionState({
        submittingId: null,
        message: error.response?.data?.message || 'Failed to submit proof.',
        type: 'error',
      });
    }
  };

  const acceptedAssignments = assignments.filter((assignment) => assignment.status === 'accepted').length;
  const pendingAssignments = assignments.filter((assignment) => assignment.status === 'pending').length;
  const performanceScore = profile?.performanceScore || 0;
  const skillCount = profile?.skills?.length || 0;

  const topMatchScore = useMemo(() => {
    if (!assignments.length) return 0;
    return Math.max(...assignments.map((assignment) => assignment.matchScore?.totalScore || 0));
  }, [assignments]);

  const stats = [
    {
      title: 'Assignments',
      value: assignments.length,
      note: 'Total opportunities assigned to you',
      icon: Briefcase,
      tint: 'bg-[#e4dcff] text-[#5b3cc4]',
    },
    {
      title: 'Accepted',
      value: acceptedAssignments,
      note: 'Confirmed and ready to deliver',
      icon: CheckCircle2,
      tint: 'bg-[#dcf8ee] text-[#0f9f75]',
    },
    {
      title: 'Pending',
      value: pendingAssignments,
      note: 'Awaiting your response',
      icon: Clock3,
      tint: 'bg-[rgba(214,164,55,0.18)] text-[#6b56cc]',
    },
    {
      title: 'Performance',
      value: `${performanceScore}%`,
      note: 'Your current reliability score',
      icon: Award,
      tint: 'bg-[rgba(51,99,187,0.12)] text-[#4b46c8]',
    },
  ];

  if (loading) {
    return (
      <div className="app-shell gradient-light flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">
            <div className="loading-spinner mx-auto mb-4 h-14 w-14"></div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#766e97]">Building your dashboard</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell gradient-light flex min-h-screen">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
          <Header
            title="Volunteer Command Deck"
            subtitle={`Welcome back, ${profile?.name || 'Volunteer'}. Stay on top of your assignments, sharpen your skill profile, and keep your event readiness visible to organizers.`}
            icon={<Sparkles size={28} />}
            showUserProfile={true}
          />

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.95fr]"
          >
            <div
              className="hero-image relative overflow-hidden rounded-[34px] gradient-primary px-7 py-8 text-white shadow-glow-lg"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1700&q=80')",
              }}
            >
              <div className="absolute right-[-30px] top-[-20px] h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute bottom-[-40px] left-[35%] h-32 w-32 rounded-full bg-violet-200/30 blur-2xl" />

              <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-violet-100">Mission Pulse</p>
                  <h2 className="text-3xl font-black leading-tight md:text-5xl">
                    Your volunteer impact is live and visible.
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-violet-50 md:text-base">
                    Keep your skills current, respond to assignments faster, and give organizers a clearer signal about where you can contribute best.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 md:min-w-[320px]">
                  <div className="rounded-[24px] bg-white/12 p-4 backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.2em] text-violet-100">Top Match</p>
                    <p className="mt-3 text-3xl font-black">{topMatchScore}%</p>
                  </div>
                  <div className="rounded-[24px] bg-white/12 p-4 backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.2em] text-violet-100">Skills</p>
                    <p className="mt-3 text-3xl font-black">{skillCount}</p>
                  </div>
                </div>
              </div>
            </div>

            <Card hoverable={false} className="shell-panel border-0 p-7">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">Readiness Snapshot</p>
                  <h3 className="mt-2 text-2xl font-bold text-[#1d1736]">Profile strength</h3>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[#fff1e6] text-[#5b3cc4]">
                  <Target size={22} />
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-[#403b63]">Performance trend</span>
                    <span className="font-bold text-[#5b3cc4]">{performanceScore}%</span>
                  </div>
                  <ProgressBar value={performanceScore} color="orange" showPercentage={false} />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-[#403b63]">Skill coverage</span>
                    <span className="font-bold text-[#0f9f75]">{Math.min(skillCount * 10, 100)}%</span>
                  </div>
                  <ProgressBar value={Math.min(skillCount * 10, 100)} color="green" showPercentage={false} />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="rounded-[22px] bg-[#f8f5ff] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#766e97]">Participations</p>
                    <p className="mt-2 text-2xl font-black text-[#1d1736]">{profile?.totalParticipations || 0}</p>
                  </div>
                  <div className="rounded-[22px] bg-[#eef8f3] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#6b8d80]">Ready Skills</p>
                    <p className="mt-2 text-2xl font-black text-[#1d1736]">{skillCount}</p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.section>

          <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat, index) => {
              const Icon = stat.icon;

              return (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                >
                  <Card hoverable={false} className="shell-panel border-0 p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#5f5a7a]">{stat.title}</p>
                        <p className="mt-3 text-4xl font-black text-[#1d1736]">{stat.value}</p>
                        <p className="mt-3 text-sm leading-6 text-[#726c90]">{stat.note}</p>
                      </div>
                      <div className={`flex h-14 w-14 items-center justify-center rounded-[22px] ${stat.tint}`}>
                        <Icon size={22} />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </section>

          <section className="grid grid-cols-1 gap-8 xl:grid-cols-[0.95fr_1.45fr]">
            <motion.div
              id="skills"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-8"
            >
              <Card hoverable={false} className="shell-panel border-0 p-7">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">Skill Studio</p>
                    <h3 className="mt-2 text-2xl font-bold text-[#1d1736]">Add skill sets with dropdowns</h3>
                    <p className="mt-2 text-sm leading-6 text-[#5f5a7a]">
                      Expand your volunteer profile so organizers can place you with higher-confidence matches.
                    </p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[#fff1e6] text-[#5b3cc4]">
                    <Star size={22} />
                  </div>
                </div>

                <form onSubmit={handleAddSkill} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#403b63]">Skill</label>
                    <select
                      name="name"
                      value={availableSkills.includes(skillForm.name) ? skillForm.name : availableSkills[0] || ''}
                      onChange={handleSkillChange}
                      disabled={!availableSkills.length || skillActionState.submitting}
                      className="input-field"
                    >
                      {availableSkills.length ? (
                        availableSkills.map((skill) => (
                          <option key={skill} value={skill}>
                            {skill}
                          </option>
                        ))
                      ) : (
                        <option value="">All suggested skills already added</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#403b63]">Level</label>
                    <select
                      name="level"
                      value={skillForm.level}
                      onChange={handleSkillChange}
                      disabled={skillActionState.submitting}
                      className="input-field"
                    >
                      {levelOptions.map((level) => (
                        <option key={level} value={level}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={!availableSkills.length || skillActionState.submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1d1736] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2457] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus size={18} />
                    <span>{skillActionState.submitting ? 'Saving...' : 'Add Skill Set'}</span>
                  </button>
                </form>

                {skillActionState.message && (
                  <div
                    className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${
                      skillActionState.type === 'success'
                        ? 'bg-[#eef8f3] text-[#0f9f75]'
                        : 'bg-[#fff1ee] text-[#7f2ea8]'
                    }`}
                  >
                    {skillActionState.message}
                  </div>
                )}
              </Card>

              <Card hoverable={false} className="shell-panel border-0 p-7">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">Skill Matrix</p>
                    <h3 className="mt-2 text-2xl font-bold text-[#1d1736]">Your current skills</h3>
                  </div>
                  <div className="badge badge-primary">{skillCount} listed</div>
                </div>

                <div className="space-y-3">
                  {profile?.skills?.length ? (
                    profile.skills.map((skill) => (
                      <div
                        key={`${skill.name}-${skill.level}`}
                        className="flex items-center justify-between gap-4 rounded-[22px] bg-white/80 px-4 py-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f1ecff] text-[#5b3cc4]">
                            <Sparkles size={18} />
                          </div>
                          <div>
                            <p className="font-semibold text-[#1d1736]">{skill.name}</p>
                            <p className="text-sm capitalize text-[#5f5a7a]">{skill.level}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveSkill(skill.name)}
                          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff1ee] text-[#7f2ea8] transition hover:bg-[#ffe3dd]"
                          aria-label={`Remove ${skill.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[24px] bg-white/70 px-5 py-8 text-center">
                      <p className="text-sm font-semibold text-[#403b63]">No skills added yet</p>
                      <p className="mt-2 text-sm text-[#5f5a7a]">Use the dropdown above to build out your volunteer profile.</p>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-8"
            >
              <Card hoverable={false} className="shell-panel border-0 p-7">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">Assignment Board</p>
                    <h3 className="mt-2 text-2xl font-bold text-[#1d1736]">Current assignments</h3>
                    <p className="mt-2 text-sm leading-6 text-[#5f5a7a]">
                      A clean view of active work, event details, and how strongly each role matches your profile.
                    </p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[#eef8f3] text-[#0f9f75]">
                    <Activity size={22} />
                  </div>
                </div>

                <div className="space-y-4">
                  {assignmentActionState.message && (
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                        assignmentActionState.type === 'success'
                          ? 'bg-[#eef8f3] text-[#0f9f75]'
                          : 'bg-[#fff1ee] text-[#7f2ea8]'
                      }`}
                    >
                      {assignmentActionState.message}
                    </div>
                  )}

                  {proofActionState.message && (
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                        proofActionState.type === 'success'
                          ? 'bg-[#eef8f3] text-[#0f9f75]'
                          : 'bg-[#fff1ee] text-[#7f2ea8]'
                      }`}
                    >
                      {proofActionState.message}
                    </div>
                  )}

                  {assignments.length ? (
                    assignments.slice(0, 6).map((assignment) => (
                      <div
                        key={assignment._id}
                        className="rounded-[28px] border border-white/60 bg-white/82 p-5"
                      >
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="h-12 w-12 overflow-hidden rounded-xl bg-white/80">
                              {assignment.eventId?.eventLogo ? (
                                <img
                                  src={assignment.eventId.eventLogo}
                                  alt={`${assignment.eventId?.eventName || 'Event'} logo`}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-[#766e97]">
                                  LOGO
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-lg font-bold text-[#1d1736]">
                                {assignment.eventId?.eventName || 'Untitled Event'}
                              </p>
                              <p className="mt-1 text-sm text-[#5f5a7a]">
                                {assignment.roleId?.roleName || 'Volunteer role'}
                              </p>
                            </div>
                          </div>
                          <span className={`badge ${statusStyles[assignment.status] || 'badge-primary'}`}>
                            {assignment.status}
                          </span>
                        </div>

                        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div className="rounded-2xl bg-[#f8f5ff] px-4 py-3">
                            <div className="mb-2 flex items-center gap-2 text-[#5b3cc4]">
                              <Calendar size={15} />
                              <span className="text-xs font-bold uppercase tracking-[0.18em]">Event</span>
                            </div>
                            <p className="text-sm font-medium text-[#403b63]">
                              {assignment.eventId?.date
                                ? new Date(assignment.eventId.date).toLocaleDateString()
                                : 'Date not available'}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-[#eef8f3] px-4 py-3">
                            <div className="mb-2 flex items-center gap-2 text-[#0f9f75]">
                              <User size={15} />
                              <span className="text-xs font-bold uppercase tracking-[0.18em]">Role</span>
                            </div>
                            <p className="text-sm font-medium text-[#403b63]">
                              {assignment.roleId?.roleName || 'Not specified'}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-[#f3f0ff] px-4 py-3">
                            <div className="mb-2 flex items-center gap-2 text-[#6a4ad2]">
                              <ArrowRight size={15} />
                              <span className="text-xs font-bold uppercase tracking-[0.18em]">Score</span>
                            </div>
                            <p className="text-sm font-medium text-[#403b63]">
                              {assignment.matchScore?.totalScore || 0}% match
                            </p>
                          </div>
                        </div>

                        <ProgressBar
                          value={assignment.matchScore?.totalScore || 0}
                          label="Profile fit"
                          color={assignment.status === 'accepted' ? 'green' : 'orange'}
                        />

                        {(assignment.eventId?.mottoText || assignment.eventId?.mottoImage) && (
                          <div className="mt-4 rounded-[20px] bg-white/70 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#766e97]">Event Motto</p>
                            {assignment.eventId?.mottoText && (
                              <p className="mt-1 text-sm font-medium text-[#403b63]">{assignment.eventId.mottoText}</p>
                            )}
                            {assignment.eventId?.mottoImage && (
                              <img
                                src={assignment.eventId.mottoImage}
                                alt={`${assignment.eventId?.eventName || 'Event'} motto`}
                                className="mt-2 h-24 w-full rounded-lg object-cover"
                              />
                            )}
                          </div>
                        )}

                        {assignment.status === 'pending' && (
                          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                            <button
                              onClick={() => handleAssignmentResponse(assignment._id, 'accepted')}
                              disabled={assignmentActionState.updatingId === assignment._id}
                              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0f9f75] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#256453] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Check size={16} />
                              <span>
                                {assignmentActionState.updatingId === assignment._id
                                  ? 'Saving...'
                                  : 'Accept Event'}
                              </span>
                            </button>

                            <button
                              onClick={() => handleAssignmentResponse(assignment._id, 'declined')}
                              disabled={assignmentActionState.updatingId === assignment._id}
                              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#7f2ea8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#6a268b] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <X size={16} />
                              <span>
                                {assignmentActionState.updatingId === assignment._id
                                  ? 'Saving...'
                                  : 'Decline Event'}
                              </span>
                            </button>
                          </div>
                        )}

                        {assignment.status === 'accepted' && (
                          <div className="mt-5 rounded-[24px] bg-[#f8f5ff] p-4">
                            <p className="text-sm font-semibold text-[#403b63]">Attendance proof</p>
                            <p className="mt-1 text-xs text-[#5f5a7a]">
                              Upload a proof image after the event so the organizer can verify attendance.
                            </p>

                            {attendanceRecords[assignment._id]?.proofImage ? (
                              <div className="mt-3 text-sm text-[#0f9f75]">
                                Proof submitted. Status: {attendanceRecords[assignment._id]?.verificationStatus || 'pending'}.
                              </div>
                            ) : (
                              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(event) =>
                                    handleProofFileChange(assignment._id, event.target.files?.[0])
                                  }
                                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm"
                                />
                                <input
                                  type="text"
                                  placeholder="Proof image URL"
                                  className="input-field"
                                  value={proofDrafts[assignment._id]?.proofImage || ''}
                                  onChange={(event) =>
                                    handleProofChange(assignment._id, 'proofImage', event.target.value)
                                  }
                                />
                                <input
                                  type="text"
                                  placeholder="Volunteer notes (optional)"
                                  className="input-field"
                                  value={proofDrafts[assignment._id]?.volunteerNotes || ''}
                                  onChange={(event) =>
                                    handleProofChange(assignment._id, 'volunteerNotes', event.target.value)
                                  }
                                />
                                <button
                                  onClick={() => handleSubmitProof(assignment)}
                                  disabled={proofActionState.submittingId === assignment._id}
                                  className="md:col-span-2 flex items-center justify-center rounded-2xl bg-[#1d1736] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2457] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {proofActionState.submittingId === assignment._id
                                    ? 'Submitting...'
                                    : 'Submit proof'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[24px] bg-white/70 px-5 py-10 text-center">
                      <p className="text-base font-semibold text-[#1d1736]">No assignments yet</p>
                      <p className="mt-2 text-sm text-[#5f5a7a]">
                        Once organizers start matching volunteers, your assignment feed will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card id="availability" hoverable={false} className="shell-panel border-0 p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">Availability</p>
                      <h3 className="mt-2 text-xl font-bold text-[#1d1736]">Schedule visibility</h3>
                    </div>
                    <Calendar size={20} className="text-[#5b3cc4]" />
                  </div>

                  <div className="rounded-[24px] bg-white/70 p-5">
                    <p className="text-sm leading-7 text-[#5f5a7a]">
                      {profile?.availability?.length
                        ? `${profile.availability.length} availability entries are saved in your profile.`
                        : 'No availability slots saved yet. Add schedule windows from your profile settings to improve assignment quality.'}
                    </p>
                  </div>
                </Card>

                <Card id="history" hoverable={false} className="shell-panel border-0 p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">History</p>
                      <h3 className="mt-2 text-xl font-bold text-[#1d1736]">Participation record</h3>
                    </div>
                    <Award size={20} className="text-[#0f9f75]" />
                  </div>

                  <div className="rounded-[24px] bg-white/70 p-5">
                    <p className="text-sm leading-7 text-[#5f5a7a]">
                      {profile?.participationHistory?.length
                        ? `${profile.participationHistory.length} event records captured so far.`
                        : 'Your completed-event history will populate here as attendance is recorded.'}
                    </p>
                  </div>
                </Card>
              </div>

              <Card hoverable={false} className="shell-panel border-0 p-6">
                <VolunteerTeamJoiner />
              </Card>

              <Card hoverable={false} className="shell-panel border-0 p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">Inspiration Wall</p>
                    <h3 className="mt-2 text-xl font-bold text-[#1d1736]">Teamwork in action</h3>
                  </div>
                  <Sparkles size={20} className="text-[#5b3cc4]" />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    {
                      title: 'Group Discussion',
                      image:
                        'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
                    },
                    {
                      title: 'Teamwork',
                      image:
                        'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
                    },
                    {
                      title: 'Unity',
                      image:
                        'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
                    },
                    {
                      title: 'Peaceful Collaboration',
                      image:
                        'https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?auto=format&fit=crop&w=1200&q=80',
                    },
                    {
                      title: 'Smooth Operations',
                      image:
                        'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
                    },
                    {
                      title: 'AI Coordination',
                      image:
                        'https://images.unsplash.com/photo-1674027444485-cec3da58eef4?auto=format&fit=crop&w=1200&q=80',
                    },
                  ].map((item) => (
                    <div key={item.title} className="hero-image h-44" style={{ backgroundImage: `url(${item.image})` }}>
                      <div className="flex h-full items-end p-4">
                        <p className="text-sm font-bold uppercase tracking-[0.16em] text-white">{item.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default VolunteerDashboard;
