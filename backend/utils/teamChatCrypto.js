import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

const resolveSecret = () =>
  String(process.env.TEAM_CHAT_SECRET || process.env.JWT_SECRET || 'coordinaid-team-chat-secret');

const deriveKey = () =>
  crypto.createHash('sha256').update(resolveSecret()).digest();

export const encryptTeamMessage = (plainText = '') => {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedContent: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
};

export const decryptTeamMessage = ({ encryptedContent, iv, authTag }) => {
  try {
    const key = deriveKey();
    const decipher = crypto.createDecipheriv(
      ALGO,
      key,
      Buffer.from(String(iv || ''), 'base64')
    );
    decipher.setAuthTag(Buffer.from(String(authTag || ''), 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(String(encryptedContent || ''), 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    return '[Unable to decrypt message]';
  }
};
