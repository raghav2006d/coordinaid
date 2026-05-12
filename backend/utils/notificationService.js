import Notification from '../models/Notification.js';

export const createNotification = async ({
  userId,
  title,
  message,
  type = 'system',
  data = {},
}) => {
  if (!userId || !title || !message) {
    return null;
  }

  return Notification.create({
    userId,
    title,
    message,
    type,
    data,
  });
};
