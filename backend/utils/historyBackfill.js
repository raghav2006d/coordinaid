import Assignment from '../models/Assignment.js';
import AssignmentHistory from '../models/AssignmentHistory.js';

export const runAssignmentHistoryBackfill = async () => {
  const assignments = await Assignment.find({});
  let createdCount = 0;

  for (const assignment of assignments) {
    const existing = await AssignmentHistory.findOne({ assignmentId: assignment._id });
    if (existing) {
      continue;
    }

    await AssignmentHistory.create({
      assignmentId: assignment._id,
      eventId: assignment.eventId,
      roleId: assignment.roleId,
      volunteerId: assignment.volunteerId,
      action: 'created',
      toStatus: assignment.status,
      note: 'Backfilled from existing assignment',
      actorRole: 'system',
    });
    createdCount += 1;
  }

  return { createdCount, total: assignments.length };
};
