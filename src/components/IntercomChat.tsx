import { useEffect } from 'react';
import Intercom from '@intercom/messenger-js-sdk';

interface IntercomChatProps {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
}

const IntercomChat = ({ userId, name, email, createdAt }: IntercomChatProps) => {
  useEffect(() => {
    // Convert ISO timestamp to Unix timestamp in seconds
    const createdAtUnix = Math.floor(new Date(createdAt).getTime() / 1000);
    
    Intercom({
      app_id: 'uo1jz672',
      user_id: userId,
      name: name,
      email: email,
      created_at: createdAtUnix,
    });
  }, [userId, name, email, createdAt]);

  return null;
};

export default IntercomChat;
