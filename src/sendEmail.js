const Brevo = require('@getbrevo/brevo');
const { db } = require('./firebase');
const { doc, setDoc } = require('firebase/firestore');
const { v4: uuidv4 } = require('uuid');

const sendTicketEmail = async (recipientEmail, ticketData) => {
  const messageId = uuidv4(); // Tạo ID duy nhất cho email
  const apiInstance = new Brevo.TransactionalEmailsApi();
  apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.sender = { email: 'tickets@mypassdelivery.com', name: 'MyPass Delivery' };
  sendSmtpEmail.to = [{ email: recipientEmail }];
  sendSmtpEmail.subject = `Your Ticket for ${ticketData.eventName}`;
  sendSmtpEmail.htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #003087; text-align: center;">Your Event Ticket</h2>
      <p style="font-size: 16px; color: #333;">Dear Customer,</p>
      <p style="font-size: 16px; color: #333;">Thank you for your purchase! Here are the details of your ticket:</p>
      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
        <p style="margin: 5px 0; font-size: 16px;"><strong>Event:</strong> ${ticketData.eventName}</p>
        <p style="margin: 5px 0; font-size: 16px;"><strong>Date & Time:</strong> ${ticketData.eventDateTime}</p>
        <p style="margin: 5px 0; font-size: 16px;"><strong>Location:</strong> ${ticketData.eventLocation}</p>
        <p style="margin: 5px 0; font-size: 16px;"><strong>Section:</strong> ${ticketData.section}</p>
        <p style="margin: 5px 0; font-size: 16px;"><strong>Row:</strong> ${ticketData.row}</p>
        <p style="margin: 5px 0; font-size: 16px;"><strong>Seat:</strong> ${ticketData.seat}</p>
      </div>
      <p style="font-size: 16px; color: #333; margin-top: 20px;">
        Access your ticket here: 
        <a href="https://www.mypassdelivery.com/${ticketData.eventId}/${ticketData.seatId}?messageId=${messageId}" style="color: #007bff; text-decoration: none;">View Ticket</a>
      </p>
      <p style="font-size: 14px; color: #666; text-align: center; margin-top: 20px;">
        © 2025 MyPass Delivery. All rights reserved.
      </p>
    </div>
  `;

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
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
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }

  return messageId;
};

module.exports = { sendTicketEmail };