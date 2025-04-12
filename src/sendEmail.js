import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

const sendTicketEmail = async (recipientEmail, ticketData) => {
  console.log('Firebase db instance:', db);

  const messageId = uuidv4();

  // Gọi API backend để gửi email
  const response = await fetch('https://mypass-email-backend.onrender.com/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipientEmail,
      ticketData: {
        ...ticketData,
        firstName: ticketData.firstName,
        lastName: ticketData.lastName,
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to send email via backend');
  }

  console.log(`Email sent to ${recipientEmail}`);

  // Lưu thông tin email vào Firestore
  try {
    await setDoc(doc(db, 'emailTracking', messageId), {
      messageId,
      recipientEmail,
      eventId: ticketData.eventId,
      seatId: ticketData.seatId,
      sentAt: new Date().toISOString(),
      opened: false,
      openedAt: null,
      linkClicked: false,
      linkClickedAt: null,
    });
    console.log(`Email tracking saved to Firestore: ${messageId}`);
  } catch (firestoreError) {
    console.error(`Error saving email tracking to Firestore: ${firestoreError.message}`);
    throw firestoreError;
  }

  return messageId;
};

export { sendTicketEmail };