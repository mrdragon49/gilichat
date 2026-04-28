const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Helper to generate random credentials
const generateCreds = () => ({
    id: crypto.randomBytes(5).toString('hex'), // e.g., "a1b2c3"
});

io.on('connection', (socket) => {
    // When a user requests to create a room
    socket.on('create-room', () => {
        const creds = generateCreds();
        socket.join(creds.id);
        socket.emit('room-created', creds);
    });


    // When a user tries to join an existing room

    // Handling messages
    socket.on('send-message', ({ roomId, message }) => {
        socket.to(roomId).emit('receive-message', message);
        console.log(message);

    });
    socket.on('join-room', ({ roomId }) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-joined', 'A user joined the chat');
    });
    // Add this inside your io.on('connection', (socket) => { ... }) block

    // report section 
    socket.on('send-report', async (data) => {
        let roomId = data.roomId;

        // Get all sockets in this room
        const clients = io.sockets.adapter.rooms.get(roomId);
        let reporterIp = socket.handshake.address === '::1' ? '127.0.0.1' : socket.handshake.address;
        let reportedIp = "Unknown/No Partner";

        if (clients) {
            for (const clientId of clients) {
                // Find the socket ID that IS NOT the person reporting
                if (clientId !== socket.id) {
                    const partnerSocket = io.sockets.sockets.get(clientId);
                    if (partnerSocket) {
                        reportedIp = partnerSocket.handshake.address === '::1' ? '127.0.0.1' : partnerSocket.handshake.address;
                    }
                }
            }
        }

        const reportData = {
            reporter_ip: reporterIp,
            reported_person_ip: reportedIp, // Now includes the other user's IP
            chatId: roomId,
            date: new Date().toLocaleDateString(),
            timestamp: new Date().toLocaleTimeString(),
            reason: "User Reported"
        };

        // Send JSON back to the user for visibility
        socket.emit('report-received', reportData);

        // Send to Google Sheets
        const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbw3fKdNlKI-aMLpTYJQs-dEp-kwxshr4ww1lp3CF7rv-fhtjfGpyQTUCco0Qp12wXU/exec';
        try {
            await fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reportData)
            });
        } catch (e) {
            console.error("Sheet log failed", e);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log());