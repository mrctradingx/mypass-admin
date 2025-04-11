import React, { useState, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom'; // Thêm useLocation
import { useAuth0 } from '@auth0/auth0-react';
import { v4 as uuidv4 } from 'uuid';
import { encode as base32Encode } from 'base32.js';
import TicketDisplay from './TicketDisplay';
import './App.css';

function App() {
  const { isAuthenticated, isLoading, loginWithRedirect, logout, error } = useAuth0();
  const [events, setEvents] = useState(() => {
    const savedEvents = localStorage.getItem('ticketEvents');
    return savedEvents ? JSON.parse(savedEvents) : [];
  });
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
  const location = useLocation(); // Sử dụng useLocation để lấy route hiện tại

  useEffect(() => {
    localStorage.setItem('ticketEvents', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    if (error) {
      setAppError(`Auth0 Error: ${error.message}`);
    }
  }, [error]);

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

  const generateTickets = () => {
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

    setEvents([...events, { eventId, tickets, note: formData.note || '' }]);
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

  // Kiểm tra xem route hiện tại có phải là route công khai không
  const isPublicRoute = location.pathname.match(/^\/[a-z]+-[a-z0-9]+(\/seat[0-9]+)?$/);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (appError) {
    return <div className="error">{appError}</div>;
  }

  // Nếu không phải route công khai (tức là trang admin), yêu cầu đăng nhập
  if (!isPublicRoute && !isAuthenticated) {
    loginWithRedirect();
    return null;
  }

  return (
    <div className="App">
      {/* Hiển thị giao diện admin (trang tạo vé) nếu không phải route công khai */}
      {!isPublicRoute && (
        <>
          <div className="header">
            <h1>TicketMaster SafeTix Generator</h1>
            <button onClick={() => logout({ returnTo: window.location.origin })} className="logout-button">
              Logout
            </button>
          </div>
          {appError && <p className="error">{appError}</p>}
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
        </>
      )}

      {/* Hiển thị giao diện vé công khai nếu là route công khai */}
      <Routes>
        <Route path="/:eventId" element={<TicketDisplay events={events} />} />
        <Route path="/:eventId/:seatId" element={<TicketDisplay events={events} />} />
      </Routes>
    </div>
  );
}

export default App;
