import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom'; // Thêm import Link
import bwipjs from 'bwip-js';
import { TOTP } from 'otpauth';
import './TicketDisplay.css';

function TicketDisplay({ events }) {
  const { eventId, seatId } = useParams();
  const [barcodeSrc, setBarcodeSrc] = useState('');
  const [error, setError] = useState('');
  const [currentTicketIndex, setCurrentTicketIndex] = useState(0);
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  const event = events && Array.isArray(events) ? events.find((e) => e.eventId === eventId) : null;
  const tickets = event ? event.tickets : [];

  useEffect(() => {
    if (seatId && tickets.length > 0) {
      const index = tickets.findIndex((ticket) => ticket.seatId === seatId);
      if (index !== -1) {
        setCurrentTicketIndex(index);
      }
    }
  }, [seatId, tickets]);

  const generateBarcode = () => {
    if (!tickets || tickets.length === 0) return;
    const ticket = tickets[currentTicketIndex];

    try {
      const now = Math.floor(Date.now() / 1000);
      const totpCk = new TOTP({
        secret: ticket.ckBase32,
        digits: 6,
        period: 15,
      });
      const totpEk = new TOTP({
        secret: ticket.ekBase32,
        digits: 6,
        period: 15,
      });

      const totp1 = totpCk.generate();
      const totp2 = totpEk.generate();
      const barcodeData = `${ticket.rawToken}:${totp1}:${totp2}:${now}`;

      bwipjs.toCanvas(canvasRef.current, {
        bcid: 'pdf417',
        text: barcodeData,
        scale: 3,
        height: 10,
      });
      const dataUrl = canvasRef.current.toDataURL('image/png');
      setBarcodeSrc(dataUrl);
      setError('');
    } catch (err) {
      console.error('Error generating barcode:', err);
      setError('Failed to generate barcode: Invalid Base32 key.');
    }
  };

  useEffect(() => {
    generateBarcode();
    const interval = setInterval(generateBarcode, 15000);
    return () => clearInterval(interval);
  }, [currentTicketIndex, tickets]);

  if (!event || tickets.length === 0) return <p>Event or tickets not found</p>;

  const ticket = tickets[currentTicketIndex];

  const handlePrevTicket = () => {
    if (currentTicketIndex > 0) {
      const newIndex = currentTicketIndex - 1;
      setCurrentTicketIndex(newIndex);
      navigate(`/${eventId}/${tickets[newIndex].seatId}`);
    }
  };

  const handleNextTicket = () => {
    if (currentTicketIndex < tickets.length - 1) {
      const newIndex = currentTicketIndex + 1;
      setCurrentTicketIndex(newIndex);
      navigate(`/${eventId}/${tickets[newIndex].seatId}`);
    }
  };

  const handleTicketSelect = (index) => {
    setCurrentTicketIndex(index);
    navigate(`/${eventId}/${tickets[index].seatId}`);
  };

  return (
    <div className="ticket-display">
      <div className="event-info">
        <h2>{ticket.eventName}</h2>
        <p>{ticket.eventDateTime} - {ticket.eventLocation}</p>
      </div>
      <div className="ticket-card">
        <div className="ticket-header">
          <span>RENEWAL Seat</span>
          <span className="info-icon">i</span>
        </div>
        <div className="ticket-details">
          <div>
            <span>SEC</span>
            <h3>{ticket.section}</h3>
          </div>
          <div>
            <span>ROW</span>
            <h3>{ticket.row}</h3>
          </div>
          <div>
            <span>SEAT</span>
            <h3>{ticket.seat}</h3>
          </div>
        </div>
        <p className="admission">Standard Admission</p>
        {error && <p className="error">{error}</p>}
        <div className="barcode-container">
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {barcodeSrc && !error && (
            <>
              <img src={barcodeSrc} alt="SafeTix Barcode" />
              <div className="scan-effect"></div>
            </>
          )}
        </div>
        <p className="warning">Screenshots won't get you in.</p>
        <div className="ticket-navigation">
          <button onClick={handlePrevTicket} disabled={currentTicketIndex === 0}>
            &lt;
          </button>
          <span>{currentTicketIndex + 1} of {tickets.length}</span>
          <button onClick={handleNextTicket} disabled={currentTicketIndex === tickets.length - 1}>
            &gt;
          </button>
        </div>
        <div className="ticket-links">
          <h3>Individual Ticket Links:</h3>
          {tickets.map((t, index) => (
            <div key={t.seatId}>
              <Link
                to={`/${eventId}/${t.seatId}`}
                onClick={() => handleTicketSelect(index)}
                className={currentTicketIndex === index ? 'active' : ''}
              >
                Ticket for Seat {t.seat}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TicketDisplay;