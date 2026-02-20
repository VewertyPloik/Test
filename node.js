const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
// Allow CORS so your HTML file can connect to it locally
const io = new Server(server, { cors: { origin: "*" } });

// Serve your static files (like index.html) if needed
app.use(express.static(__dirname));

const rooms = {};
const colors = ['#2266ff', '#cc2222', '#22aa33', '#ddaa00', '#8822cc'];

io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    // Send available servers to the player
    socket.emit('serverList', rooms);

    socket.on('hostServer', (username) => {
        const roomId = socket.id.substring(0, 5); // Simple room ID
        const playerColor = colors[Math.floor(Math.random() * colors.length)];
        
        rooms[roomId] = {
            id: roomId,
            hostName: username,
            hostId: socket.id,
            players: [{ id: socket.id, name: username, color: playerColor }],
            status: 'waiting'
        };

        socket.join(roomId);
        socket.emit('roomJoined', rooms[roomId]);
        io.emit('serverList', rooms); // Update everyone's server list
    });

    socket.on('joinServer', ({ roomId, username }) => {
        const room = rooms[roomId];
        if (room && room.players.length < 5 && room.status === 'waiting') {
            // Assign a color not already used if possible
            let availableColors = colors.filter(c => !room.players.find(p => p.color === c));
            if (availableColors.length === 0) availableColors = colors; // Fallback
            const playerColor = availableColors[Math.floor(Math.random() * availableColors.length)];

            room.players.push({ id: socket.id, name: username, color: playerColor });
            socket.join(roomId);
            
            io.to(roomId).emit('roomUpdated', room);
            io.emit('serverList', rooms);
        } else {
            socket.emit('error', 'Server is full or already started.');
        }
    });

    socket.on('startGame', (roomId) => {
        const room = rooms[roomId];
        if (room && room.hostId === socket.id && room.players.length >= 2) {
            room.status = 'playing';
            io.to(roomId).emit('gameStarted', room);
            io.emit('serverList', rooms); // Hide from list or mark playing
        }
    });

    socket.on('disconnect', () => {
        // Cleanup if a host or player leaves
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                
                if (room.players.length === 0 || room.hostId === socket.id) {
                    delete rooms[roomId]; // Destroy room if host leaves or empty
                } else {
                    io.to(roomId).emit('roomUpdated', room);
                }
                io.emit('serverList', rooms);
                break;
            }
        }
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
