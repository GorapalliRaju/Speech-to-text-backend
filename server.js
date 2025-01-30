require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { createClient } = require('@deepgram/sdk'); // ✅ Correct Import
const multer = require('multer');
const Task = require('../backend/models/task');

const app = express();
const apiKey = process.env.DEEPGRAM_API_KEY;

if (!apiKey) {
    throw new Error("Deepgram API key is missing. Set it in the .env file.");
}

// ✅ Correct usage of Deepgram SDK v3
const deepgram = createClient(apiKey.trim());

const upload = multer();

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1); // Stops the server if the database is unreachable
  });

app.use(cors());
app.use(express.json());

// ✅ Fetch all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find();
    res.json(tasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// ✅ Transcribe audio route (Fixed for Deepgram v3)
const fs = require('fs'); // ✅ Required for file streaming

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

    const filePath = "./temp_audio.wav"; // Temp file to save audio

    // ✅ Save file temporarily
    fs.writeFileSync(filePath, req.file.buffer);

    console.log("📥 Received Audio:", { mimetype: req.file.mimetype, size: req.file.size });

    // ✅ Use Deepgram SDK v3 with `transcribeFile`
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      fs.createReadStream(filePath), // ✅ Correct file streaming
      {
        model: "nova-2",
        language: "en-US",
        smart_format: true,
      }
    );

    // Cleanup: Delete the temp file after processing
    fs.unlinkSync(filePath);

    if (error || !result?.results) {
      return res.status(500).json({ error: 'Transcription failed' });
    }

    const transcript = result.results.channels[0].alternatives[0].transcript;
    const task = await Task.create({ text: transcript });

    res.status(201).json(task);
  } catch (err) {
    console.error('❌ Transcription error:', err);
    res.status(500).json({ error: 'Failed to process audio' });
  }
});


// ✅ Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTask = await Task.findByIdAndDelete(id);

    if (!deletedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
