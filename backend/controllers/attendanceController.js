import Attendance from '../models/Attendance.js';
import Assignment from '../models/Assignment.js';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Role from '../models/Role.js';
import { createNotification } from '../utils/notificationService.js';
import { updateLearningOnAttendance } from '../utils/learningService.js';
import PDFDocument from 'pdfkit';

const applyParticipationCredit = async (volunteerId, assignmentId, attendanceStatus) => {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    return;
  }

  const role = await Role.findById(assignment.roleId);
  const attended = attendanceStatus === 'present';
  const accepted = assignment.status === 'accepted' || assignment.status === 'completed';

  if (attended && assignment.status !== 'completed') {
    assignment.status = 'completed';
    await assignment.save();

    const user = await User.findById(volunteerId);
    const previousParticipations = user.totalParticipations || 0;
    const previousPerformance = user.performanceScore || 0;
    const newScore =
      (previousPerformance * previousParticipations + 100) / (previousParticipations + 1 || 1);

    await User.findByIdAndUpdate(volunteerId, {
      performanceScore: Math.round(newScore),
      totalParticipations: previousParticipations + 1,
      $push: {
        participationHistory: {
          eventId: assignment.eventId,
          roleId: assignment.roleId,
          date: new Date(),
          status: 'completed',
        },
      },
    });
  }

  await updateLearningOnAttendance({
    volunteerId,
    roleName: role?.roleName || '',
    attended,
    accepted,
  });
};

