import React, { useState, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { v4 as uuidv4 } from 'uuid';
import { encode as base32Encode } from 'base32.js';
import { db } from './firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import TicketDisplay from './TicketDisplay';
import { sendTicketEmail } from './sendEmail';
import './App.css';

function App() {
  const { isAuthenticated, isLoading, loginWithRedirect, logout } = useAuth0();
  const [events, setEvents] = useState([]);
  const [formData, setFormData] = useState({
    eventName: '',
    eventLocation: '',
    eventDateTime: '',
    section: '',
    row: '',
    seatStart: 1,
    seatCount: 1,
    note: '',
    keys: Array(8).fill({ rawToken: '', ck: '', ek: '' }),
  });
  const [editEventId, setEditEventId] = useState(null);
  const [editTokens, setEditTokens] = useState([]);
  const [editNote, setEditNote] = useState('');
  const [appError, setAppError] = useState('');
  const [successMessage, setSuccessMessage] = useState(''); // Thêm state cho thông báo thành công
  const [emailTracking, setEmailTracking] = useState([]);
  const [showEmailForm, setShowEmailForm] = useState(null);
  const [emailFormData, setEmailFormData] = useState({
    recipientEmail: '',
    firstName: '',
    lastName: '',
    subject: '', // Thêm trường subject
  });
  const location = useLocation();

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        console.log('Attempting to fetch events from Firestore...');
        const querySnapshot = await getDocs(collection(db, 'events'));
        console.log('Fetched events:', querySnapshot.docs.length);
        const eventsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEvents(eventsData);
      } catch (err) {
        console.error('Error fetching events from Firestore:', err);
        setAppError('Failed to fetch events: ' + err.message);
      }
    };

    const fetchEmailTracking = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'emailTracking'));
        const trackingData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEmailTracking(trackingData);
      } catch (err) {
        console.error('Error fetching email tracking:', err);
      }
    };

    fetchEvents();
    fetchEmailTracking();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleKeyChange = (index, field, value) => {
    const newKeys = [...formData.keys];
    newKeys[index] = { ...newKeys[index], [field]: value };
    setFormData({ ...formData, keys: newKeys });
  };

  const hexToBase32 = (hexStr) => {
    try {
      const hex = hexStr.replace(/[^0-9a-fA-F]/g, '');
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      }
      return base32Encode(bytes);
    } catch (err) {
      console.error('Error converting hex to Base32:', err);
      return '';
    }
  };

  const validateForm = () => {
    if (!formData.eventName) return "Event Name is required.";
    if (!formData.eventLocation) return "Event Location is required.";
    if (!formData.eventDateTime) return "Event Date & Time is required.";
    if (!formData.section) return "Section is required.";
    if (!formData.row) return "Row is required.";
    if (!formData.seatStart || formData.seatStart < 1) return "Starting Seat must be at least 1.";
    if (!formData.seatCount || formData.seatCount < 1 || formData.seatCount > 8) return "Number of Tickets must be between 1 and 8.";
    return '';
  };

  const generateTickets = async () => {
    const validationError = validateForm();
    if (validationError) {
      setAppError(validationError);
      return;
    }

    setAppError('');
    const eventId = `${formData.eventName.toLowerCase().replace(/\s+/g, '')}-${uuidv4().slice(0, 8)}`;
    const tickets = [];
    const count = parseInt(formData.seatCount, 10);
    const startSeat = parseInt(formData.seatStart, 10);
    const defaultToken = "BeNoABKHo1QVIhHwozICQqwRAAYIatjCaXiADpv/06kTBJlqrYMpwA9q75NoCVxT";
    const defaultCk = "6dfb0b853dbfa5309a9763d3c0fdd2727de9b2e6";
    const defaultEk = "f03c6f066714c536d9e457d79edc74ee0744b999";

    for (let i = 0; i < count && i < 8; i++) {
      const seatNumber = startSeat + i;
      const keyData = formData.keys[i];
      const ckHex = keyData.ck || defaultCk;
      const ekHex = keyData.ek || defaultEk;
      const ckBase32 = hexToBase32(ckHex);
      const ekBase32 = hexToBase32(ekHex);

      if (!ckBase32 || !ekBase32) {
        setAppError(`Invalid Customer Key or Event Key for Ticket ${i + 1}. Must be a valid hex string.`);
        return;
      }

      tickets.push({
        seatId: `seat${seatNumber}`,
        rawToken: keyData.rawToken ? `${keyData.rawToken}-seat${seatNumber}` : `${defaultToken}-seat${seatNumber}`,
        ckBase32,
        ekBase32,
        eventName: formData.eventName,
        eventLocation: formData.eventLocation,
        eventDateTime: formData.eventDateTime,
        section: formData.section,
        row: formData.row,
        seat: seatNumber.toString(),
      });
    }

    const newEvent = { eventId, tickets, note: formData.note || '' };

    try {
      console.log('Attempting to save event to Firestore:', newEvent);
      await addDoc(collection(db, 'events'), newEvent);
      console.log('Event saved successfully:', eventId);
      setEvents([...events, newEvent]);
    } catch (err) {
      console.error('Error saving event:', err);
      setAppError('Failed to save event: ' + err.message);
    }
  };

  const startEditing = (event) => {
    setEditEventId(event.eventId);
    setEditTokens(event.tickets.map((ticket) => ticket.rawToken));
    setEditNote(event.note || '');
  };

  const handleTokenChange = (index, value) => {
    const newTokens = [...editTokens];
    newTokens[index] = value;
    setEditTokens(newTokens);
  };

  const handleNoteChange = (e) => {
    setEditNote(e.target.value);
  };

  const saveTokens = () => {
    const updatedEvents = events.map((event) => {
      if (event.eventId === editEventId) {
        const updatedTickets = event.tickets.map((ticket, index) => ({
          ...ticket,
          rawToken: editTokens[index],
        }));
        return { ...event, tickets: updatedTickets, note: editNote };
      }
      return event;
    });
    setEvents(updatedEvents);
    setEditEventId(null);
    setEditTokens([]);
    setEditNote('');
  };

  const cancelEditing = () => {
    setEditEventId(null);
    setEditTokens([]);
    setEditNote('');
  };

  const openEmailForm = (eventId) => {
    setShowEmailForm(eventId);
    setEmailFormData({ recipientEmail: '', firstName: '', lastName: '', subject: '' });
    setSuccessMessage(''); // Xóa thông báo thành công khi mở form
  };

  const closeEmailForm = () => {
    setShowEmailForm(null);
    setEmailFormData({ recipientEmail: '', firstName: '', lastName: '', subject: '' });
    setSuccessMessage(''); // Xóa thông báo thành công khi đóng form
  };

  const handleEmailFormChange = (e) => {
    setEmailFormData({ ...emailFormData, [e.target.name]: e.target.value });
  };

  const sendEmailForEvent = async (event) => {
    if (!emailFormData.recipientEmail || !emailFormData.firstName || !emailFormData.lastName || !emailFormData.subject) {
      setAppError('Please fill in all fields: Email, First Name, Last Name, and Subject.');
      return;
    }

    setAppError('');
    setSuccessMessage(''); // Xóa thông báo thành công trước khi gửi

    try {
      const messageId = await sendTicketEmail(emailFormData.recipientEmail, {
        eventName: event.tickets[0].eventName,
        eventDateTime: event.tickets[0].eventDateTime,
        eventLocation: event.tickets[0].eventLocation,
        eventId: event.eventId,
        firstName: emailFormData.firstName,
        lastName: emailFormData.lastName,
        subject: emailFormData.subject, // Gửi subject
        tickets: event.tickets.map(ticket => ({
          section: ticket.section,
          row: ticket.row,
          seat: ticket.seat,
          seatId: ticket.seatId,
        })),
      });

      console.log('Emails sent successfully with message ID:', messageId);
      setSuccessMessage('Emails sent successfully!'); // Hiển thị thông báo thành công
      closeEmailForm();
    } catch (err) {
      console.error('Error sending emails:', err);
      setAppError('Failed to send emails: ' + err.message);
    }
  };

  const isPublicRoute = location.pathname.match(/^\/[\p{L}\p{N}\-]+(\/seat[0-9]+)?$/u);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (appError) {
    return <div className="error">{appError}</div>;
  }

  if (!isPublicRoute && !isAuthenticated) {
    loginWithRedirect();
    return null;
  }

  return (
    <div className="App">
      {!isPublicRoute && (
        <>
          <div className="header">
            <h1>TicketMaster SafeTix Generator</h1>
            <button onClick={() => logout({ returnTo: window.location.origin })} className="logout-button">
              Logout
            </button>
          </div>
          {appError && <p className="error">{appError}</p>}
          {successMessage && <p className="success">{successMessage}</p>} {/* Hiển thị thông báo thành công */}
          <div className="form">
            <h3>Event Information</h3>
            <input
              type="text"
              name="eventName"
              placeholder="Event Name (e.g., Cardinals vs Dolphins)"
              value={formData.eventName}
              onChange={handleInputChange}
            />
            <input
              type="text"
              name="eventLocation"
              placeholder="Location (e.g., Hard Rock Stadium)"
              value={formData.eventLocation}
              onChange={handleInputChange}
            />
            <input
              type="text"
              name="eventDateTime"
              placeholder="Date & Time (e.g., Sun, Oct 27, 2024, 1:00 PM)"
              value={formData.eventDateTime}
              onChange={handleInputChange}
            />
            <h3>Ticket Information</h3>
            <input
              type="text"
              name="section"
              placeholder="Section (e.g., 332)"
              value={formData.section}
              onChange={handleInputChange}
            />
            <input
              type="text"
              name="row"
              placeholder="Row (e.g., 20)"
              value={formData.row}
              onChange={handleInputChange}
            />
            <input
              type="number"
              name="seatStart"
              min="1"
              placeholder="Starting Seat (e.g., 1)"
              value={formData.seatStart}
              onChange={handleInputChange}
            />
            <input
              type="number"
              name="seatCount"
              min="1"
              max="8"
              placeholder="Number of Tickets (1-8)"
              value={formData.seatCount}
              onChange={handleInputChange}
            />
            <h3>Additional Information</h3>
            <input
              type="text"
              name="note"
              placeholder="Note (e.g., Sold to John)"
              value={formData.note}
              onChange={handleInputChange}
            />
            <h3>Security Keys for Each Ticket</h3>
            {Array.from({ length: parseInt(formData.seatCount) || 1 }).map((_, index) => (
              <div key={index} className="key-input">
                <h4>Ticket {index + 1} (Seat {parseInt(formData.seatStart) + index})</h4>
                <input
                  type="text"
                  placeholder="Raw Token"
                  value={formData.keys[index].rawToken}
                  onChange={(e) => handleKeyChange(index, 'rawToken', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Customer Key (hex, e.g., 6dfb0b853dbfa5309a9763d3c0fdd2727de9b2e6)"
                  value={formData.keys[index].ck}
                  onChange={(e) => handleKeyChange(index, 'ck', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Event Key (hex, e.g., f03c6f066714c536d9e457d79edc74ee0744b999)"
                  value={formData.keys[index].ek}
                  onChange={(e) => handleKeyChange(index, 'ek', e.target.value)}
                />
              </div>
            ))}
            <button onClick={generateTickets}>Generate Tickets</button>
          </div>

          {events.length > 0 && (
            <div className="event-list">
              <h2>Generated Events</h2>
              {events.map((event) => (
                <div key={event.eventId} className="event-item">
                  <div className="event-link">
                    <span>Event: {event.tickets[0].eventName} ({event.tickets.length} tickets) {event.note ? `- ${event.note}` : ''}</span>
                    <p>
                      Public Link: <a href={`https://mypassdelivery.com/${event.eventId}`} target="_blank" rel="noopener noreferrer">
                        https://mypassdelivery.com/{event.eventId}
                      </a>
                    </p>
                  </div>
                  <button onClick={() => startEditing(event)} className="edit-button">
                    Edit Tokens
                  </button>
                  <button onClick={() => openEmailForm(event.eventId)} className="send-email-button">
                    Send Email
                  </button>
                  {showEmailForm === event.eventId && (
                    <div className="email-form">
                      <h3>Send Email for {event.tickets[0].eventName}</h3>
                      <input
                        type="text"
                        name="subject"
                        placeholder="Email Subject"
                        value={emailFormData.subject}
                        onChange={handleEmailFormChange}
                      />
                      <input
                        type="email"
                        name="recipientEmail"
                        placeholder="Recipient Email"
                        value={emailFormData.recipientEmail}
                        onChange={handleEmailFormChange}
                      />
                      <input
                        type="text"
                        name="firstName"
                        placeholder="First Name"
                        value={emailFormData.firstName}
                        onChange={handleEmailFormChange}
                      />
                      <input
                        type="text"
                        name="lastName"
                        placeholder="Last Name"
                        value={emailFormData.lastName}
                        onChange={handleEmailFormChange}
                      />
                      <button onClick={() => sendEmailForEvent(event)} className="send-button">Send</button>
                      <button onClick={closeEmailForm} className="cancel-button">Cancel</button>
                    </div>
                  )}
                  {editEventId === event.eventId && (
                    <div className="edit-tokens">
                      <h3>Edit Raw Tokens for {event.tickets[0].eventName}</h3>
                      <div className="token-input">
                        <label>Note:</label>
                        <input
                          type="text"
                          value={editNote}
                          onChange={handleNoteChange}
                          placeholder="Note (e.g., Sold to John)"
                        />
                      </div>
                      {event.tickets.map((ticket, index) => (
                        <div key={index} className="token-input">
                          <label>Ticket {index + 1} (Seat {ticket.seat}):</label>
                          <input
                            type="text"
                            value={editTokens[index]}
                            onChange={(e) => handleTokenChange(index, e.target.value)}
                          />
                        </div>
                      ))}
                      <button onClick={saveTokens} className="save-button">Save</button>
                      <button onClick={cancelEditing} className="cancel-button">Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="email-tracking">
            <h2>Email Tracking</h2>
            {emailTracking.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Event ID</th>
                    <th>Seat ID</th>
                    <th>Sent At</th>
                    <th>Opened</th>
                    <th>Opened At</th>
                    <th>Link Clicked</th>
                    <th>Link Clicked At</th>
                  </tr>
                </thead>
                <tbody>
                  {emailTracking.map(track => (
                    <tr key={track.id}>
                      <td>{track.recipientEmail}</td>
                      <td>{track.eventId}</td>
                      <td>{track.seatId}</td>
                      <td>{track.sentAt}</td>
                      <td>{track.opened ? 'Yes' : 'No'}</td>
                      <td>{track.openedAt || '-'}</td>
                      <td>{track.linkClicked ? 'Yes' : 'No'}</td>
                      <td>{track.linkClickedAt || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No email tracking data available.</p>
            )}
          </div>
        </>
      )}

      <Routes>
        <Route path="/:eventId" element={<TicketDisplay events={events} />} />
        <Route path="/:eventId/:seatId" element={<TicketDisplay events={events} />} />
      </Routes>
    </div>
  );
}

export default App;