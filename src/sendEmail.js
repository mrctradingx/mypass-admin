const { db } = require('./firebase');
const { doc, setDoc } = require('firebase/firestore');
const { v4: uuidv4 } = require('uuid');

const sendTicketEmail = async (recipientEmail, ticketData) => {
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

  return messageId;
};

module.exports = { sendTicketEmail };