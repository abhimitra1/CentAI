const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Use Mongoose models in a way compatible with serverless
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