export const markAttendance = async (req, res) => {
  try {
    const { volunteerId, eventId, assignmentId, status, notes } = req.body;

    let attendance = await Attendance.findOne({ assignmentId });

    if (attendance) {
      attendance.status = status;
      attendance.notes = notes || attendance.notes;
      attendance.markedBy = req.user.userId;
      attendance.markedAt = new Date();
      attendance.verificationStatus = 'approved';
      attendance.verifiedBy = req.user.userId;
      attendance.verifiedAt = new Date();
    } else {
      attendance = new Attendance({
        volunteerId,
        eventId,
        assignmentId,
        status,
        notes,
        markedBy: req.user.userId,
        verificationStatus: 'approved',
        verifiedBy: req.user.userId,
        verifiedAt: new Date(),
      });
    }

    await attendance.save();
    await applyParticipationCredit(volunteerId, assignmentId, status);

    const event = await Event.findById(eventId);
    if (event?.createdBy) {
      await createNotification({
        userId: event.createdBy,
        title: 'Attendance marked',
        message: `Attendance has been marked for ${event.eventName}.`,
        type: 'attendance',
        data: { eventId, assignmentId, volunteerId },
      });
    }

    res.status(201).json({
      message: 'Attendance marked',
      attendance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to mark attendance' });
  }
};

export const bulkMarkAttendance = async (req, res) => {
  try {
    const { attendanceData } = req.body;

    const results = [];

    for (const data of attendanceData) {
      let attendance = await Attendance.findOne({ assignmentId: data.assignmentId });

      if (attendance) {
        attendance.status = data.status;
        attendance.notes = data.notes || attendance.notes;
        attendance.markedBy = req.user.userId;
        attendance.markedAt = new Date();
        attendance.verificationStatus = 'approved';
        attendance.verifiedBy = req.user.userId;
        attendance.verifiedAt = new Date();
      } else {
        attendance = new Attendance({
          ...data,
          markedBy: req.user.userId,
          verificationStatus: 'approved',
          verifiedBy: req.user.userId,
          verifiedAt: new Date(),
        });
      }

      await attendance.save();
      results.push(attendance);
      await applyParticipationCredit(data.volunteerId, data.assignmentId, data.status);

      const event = await Event.findById(data.eventId);
      if (event?.createdBy) {
        await createNotification({
          userId: event.createdBy,
          title: 'Attendance updated',
          message: `Attendance updates saved for ${event.eventName}.`,
          type: 'attendance',
          data: { eventId: data.eventId, assignmentId: data.assignmentId, volunteerId: data.volunteerId },
        });
      }
    }

    res.status(201).json({
      message: 'Bulk attendance marked',
      count: results.length,
      results,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to mark attendance' });
  }
};

export const submitAttendanceProof = async (req, res) => {
  try {
    const { eventId, assignmentId, proofImage, volunteerNotes } = req.body;

    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    if (assignment.volunteerId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'You can only submit proof for your own assignment.' });
    }

    if (!proofImage) {
      return res.status(400).json({ message: 'Attendance proof image is required.' });
    }

    let attendance = await Attendance.findOne({ assignmentId });

    if (attendance) {
      attendance.proofImage = proofImage;
      attendance.volunteerNotes = volunteerNotes || attendance.volunteerNotes;
      attendance.proofSubmittedAt = new Date();
      attendance.verificationStatus = 'pending';
      attendance.status = 'present';
      attendance.verifiedBy = null;
      attendance.verifiedAt = null;
      attendance.organizerNotes = '';
    } else {
      attendance = new Attendance({
        volunteerId: req.user.userId,
        eventId,
        assignmentId,
        status: 'present',
        proofImage,
        volunteerNotes,
        proofSubmittedAt: new Date(),
        verificationStatus: 'pending',
      });
    }

    await attendance.save();

    const event = await Event.findById(eventId);
    if (event?.createdBy) {
      await createNotification({
        userId: event.createdBy,
        title: 'Attendance proof submitted',
        message: 'A volunteer submitted attendance proof for verification.',
        type: 'attendance',
        data: { eventId, assignmentId, volunteerId: req.user.userId },
      });
    }

    res.status(201).json({
      message: 'Attendance proof submitted. Organizer verification is pending.',
      attendance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to submit attendance proof' });
  }
};

export const uploadAttendanceProof = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const relativePath = `/uploads/attendance/${req.file.filename}`;
    res.status(201).json({
      message: 'File uploaded successfully.',
      fileUrl: relativePath,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to upload proof file.' });
  }
};

export const verifyAttendanceProof = async (req, res) => {
  try {
    const { verificationStatus, status = 'present', organizerNotes = '' } = req.body;
    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found.' });
    }

    if (!['approved', 'rejected'].includes(verificationStatus)) {
      return res.status(400).json({ message: 'Verification status must be approved or rejected.' });
    }

    attendance.verificationStatus = verificationStatus;
    attendance.organizerNotes = organizerNotes;
    attendance.verifiedBy = req.user.userId;
    attendance.verifiedAt = new Date();

    if (verificationStatus === 'approved') {
      attendance.status = status;
      attendance.markedBy = req.user.userId;
      attendance.markedAt = new Date();
      await applyParticipationCredit(attendance.volunteerId, attendance.assignmentId, status);

      await createNotification({
        userId: attendance.volunteerId,
        title: 'Attendance verified',
        message: 'Your attendance proof was approved.',
        type: 'attendance',
        data: { attendanceId: attendance._id },
      });
    } else {
      await createNotification({
        userId: attendance.volunteerId,
        title: 'Attendance verification failed',
        message: 'Your attendance proof was rejected. Please contact the organizer.',
        type: 'attendance',
        data: { attendanceId: attendance._id },
      });
    }

    await attendance.save();

    res.json({
      message: `Attendance proof ${verificationStatus}.`,
      attendance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to verify attendance proof' });
  }
};

export const getAttendanceByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const attendance = await Attendance.find({ eventId })
      .populate('volunteerId', 'name email department profileImage')
      .populate({
        path: 'assignmentId',
        populate: {
          path: 'roleId',
          select: 'roleName',
        },
      })
      .populate('verifiedBy', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Attendance.countDocuments({ eventId });

    res.json({
      total,
      page,
      limit,
      attendance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch attendance' });
  }
};

export const getAttendanceByVolunteer = async (req, res) => {
  try {
    const targetVolunteerId =
      req.user.role === 'volunteer' ? req.user.userId : req.params.volunteerId;
    const { page = 1, limit = 20 } = req.query;

    const attendance = await Attendance.find({ volunteerId: targetVolunteerId })
      .populate('eventId', 'eventName date venue')
      .populate({
        path: 'assignmentId',
        populate: {
          path: 'roleId',
          select: 'roleName',
        },
      })
      .populate('verifiedBy', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Attendance.countDocuments({ volunteerId: targetVolunteerId });

    res.json({
      total,
      page,
      limit,
      attendance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch attendance' });
  }
};

export const getLeaderboard = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const leaderboard = await User.find({ role: 'volunteer' })
      .sort({ performanceScore: -1, totalParticipations: -1 })
      .limit(limit)
      .select('name email performanceScore totalParticipations skills department profileImage');

    res.json(leaderboard);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch leaderboard' });
  }
};

export const exportLeaderboardCsv = async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const leaderboard = await User.find({ role: 'volunteer' })
      .sort({ performanceScore: -1, totalParticipations: -1 })
      .limit(limit)
      .select('name email performanceScore totalParticipations skills department');

    const header = [
      'Name',
      'Email',
      'Department',
      'Performance Score',
      'Total Participations',
      'Skills',
    ];

    const rows = leaderboard.map((user) => [
      user.name,
      user.email,
      user.department || '',
      user.performanceScore || 0,
      user.totalParticipations || 0,
      (user.skills || []).map((skill) => `${skill.name}:${skill.level}`).join('|'),
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const escaped = String(value ?? '').replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',')
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leaderboard.csv"');
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to export leaderboard' });
  }
};

export const exportAssignmentsCsv = async (req, res) => {
  try {
    const { eventId } = req.query;
    const filter = eventId ? { eventId } : {};

    const assignments = await Assignment.find(filter)
      .populate('volunteerId', 'name email department')
      .populate('eventId', 'eventName date venue')
      .populate('roleId', 'roleName')
      .sort({ createdAt: -1 });

    const header = [
      'Event',
      'Event Date',
      'Venue',
      'Role',
      'Volunteer Name',
      'Volunteer Email',
      'Department',
      'Status',
      'Skill Match',
      'Experience Match',
      'Availability Match',
      'Performance Match',
      'Total Score',
    ];

    const rows = assignments.map((assignment) => [
      assignment.eventId?.eventName || '',
      assignment.eventId?.date ? new Date(assignment.eventId.date).toISOString() : '',
      assignment.eventId?.venue || '',
      assignment.roleId?.roleName || '',
      assignment.volunteerId?.name || '',
      assignment.volunteerId?.email || '',
      assignment.volunteerId?.department || '',
      assignment.status,
      assignment.matchScore?.skillMatch || 0,
      assignment.matchScore?.experienceMatch || 0,
      assignment.matchScore?.availabilityMatch || 0,
      assignment.matchScore?.performanceMatch || 0,
      assignment.matchScore?.totalScore || 0,
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const escaped = String(value ?? '').replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',')
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="assignments.csv"');
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to export assignments' });
  }
};

export const exportLeaderboardPdf = async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const leaderboard = await User.find({ role: 'volunteer' })
      .sort({ performanceScore: -1, totalParticipations: -1 })
      .limit(limit)
      .select('name email performanceScore totalParticipations skills department');

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="leaderboard.pdf"');
    doc.pipe(res);

    doc.fontSize(20).text('Volunteer Leaderboard', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(12).text('Name', 40, doc.y, { continued: true });
    doc.text('Email', 170, doc.y, { continued: true });
    doc.text('Department', 340, doc.y, { continued: true });
    doc.text('Score', 460, doc.y, { continued: true });
    doc.text('Participations', 510, doc.y);
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    leaderboard.forEach((user) => {
      const score = user.performanceScore || 0;
      const participations = user.totalParticipations || 0;
      doc
        .fontSize(10)
        .text(user.name || '-', 40, doc.y, { continued: true, width: 120 })
        .text(user.email || '-', 170, doc.y, { continued: true, width: 160 })
        .text(user.department || '-', 340, doc.y, { continued: true, width: 110 })
        .text(String(score), 460, doc.y, { continued: true, width: 40 })
        .text(String(participations), 510, doc.y, { width: 70 });
      doc.moveDown(0.4);
    });

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to export leaderboard PDF' });
  }
};

export const exportAssignmentsPdf = async (req, res) => {
  try {
    const { eventId } = req.query;
    const filter = eventId ? { eventId } : {};

    const assignments = await Assignment.find(filter)
      .populate('volunteerId', 'name email department')
      .populate('eventId', 'eventName date venue')
      .populate('roleId', 'roleName')
      .sort({ createdAt: -1 });

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="assignments.pdf"');
    doc.pipe(res);

    doc.fontSize(20).text('Assignment Report', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    assignments.forEach((assignment, index) => {
      doc
        .fontSize(12)
        .text(
          `${index + 1}. ${assignment.eventId?.eventName || 'Event'} - ${assignment.roleId?.roleName || 'Role'}`,
          { align: 'left' }
        );
      doc
        .fontSize(10)
        .text(`Volunteer: ${assignment.volunteerId?.name || '-'} (${assignment.volunteerId?.email || '-'})`);
      doc.text(`Department: ${assignment.volunteerId?.department || '-'}`);
      doc.text(`Status: ${assignment.status}`);
      doc.text(`Match Score: ${assignment.matchScore?.totalScore || 0}%`);
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.6);
    });

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to export assignments PDF' });
  }
};
